import { CATEGORIES, MATERIALS, PACKAGING_TYPES, isTaxonomyValue } from "./taxonomy";
import { WasteReport } from "./types";

export function isWasteReport(value: unknown): value is WasteReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Partial<WasteReport>;
  return typeof report.id === "string" &&
    typeof report.createdAt === "string" &&
    (report.reporterId === undefined || typeof report.reporterId === "string") &&
    (report.reporterUsername === undefined || typeof report.reporterUsername === "string") &&
    Number.isFinite(report.latitude) &&
    Number.isFinite(report.longitude) &&
    (report.locationName === undefined || typeof report.locationName === "string") &&
    (report.imagePreview === undefined || typeof report.imagePreview === "string") &&
    (report.imagePath === undefined || typeof report.imagePath === "string") &&
    (report.reviewStatus === undefined || report.reviewStatus === "approved" || report.reviewStatus === "rejected") &&
    (report.reviewedAt === undefined || typeof report.reviewedAt === "string") &&
    (report.reviewHistory === undefined || (Array.isArray(report.reviewHistory) && report.reviewHistory.every(entry =>
      !!entry && typeof entry.id === "string" &&
      (entry.decision === "approved" || entry.decision === "rejected") &&
      typeof entry.reviewerEmail === "string" && typeof entry.reviewedAt === "string" &&
      (entry.note === undefined || typeof entry.note === "string") &&
      Array.isArray(entry.changes) && entry.changes.every(change => typeof change === "string")
    ))) &&
    Array.isArray(report.items) &&
    report.items.every(item =>
      !!item &&
      typeof item.id === "string" &&
      typeof item.brand === "string" &&
      isTaxonomyValue(item.category, CATEGORIES) &&
      isTaxonomyValue(item.packagingType, PACKAGING_TYPES) &&
      isTaxonomyValue(item.likelyMaterial, MATERIALS) &&
      Number.isFinite(item.confidence)
    );
}

async function requestReports(path = "/api/reports", options?: RequestInit): Promise<WasteReport[]> {
  const response = await fetch(path, { cache: "no-store", ...options });
  const payload: unknown = await response.json();
  if (!response.ok || !payload || typeof payload !== "object" || !Array.isArray((payload as { reports?: unknown }).reports)) {
    throw new Error((payload as { error?: string })?.error || "Could not update the shared observation store.");
  }
  return (payload as { reports: unknown[] }).reports.filter(isWasteReport);
}

export function loadReports() {
  return requestReports();
}

export function saveReport(report: WasteReport) {
  return requestReports("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report })
  });
}

export function replaceReports(reports: WasteReport[]) {
  return requestReports("/api/reports", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reports })
  });
}

export function clearReports() {
  return requestReports("/api/reports", { method: "DELETE" });
}

// Compatibility aliases for the original MVP components. New frontend code should
// use the shorter async names above.
export const loadReportsFromServer = loadReports;
export const saveReportToServer = saveReport;
export const replaceReportsOnServer = replaceReports;
export const clearReportsOnServer = clearReports;
