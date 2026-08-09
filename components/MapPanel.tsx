"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { WasteReport } from "@/lib/types";
import { analyzeReportQuality, HIGH_CONFIDENCE_THRESHOLD } from "@/lib/dataQuality";
import "leaflet/dist/leaflet.css";

type MarkerMode = "all" | "high" | "low";

function MapViewport({ reports }: { reports: WasteReport[] }) {
  const map = useMap();
  useEffect(() => {
    if (reports.length === 1) map.setView([reports[0].latitude, reports[0].longitude], 15);
    else if (reports.length > 1) map.fitBounds(reports.map(report => [report.latitude, report.longitude] as [number, number]), { padding: [24, 24], maxZoom: 15 });
  }, [map, reports]);
  return null;
}

export default function MapPanel({ reports }: { reports: WasteReport[] }) {
  const [mode, setMode] = useState<MarkerMode>("all");
  const quality = useMemo(() => analyzeReportQuality(reports), [reports]);
  const highCount = [...quality.values()].filter(item => item.confidence === "high").length;
  const lowCount = reports.length - highCount;
  const displayedReports = reports.filter(report => mode === "all" || quality.get(report.id)?.confidence === mode);
  const center: [number, number] = displayedReports.length > 0 ? [displayedReports[0].latitude, displayedReports[0].longitude] : [-6.2088, 106.8456];

  return <div>
    <div className="markerToolbar" role="group" aria-label="Map marker confidence filter">
      <button className={mode === "all" ? "active" : ""} onClick={() => setMode("all")}>All markers ({reports.length})</button>
      <button className={mode === "high" ? "active" : ""} onClick={() => setMode("high")}>High confidence ({highCount})</button>
      <button className={mode === "low" ? "active dangerToggle" : "dangerToggle"} onClick={() => setMode("low")}>Low confidence ({lowCount})</button>
    </div>
    <div className="mapLegend"><span><i className="legendDot legendGood" /> Passes checks</span><span><i className="legendDot legendReview" /> Needs review</span><span>High confidence threshold: {Math.round(HIGH_CONFIDENCE_THRESHOLD * 100)}%</span></div>
    <div className="mapWrap">
      <MapContainer center={center} zoom={12} scrollWheelZoom style={{ height: "460px", width: "100%" }}>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapViewport reports={displayedReports} />
        {displayedReports.map(report => {
          const result = quality.get(report.id);
          const needsReview = Boolean(result?.issues.length);
          return <CircleMarker key={report.id} center={[report.latitude, report.longitude]} radius={8} pathOptions={{ color: needsReview ? "#dc2626" : "#0f766e", fillColor: needsReview ? "#ef4444" : "#14b8a6", fillOpacity: .82 }}>
            <Popup>
              {report.locationName && <><strong>{report.locationName}</strong><br /></>}
              <strong>{report.items.length} item(s)</strong><br />
              {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}<br />
              Average confidence: {Math.round((result?.averageConfidence || 0) * 100)}%<br />
              {result?.issues.length ? <><strong style={{ color: "#b91c1c" }}>Review: {result.issues.join(", ")}</strong><br /></> : <><strong style={{ color: "#0f766e" }}>Quality checks passed</strong><br /></>}
              {report.items.map(item => `${item.packagingType} / ${item.likelyMaterial}`).join(", ")}
            </Popup>
          </CircleMarker>;
        })}
      </MapContainer>
    </div>
    {!displayedReports.length && <p className="status">No markers match this confidence filter.</p>}
  </div>;
}
