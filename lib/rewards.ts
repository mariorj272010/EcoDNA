import { HIGH_CONFIDENCE_THRESHOLD, reportAverageConfidence } from "./dataQuality";
import type { WasteReport } from "./types";

export const APPROVED_REPORT_POINTS = 10;

export function hasHighAiConfidence(report: WasteReport) {
  return reportAverageConfidence(report) >= HIGH_CONFIDENCE_THRESHOLD;
}

export function rewardPointsForReport(report: WasteReport) {
  return hasHighAiConfidence(report) ? APPROVED_REPORT_POINTS : 0;
}
