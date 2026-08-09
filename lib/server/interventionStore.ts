import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { isIntervention } from "@/lib/interventions";
import type { Intervention } from "@/lib/types";

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const useSupabase = Boolean(supabaseUrl && supabaseKey);
const dataDirectory = process.env.ECODNA_DATA_DIR || path.join(process.cwd(), "data");
const interventionFile = path.join(dataDirectory, "ecodna-interventions.json");

function headers(prefer?: string): HeadersInit {
  const legacyJwt = supabaseKey?.startsWith("eyJ");
  return { apikey: supabaseKey || "", ...(legacyJwt ? { Authorization: `Bearer ${supabaseKey}` } : {}), "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) };
}

async function databaseRequest(pathname: string, options: RequestInit = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, { cache: "no-store", ...options });
  if (!response.ok) throw new Error(`Shared intervention request failed (${response.status}): ${(await response.text()).slice(0, 180)}`);
  return response;
}

async function readJson(): Promise<Intervention[]> {
  try { const raw: unknown = JSON.parse(await readFile(interventionFile, "utf8")); return Array.isArray(raw) ? raw.filter(isIntervention) : []; }
  catch (error: unknown) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}

async function writeJson(entries: Intervention[]) {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = `${interventionFile}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(entries, null, 2), "utf8");
  await rename(temporaryFile, interventionFile);
}

export async function readInterventions() {
  if (!useSupabase) return readJson();
  const response = await databaseRequest("ecodna_interventions?select=intervention&order=created_at.desc", { headers: headers() });
  const rows: unknown = await response.json();
  return Array.isArray(rows) ? rows.map(row => (row as { intervention?: unknown }).intervention).filter(isIntervention) : [];
}

export async function upsertIntervention(entry: Intervention) {
  if (useSupabase) {
    await databaseRequest("ecodna_interventions", { method: "POST", headers: headers("resolution=merge-duplicates,return=minimal"), body: JSON.stringify({ id: entry.id, area_key: entry.areaKey, deployed_at: entry.deployedAt, created_at: entry.createdAt, intervention: entry }) });
  } else {
    const entries = [entry, ...(await readJson()).filter(item => item.areaKey !== entry.areaKey)];
    await writeJson(entries);
  }
  return readInterventions();
}
