import type { WasteReport } from "./types";

export type ExportArea = {
  name: string;
  reports: number;
  items: number;
  dominantMaterial: string;
  dominantPackaging: string;
  dominantShare: number;
  priority: string;
  latitude: number;
  longitude: number;
};

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function datedName(base: string, extension: string) {
  return `${base}-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

export function exportReportsJson(reports: WasteReport[]) {
  download(datedName("ecodna-observations", "json"), JSON.stringify(reports, null, 2), "application/json");
}

export function exportReportsCsv(reports: WasteReport[]) {
  const header = ["reportId", "createdAt", "source", "locationName", "latitude", "longitude", "itemId", "brand", "category", "packagingType", "likelyMaterial", "confidence"];
  const rows = reports.flatMap(report => report.items.map(item => [
    report.id, report.createdAt, report.source || "field", report.locationName || "", report.latitude, report.longitude,
    item.id, item.brand, item.category, item.packagingType, item.likelyMaterial, item.confidence
  ]));
  download(datedName("ecodna-observations", "csv"), [header, ...rows].map(row => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
}

export function exportHotspotsCsv(areas: ExportArea[]) {
  const header = ["rank", "area", "reports", "items", "dominantMaterial", "dominantPackaging", "dominantSharePercent", "priority", "latitude", "longitude"];
  const rows = areas.map((area, index) => [index + 1, area.name, area.reports, area.items, area.dominantMaterial, area.dominantPackaging, area.dominantShare, area.priority, area.latitude, area.longitude]);
  download(datedName("ecodna-hotspots", "csv"), [header, ...rows].map(row => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
}
