import type { WasteItem, WasteReport } from "./types";

export type CompositionRow = {
  name: string;
  value: number;
  percentage: number;
};

function allItems(reports: WasteReport[]): WasteItem[] {
  return reports.flatMap(report => report.items);
}

export function rankedComposition(
  reports: WasteReport[],
  select: (item: WasteItem) => string,
  options: { exclude?: string[] } = {}
): CompositionRow[] {
  const excluded = new Set(options.exclude ?? []);
  const counts = new Map<string, number>();

  for (const item of allItems(reports)) {
    const name = select(item);
    if (!excluded.has(name)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  return [...counts.entries()]
    .map(([name, value]) => ({
      name,
      value,
      percentage: total ? Math.round((value / total) * 100) : 0
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

export function dominantMaterial(reports: WasteReport[]): string {
  return rankedComposition(reports, item => item.likelyMaterial, { exclude: ["Unknown"] })[0]?.name ?? "Unknown";
}

export function dominantPackaging(reports: WasteReport[]): string {
  return rankedComposition(reports, item => item.packagingType, { exclude: ["Other"] })[0]?.name ?? "Other";
}

export function verifiedBrands(reports: WasteReport[]): CompositionRow[] {
  return rankedComposition(reports, item => item.brand.trim() || "Unknown", { exclude: ["Unknown"] });
}

export function hotspotSignal(reports: WasteReport[]): "LOW" | "MODERATE" | "HIGH" {
  if (reports.length >= 5) return "HIGH";
  if (reports.length >= 3) return "MODERATE";
  return "LOW";
}
