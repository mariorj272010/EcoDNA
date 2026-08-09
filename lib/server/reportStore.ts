import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { isWasteReport } from "@/lib/storage";
import type { WasteReport } from "@/lib/types";

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(supabaseUrl && supabaseKey);
const dataDirectory = process.env.ECODNA_DATA_DIR || path.join(process.cwd(), "data");
const reportFile = path.join(dataDirectory, "ecodna-reports.json");

function supabaseHeaders(prefer?: string): HeadersInit {
  // Supabase's current sb_secret keys must be sent as `apikey` only. Legacy
  // service_role JWTs additionally use the Authorization header to assume the
  // service role for PostgREST.
  const isLegacyJwtKey = supabaseKey?.startsWith("eyJ");
  return {
    apikey: supabaseKey || "",
    ...(isLegacyJwtKey ? { Authorization: `Bearer ${supabaseKey}` } : {}),
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {})
  };
}

async function supabaseRequest(pathname: string, options: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, { cache: "no-store", ...options });
  if (!response.ok) {
    const details = (await response.text()).replace(/\s+/g, " ").slice(0, 220);
    throw new Error(`Shared database request failed (${response.status})${details ? `: ${details}` : ""}`);
  }
  return response;
}

async function readJsonReports(): Promise<WasteReport[]> {
  try {
    const raw: unknown = JSON.parse(await readFile(reportFile, "utf8"));
    return Array.isArray(raw) ? raw.filter(isWasteReport) : [];
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeJsonReports(reports: WasteReport[]) {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = `${reportFile}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(reports, null, 2), "utf8");
  await rename(temporaryFile, reportFile);
}

async function readSupabaseReports(): Promise<WasteReport[]> {
  const response = await supabaseRequest("ecodna_reports?select=report&order=created_at.desc", { headers: supabaseHeaders() });
  const rows: unknown = await response.json();
  return Array.isArray(rows)
    ? rows.map(row => row && typeof row === "object" ? (row as { report?: unknown }).report : undefined).filter(isWasteReport)
    : [];
}

async function insertSupabaseReports(reports: WasteReport[]) {
  if (!reports.length) return;
  await supabaseRequest("ecodna_reports", {
    method: "POST",
    headers: supabaseHeaders("resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify(reports.map(report => ({ id: report.id, created_at: report.createdAt, report })))
  });
}

export function reportStorageBackend() {
  return useSupabase ? "supabase" : "json";
}

export async function readReports() {
  return useSupabase ? readSupabaseReports() : readJsonReports();
}

export async function saveReport(report: WasteReport) {
  if (useSupabase) {
    await insertSupabaseReports([report]);
    return readSupabaseReports();
  }
  const reports = [report, ...(await readJsonReports())];
  await writeJsonReports(reports);
  return reports;
}

export async function replaceReports(reports: WasteReport[]) {
  if (useSupabase) {
    await supabaseRequest("ecodna_reports?id=not.is.null", { method: "DELETE", headers: supabaseHeaders("return=minimal") });
    await insertSupabaseReports(reports);
  } else {
    await writeJsonReports(reports);
  }
  return reports;
}

export async function clearReports() {
  if (useSupabase) {
    await supabaseRequest("ecodna_reports?id=not.is.null", { method: "DELETE", headers: supabaseHeaders("return=minimal") });
  } else {
    await writeJsonReports([]);
  }
  return [] as WasteReport[];
}
