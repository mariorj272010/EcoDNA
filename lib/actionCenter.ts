import type { WasteReport } from "./types";
import { dominantMaterial, dominantPackaging, hotspotSignal } from "./wasteDna";

export type ActionRecommendation = {
  title: string;
  summary: string;
  priority: "LOW" | "MODERATE" | "HIGH";
  evidence: string[];
  nextSteps: string[];
};

export function recommendAction(reports: WasteReport[]): ActionRecommendation {
  const priority = hotspotSignal(reports);
  const material = dominantMaterial(reports);
  const packaging = dominantPackaging(reports);
  const itemCount = reports.reduce((sum, report) => sum + report.items.length, 0);
  const plasticHeavy = material.toLowerCase().includes("plastic");

  return {
    title: plasticHeavy ? "Pilot targeted plastic recovery" : "Improve collection at the hotspot",
    summary: plasticHeavy
      ? `The strongest signal is ${material}, led by ${packaging.toLowerCase()} packaging. Validate the site, then pilot collection or processing equipment sized to measured demand.`
      : `The strongest signal is ${material}, led by ${packaging.toLowerCase()} packaging. Validate the site before changing collection infrastructure.`,
    priority,
    evidence: [
      `${reports.length} confirmed observations`,
      `${itemCount} verified waste items`,
      `Dominant likely material: ${material}`,
      `Dominant packaging: ${packaging}`
    ],
    nextSteps: [
      "Inspect the hotspot and confirm safe access, ownership, and collection constraints.",
      "Run a short manual collection audit to measure daily volume and contamination.",
      plasticHeavy
        ? "Pilot a clearly labeled plastic collection or processing machine before committing to permanent infrastructure."
        : "Adjust bin placement and collection frequency, then monitor whether the signal declines."
    ]
  };
}
