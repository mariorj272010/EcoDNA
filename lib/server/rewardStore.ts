import type { WasteReport } from "@/lib/types";
import { serverHeaders } from "@/lib/server/auth";
import { hasHighAiConfidence, rewardPointsForReport } from "@/lib/rewards";

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(supabaseUrl && serviceKey);

async function request(pathname: string, options: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, { cache: "no-store", ...options });
  if (!response.ok) {
    const details = (await response.text()).replace(/\s+/g, " ").slice(0, 220);
    throw new Error(`Reward storage failed (${response.status})${details ? `: ${details}` : ""}. Run the updated supabase/ecodna_reports.sql if the rewards tables are missing.`);
  }
  return response;
}

export async function syncApprovedReportRewards(reports: WasteReport[]) {
  if (!useSupabase) return;
  const eligible = reports.filter(report =>
    report.source !== "demo" &&
    report.reviewStatus === "approved" &&
    hasHighAiConfidence(report) &&
    typeof report.reporterId === "string" &&
    /^[0-9a-f-]{36}$/i.test(report.reporterId)
  );
  if (eligible.length) {
    await request("ecodna_rewards?on_conflict=report_id", {
      method: "POST",
      // PostgREST requires the conflict column in the query string as well as
      // the merge preference. This keeps repeated reviewer saves idempotent.
      headers: { ...serverHeaders(true), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(eligible.map(report => ({
        report_id: report.id,
        user_id: report.reporterId,
        points: rewardPointsForReport(report),
        reason: "Approved litter observation with sufficient AI confidence"
      })))
    });
  }

  const rewardableIds = new Set(eligible.map(report => report.id));
  const knownFieldIds = new Set(reports.filter(report => report.source !== "demo" && report.reporterId).map(report => report.id));
  const rewardsResponse = await request("ecodna_rewards?select=report_id,user_id,points", { headers: serverHeaders() });
  let rewards = await rewardsResponse.json() as Array<{ report_id?: string; user_id?: string; points?: number }>;
  const affectedUsers = new Set([
    ...reports.map(report => report.reporterId).filter((userId): userId is string => Boolean(userId)),
    ...rewards.map(reward => reward.user_id).filter((userId): userId is string => Boolean(userId))
  ]);
  const disqualified = rewards.filter(reward => reward.report_id && knownFieldIds.has(reward.report_id) && !rewardableIds.has(reward.report_id));
  await Promise.all(disqualified.map(reward => request(`ecodna_rewards?report_id=eq.${encodeURIComponent(reward.report_id || "")}`, {
    method: "DELETE",
    headers: { ...serverHeaders(), Prefer: "return=minimal" }
  })));
  if (disqualified.length) {
    const removed = new Set(disqualified.map(reward => reward.report_id));
    rewards = rewards.filter(reward => !removed.has(reward.report_id));
  }
  const totals = new Map<string, number>();
  for (const reward of rewards) {
    if (!reward.user_id) continue;
    totals.set(reward.user_id, (totals.get(reward.user_id) || 0) + Number(reward.points || 0));
  }
  await Promise.all([...affectedUsers].map(userId => request(`ecodna_profiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { ...serverHeaders(true), Prefer: "return=minimal" },
    body: JSON.stringify({ reward_points: totals.get(userId) || 0 })
  })));
}
