import type { Intervention } from "./types";

export function isIntervention(value: unknown): value is Intervention {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<Intervention>;
  return typeof entry.id === "string" && typeof entry.areaKey === "string" &&
    typeof entry.areaName === "string" && typeof entry.option === "string" &&
    typeof entry.deployedAt === "string" && typeof entry.createdAt === "string";
}

async function request(options?: RequestInit): Promise<Intervention[]> {
  const response = await fetch("/api/interventions", { cache: "no-store", ...options });
  const payload: unknown = await response.json();
  if (!response.ok || !payload || typeof payload !== "object" || !Array.isArray((payload as { interventions?: unknown }).interventions)) {
    throw new Error((payload as { error?: string })?.error || "Could not update interventions.");
  }
  return (payload as { interventions: unknown[] }).interventions.filter(isIntervention);
}

export function loadInterventions() { return request(); }
export function saveIntervention(intervention: Intervention) {
  return request({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intervention }) });
}
