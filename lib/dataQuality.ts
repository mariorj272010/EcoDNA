import type { WasteReport } from "./types";

export const HIGH_CONFIDENCE_THRESHOLD = 0.8;

export type DataQualityIssue =
  | "Low AI confidence"
  | "Possible duplicate"
  | "Missing place name"
  | "Outside Jakarta survey bounds";

export type ReportQuality = {
  averageConfidence: number;
  confidence: "high" | "low";
  issues: DataQualityIssue[];
};

const JAKARTA_BOUNDS = {
  minLatitude: -6.42,
  maxLatitude: -5.95,
  minLongitude: 106.65,
  maxLongitude: 107.1
};

export function reportAverageConfidence(report: WasteReport) {
  if (!report.items.length) return 0;
  return report.items.reduce((sum, item) => sum + item.confidence, 0) / report.items.length;
}

function itemSignature(report: WasteReport) {
  return report.items
    .map(item => `${item.category}|${item.packagingType}|${item.likelyMaterial}`)
    .sort()
    .join(";");
}

function distanceMeters(a: WasteReport, b: WasteReport) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const earthRadius = 6_371_000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function analyzeReportQuality(reports: WasteReport[]): Map<string, ReportQuality> {
  const quality = new Map<string, ReportQuality>();

  for (const report of reports) {
    const averageConfidence = reportAverageConfidence(report);
    const issues: DataQualityIssue[] = [];
    if (report.reviewStatus !== "approved" && averageConfidence < HIGH_CONFIDENCE_THRESHOLD) issues.push("Low AI confidence");
    if (report.reviewStatus !== "approved" && !report.locationName?.trim()) issues.push("Missing place name");
    if (
      report.latitude < JAKARTA_BOUNDS.minLatitude || report.latitude > JAKARTA_BOUNDS.maxLatitude ||
      report.longitude < JAKARTA_BOUNDS.minLongitude || report.longitude > JAKARTA_BOUNDS.maxLongitude
    ) if (report.reviewStatus !== "approved") issues.push("Outside Jakarta survey bounds");
    quality.set(report.id, {
      averageConfidence,
      confidence: averageConfidence >= HIGH_CONFIDENCE_THRESHOLD ? "high" : "low",
      issues
    });
  }

  for (let first = 0; first < reports.length; first += 1) {
    for (let second = first + 1; second < reports.length; second += 1) {
      const a = reports[first];
      const b = reports[second];
      const timeDifference = Math.abs(new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const likelyDuplicate =
        timeDifference <= 10 * 60 * 1000 &&
        distanceMeters(a, b) <= 30 &&
        itemSignature(a) === itemSignature(b);
      if (likelyDuplicate) {
        for (const report of [a, b]) {
          const current = quality.get(report.id);
          if (report.reviewStatus !== "approved" && current && !current.issues.includes("Possible duplicate")) current.issues.push("Possible duplicate");
        }
      }
    }
  }

  return quality;
}
