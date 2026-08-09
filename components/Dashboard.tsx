"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import type { Intervention, WasteReport } from "@/lib/types";
import { CATEGORIES, MATERIALS, PACKAGING_TYPES } from "@/lib/taxonomy";
import { analyzeReportQuality } from "@/lib/dataQuality";
import { exportHotspotsCsv, exportReportsCsv, exportReportsJson } from "@/lib/exportReports";
import { loadInterventions, saveIntervention } from "@/lib/interventions";
import { replaceReports } from "@/lib/storage";
import { APPROVED_REPORT_POINTS, rewardPointsForReport } from "@/lib/rewards";

const MapPanel = dynamic(() => import("./MapPanel"), { ssr: false });

type Filters = {
  area: string;
  category: string;
  packaging: string;
  material: string;
  source: string;
  dateFrom: string;
  dateTo: string;
};

const EMPTY_FILTERS: Filters = { area: "", category: "", packaging: "", material: "", source: "", dateFrom: "", dateTo: "" };

function countBy(reports: WasteReport[], selector: (item: WasteReport["items"][number]) => string) {
  const counts = new Map<string, number>();
  for (const report of reports) for (const item of report.items) {
    const key = selector(item) || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function pct(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

type AreaCluster = {
  key: string;
  name?: string;
  latitude: number;
  longitude: number;
  reports: WasteReport[];
  itemCount: number;
  dominantMaterial: string;
  dominantPackaging: string;
  dominantShare: number;
  priorityScore: number;
  level: "LOW" | "MODERATE" | "HIGH";
};

function clusterAreas(reports: WasteReport[]): AreaCluster[] {
  const cells = new Map<string, { name?: string; latitude: number; longitude: number; reports: WasteReport[] }>();
  for (const report of reports) {
    const latitude = Math.round(report.latitude * 100) / 100;
    const longitude = Math.round(report.longitude * 100) / 100;
    const name = report.locationName?.trim() || undefined;
    const key = name ? `place:${name.toLowerCase()}` : `${latitude},${longitude}`;
    const cell = cells.get(key) || { name, latitude, longitude, reports: [] };
    cell.reports.push(report);
    cells.set(key, cell);
  }

  return [...cells.entries()].map(([key, cell]) => {
    const itemCount = cell.reports.reduce((sum, report) => sum + report.items.length, 0);
    const materials = countBy(cell.reports, item => item.likelyMaterial);
    const packaging = countBy(cell.reports, item => item.packagingType);
    const reportCount = cell.reports.length;
    // A transparent priority signal: observation density leads, while item volume
    // and a dominant stream make a zone more actionable.
    const priorityScore = reportCount * 3 + itemCount + Math.round((materials[0]?.value || 0) / Math.max(itemCount, 1) * 10);
    const level: AreaCluster["level"] = priorityScore >= 55 ? "HIGH" : priorityScore >= 25 ? "MODERATE" : "LOW";
    const averageLatitude = cell.reports.reduce((sum, report) => sum + report.latitude, 0) / reportCount;
    const averageLongitude = cell.reports.reduce((sum, report) => sum + report.longitude, 0) / reportCount;
    return {
      key,
      name: cell.name,
      latitude: cell.name ? averageLatitude : cell.latitude,
      longitude: cell.name ? averageLongitude : cell.longitude,
      reports: cell.reports,
      itemCount,
      dominantMaterial: materials[0]?.name || "Unknown",
      dominantPackaging: packaging[0]?.name || "Other",
      dominantShare: pct(materials[0]?.value || 0, itemCount),
      priorityScore,
      level
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore || b.reports.length - a.reports.length);
}

function interventionMetrics(area: AreaCluster, intervention?: Intervention) {
  if (!intervention) return null;
  const deployment = new Date(`${intervention.deployedAt}T00:00:00`).getTime();
  const windowMs = 30 * 24 * 60 * 60 * 1000;
  const before = area.reports.filter(report => { const time = new Date(report.createdAt).getTime(); return time >= deployment - windowMs && time < deployment; });
  const after = area.reports.filter(report => { const time = new Date(report.createdAt).getTime(); return time >= deployment && time < deployment + windowMs; });
  return { beforeReports: before.length, beforeItems: before.reduce((sum, report) => sum + report.items.length, 0), afterReports: after.length, afterItems: after.reduce((sum, report) => sum + report.items.length, 0) };
}

function filterReports(reports: WasteReport[], filters: Filters) {
  return reports.flatMap(report => {
    if (filters.area && (report.locationName || "Unnamed area") !== filters.area) return [];
    if (filters.source && (report.source || "field") !== filters.source) return [];
    const day = report.createdAt.slice(0, 10);
    if (filters.dateFrom && day < filters.dateFrom) return [];
    if (filters.dateTo && day > filters.dateTo) return [];
    const items = report.items.filter(item =>
      (!filters.category || item.category === filters.category) &&
      (!filters.packaging || item.packagingType === filters.packaging) &&
      (!filters.material || item.likelyMaterial === filters.material)
    );
    return items.length ? [{ ...report, items }] : [];
  });
}

function areaPlan(area: AreaCluster) {
  if (area.reports.length < 3 || area.itemCount < 5) return { title: "Validate before installing permanent equipment", machine: "Temporary smart sorting station with fill-level or weight tracking", actions: "Run repeated surveys at the same times for 1-2 weeks, add clear sorting labels, and confirm who will collect each stream.", measure: "Compare reports and item counts per survey before and after the trial." };
  if (area.dominantShare < 40) return { title: "Treat this as a mixed-waste hotspot", machine: "Multi-stream smart collection station with separate weighing", actions: "Place the station on the highest-footfall path, improve disposal access, and arrange separate pickups before adding processing equipment.", measure: "Track weight by stream, contamination, overflow events, and repeat litter counts." };
  if (area.dominantMaterial === "PET Plastic" || area.dominantPackaging === "Bottle") return { title: "Build a bottle recovery point", machine: "Reverse-vending machine or supervised PET bottle compactor", actions: "Add a small return incentive, anti-contamination signage, and a collection agreement with a PET recycler.", measure: "Track bottles collected, contamination rate, machine uptime, and change in nearby bottle litter." };
  if (["Flexible Plastic", "Multilayer Plastic"].includes(area.dominantMaterial) || ["Sachet", "Wrapper"].includes(area.dominantPackaging)) return { title: "Capture flexible-packaging leakage", machine: "Supervised flexible-plastic drop-off and compaction unit", actions: "Pair the unit with vendor take-back, source-reduction trials, frequent pickup, and a verified downstream processor. A bottle-only machine will not fit this waste profile.", measure: "Track kilograms collected, vendor participation, contamination, and change in sachet/wrapper litter." };
  if (area.dominantMaterial === "Aluminium" || area.dominantPackaging === "Can") return { title: "Create a high-value can recovery point", machine: "Can crusher with a secure buy-back or collection cage", actions: "Separate cans from other waste, publish the return value, and schedule pickup with a metal recycler.", measure: "Track cans or kilograms recovered, payout cost, contamination, and nearby can litter." };
  return { title: "Pilot sorting infrastructure", machine: "Multi-stream smart bin with fill-level monitoring", actions: "Use the pilot to learn which recoverable stream is reliable enough for specialized equipment.", measure: "Track composition, fill rate, contamination, servicing cost, and repeated litter counts." };
}

function FiltersPanel({ filters, setFilters, reports, filteredReports, areas }: { filters: Filters; setFilters: (filters: Filters) => void; reports: WasteReport[]; filteredReports: WasteReport[]; areas: AreaCluster[] }) {
  const areaOptions = [...new Set(reports.map(report => report.locationName?.trim() || "Unnamed area"))].sort();
  const patch = (key: keyof Filters, value: string) => setFilters({ ...filters, [key]: value });
  return <div className="card filterCard">
    <div className="rowBetween"><div><div className="eyebrowDark">EXPLORE THE DATA</div><h2>Filters and export</h2><p className="muted">Showing {filteredReports.length} of {reports.length} reports. Item filters update every metric, chart, marker, and action recommendation.</p></div><button onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button></div>
    <div className="filterGrid">
      <label>Area<select value={filters.area} onChange={event => patch("area", event.target.value)}><option value="">All areas</option>{areaOptions.map(area => <option key={area}>{area}</option>)}</select></label>
      <label>Category<select value={filters.category} onChange={event => patch("category", event.target.value)}><option value="">All categories</option>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Packaging<select value={filters.packaging} onChange={event => patch("packaging", event.target.value)}><option value="">All packaging</option>{PACKAGING_TYPES.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Likely material<select value={filters.material} onChange={event => patch("material", event.target.value)}><option value="">All materials</option>{MATERIALS.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Source<select value={filters.source} onChange={event => patch("source", event.target.value)}><option value="">Field + demo</option><option value="field">Field only</option><option value="demo">Demo only</option></select></label>
      <label>From date<input type="date" value={filters.dateFrom} onChange={event => patch("dateFrom", event.target.value)} /></label>
      <label>To date<input type="date" value={filters.dateTo} onChange={event => patch("dateTo", event.target.value)} /></label>
    </div>
    <div className="actions exportActions"><button onClick={() => exportReportsCsv(filteredReports)}>Export observations CSV</button><button onClick={() => exportReportsJson(filteredReports)}>Export JSON</button><button onClick={() => exportHotspotsCsv(areas.map(area => ({ name: area.name || `${area.latitude.toFixed(3)}, ${area.longitude.toFixed(3)}`, reports: area.reports.length, items: area.itemCount, dominantMaterial: area.dominantMaterial, dominantPackaging: area.dominantPackaging, dominantShare: area.dominantShare, priority: area.level, latitude: area.latitude, longitude: area.longitude })))}>Export hotspots CSV</button></div>
  </div>;
}

function HotspotRanking({ areas, onSelect }: { areas: AreaCluster[]; onSelect: (area: AreaCluster) => void }) {
  return <section className="card hotspotCard"><div className="rowBetween"><div><div className="eyebrowDark">PRIORITY HOTSPOTS</div><h2>Where should we act first?</h2><p className="muted">Ranked by marker density, observed items, and concentration of the leading waste stream.</p></div><span className="hotspotMethod">Transparent score</span></div><div className="hotspotList">{areas.slice(0, 5).map((area, index) => <button className="hotspotRow" onClick={() => onSelect(area)} key={area.key}><b>#{index + 1}</b><span><strong>{area.name || `${area.latitude.toFixed(3)}, ${area.longitude.toFixed(3)}`}</strong><small>{area.reports.length} markers · {area.itemCount} items · {area.dominantShare}% {area.dominantMaterial}</small></span><em className={`priorityBadge priority${area.level}`}>{area.level} · {area.priorityScore}</em></button>)}</div></section>;
}

function AreaProfile({ area, intervention }: { area: AreaCluster; intervention?: Intervention }) {
  const plan = areaPlan(area);
  const metrics = interventionMetrics(area, intervention);
  const location = area.name || `${area.latitude.toFixed(3)}, ${area.longitude.toFixed(3)}`;
  return <section className="card areaProfile"><div className="areaPlanHeader"><div><div className="eyebrowDark">AREA PROFILE</div><h2>{location}</h2><p>Observed waste DNA and an evidence-based next action for this specific area.</p></div><span className={`priorityBadge priority${area.level}`}>{area.level} PRIORITY</span></div><div className="areaEvidence"><span><b>{area.priorityScore}</b>priority score</span><span><b>{area.reports.length}</b>report markers</span><span><b>{area.itemCount}</b>waste items</span><span><b>{area.dominantShare}%</b>{area.dominantMaterial}</span></div><div className="planGrid"><div><h3>Waste DNA</h3><p>Leading material: <b>{area.dominantMaterial}</b><br />Leading format: <b>{area.dominantPackaging}</b></p><p>{plan.actions}</p></div><div className="machineCard"><span>RECOMMENDED RESPONSE</span><h3>{plan.machine}</h3><p>{plan.title}</p></div></div>{intervention && <div className="impactStrip"><strong>Intervention: {intervention.option}</strong><span>Deployed {intervention.deployedAt}</span>{metrics && <span>30-day baseline: {metrics.beforeReports} markers / {metrics.beforeItems} items · after: {metrics.afterReports} markers / {metrics.afterItems} items</span>}</div>}</section>;
}

function correctionSummary(original: WasteReport, corrected: WasteReport) {
  const changes: string[] = [];
  if ((original.locationName || "") !== (corrected.locationName || "")) changes.push("Location name corrected");
  if (original.latitude !== corrected.latitude || original.longitude !== corrected.longitude) changes.push("Coordinates corrected");
  corrected.items.forEach((item, index) => {
    const before = original.items[index];
    if (!before) return changes.push(`Item ${index + 1} added`);
    if (before.brand !== item.brand) changes.push(`Item ${index + 1} brand corrected`);
    if (before.category !== item.category) changes.push(`Item ${index + 1} category corrected`);
    if (before.packagingType !== item.packagingType) changes.push(`Item ${index + 1} packaging corrected`);
    if (before.likelyMaterial !== item.likelyMaterial) changes.push(`Item ${index + 1} likely material corrected`);
  });
  return changes;
}

function ReviewQueue({ reports, reviewerEmail, onChanged }: { reports: WasteReport[]; reviewerEmail: string; onChanged?: () => void }) {
  const [busyId, setBusyId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, WasteReport>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const quality = useMemo(() => analyzeReportQuality(reports), [reports]);
  const pending = reports.filter(report => !report.reviewStatus).slice(0, 12);

  const openReport = (report: WasteReport) => {
    if (expandedId === report.id) return setExpandedId(null);
    setDrafts(current => ({ ...current, [report.id]: { ...report, items: report.items.map(item => ({ ...item })) } }));
    setExpandedId(report.id);
  };
  const patchDraft = (report: WasteReport, patch: Partial<WasteReport>) => setDrafts(current => ({ ...current, [report.id]: { ...(current[report.id] || report), ...patch } }));
  const patchDraftItem = (report: WasteReport, itemId: string, key: keyof WasteReport["items"][number], value: string) => {
    const draft = drafts[report.id] || report;
    patchDraft(report, { items: draft.items.map(item => item.id === itemId ? { ...item, [key]: value } : item) });
  };
  const decide = async (original: WasteReport, decision: "approved" | "rejected") => {
    const corrected = drafts[original.id] || original;
    const reviewedAt = new Date().toISOString();
    const audit = { id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, decision, reviewerEmail, reviewedAt, note: notes[original.id]?.trim() || undefined, changes: decision === "approved" ? correctionSummary(original, corrected) : [] };
    const reviewed = { ...(decision === "approved" ? corrected : original), reviewStatus: decision, reviewedAt, reviewHistory: [...(original.reviewHistory || []), audit] } as WasteReport;
    setBusyId(original.id);
    try { await replaceReports(reports.map(report => report.id === original.id ? reviewed : report)); onChanged?.(); setExpandedId(null); }
    finally { setBusyId(""); }
  };

  return <section className="card reviewQueue"><div className="rowBetween"><div><div className="eyebrowDark">HUMAN REVIEW</div><h2>Quality review queue</h2><p className="muted">Compare evidence, correct standardized fields when needed, and record a defensible decision.</p></div><span className="reviewCount">{pending.length} shown</span></div><div className="reviewGuidance"><b>Approve only when:</b> the evidence supports the category, packaging, and likely material; the location is plausible; and duplicate concerns are resolved. An approved report earns {APPROVED_REPORT_POINTS} points only when average AI confidence is at least 80%.</div>{pending.length ? <div className="reviewList">{pending.map(report => { const result = quality.get(report.id); const expanded = expandedId === report.id; const draft = drafts[report.id] || report; const evidenceUrl = report.imagePath ? `/api/evidence?path=${encodeURIComponent(report.imagePath)}` : report.imagePreview; const contributor = report.reporterUsername ? `@${report.reporterUsername}` : report.source === "demo" ? "demo contributor" : "legacy contributor"; return <article className={expanded ? "reviewExpanded" : ""} key={report.id}><div className="reviewSummary"><div><strong>{report.locationName || "Unnamed location"}</strong><small>{new Date(report.createdAt).toLocaleString()} · submitted by {contributor} · {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}</small><div className="issueTags"><span>Awaiting reviewer</span>{report.reporterId && report.source !== "demo" && <span>{rewardPointsForReport(report) ? `${rewardPointsForReport(report)} points if approved` : "No points · low AI confidence"}</span>}{result?.issues.map(issue => <span key={issue}>{issue}</span>)}</div></div><button onClick={() => openReport(report)}>{expanded ? "Hide evidence" : "Review and correct"}</button></div>{expanded && <div className="reviewEvidence"><div className="evidencePhoto">{evidenceUrl ? <img src={evidenceUrl} alt={`Evidence from ${report.locationName || "the observation"}`} /> : <p>No evidence thumbnail exists for this demo/older report.</p>}</div><div className="evidenceDetails"><h3>Correct before approval</h3><div className="correctionLocation"><label>Location name<input value={draft.locationName || ""} onChange={event => patchDraft(report, { locationName: event.target.value })} /></label><label>Latitude<input type="number" step="0.00001" value={draft.latitude} onChange={event => patchDraft(report, { latitude: Number(event.target.value) })} /></label><label>Longitude<input type="number" step="0.00001" value={draft.longitude} onChange={event => patchDraft(report, { longitude: Number(event.target.value) })} /></label></div>{draft.items.map((item, index) => <div className="correctionItem" key={item.id}><b>Item {index + 1} · AI confidence {Math.round(item.confidence * 100)}%</b><label>Brand<input value={item.brand} onChange={event => patchDraftItem(report, item.id, "brand", event.target.value)} /></label><label>Category<select value={item.category} onChange={event => patchDraftItem(report, item.id, "category", event.target.value)}>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label><label>Packaging<select value={item.packagingType} onChange={event => patchDraftItem(report, item.id, "packagingType", event.target.value)}>{PACKAGING_TYPES.map(value => <option key={value}>{value}</option>)}</select></label><label>Likely material<select value={item.likelyMaterial} onChange={event => patchDraftItem(report, item.id, "likelyMaterial", event.target.value)}>{MATERIALS.map(value => <option key={value}>{value}</option>)}</select></label></div>)}<label>Review note / rejection reason<textarea value={notes[report.id] || ""} onChange={event => setNotes(current => ({ ...current, [report.id]: event.target.value }))} placeholder="Explain uncertainty, corrections, or why the evidence was rejected." /></label><div className="reviewActions"><button className="primary" disabled={busyId === report.id} onClick={() => void decide(report, "approved")}>Save corrections and approve</button><button className="danger" disabled={busyId === report.id} onClick={() => void decide(report, "rejected")}>Reject observation</button></div></div></div>}</article>; })}</div> : <p className="reviewEmpty">No reports currently need review.</p>}</section>;
}

function AuditHistory({ reports }: { reports: WasteReport[] }) {
  const entries = reports.flatMap(report => (report.reviewHistory || []).map(entry => ({ ...entry, reportId: report.id, location: report.locationName || "Unnamed location" }))).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt)).slice(0, 20);
  return <section className="card auditCard"><div className="eyebrowDark">REVIEW AUDIT</div><h2 className="sectionTitle">Who validated the data?</h2><p className="muted">The latest reviewer decisions and corrections remain attached to their reports.</p>{entries.length ? <div className="auditList">{entries.map(entry => <article key={entry.id}><span className={`auditDecision audit${entry.decision}`}>{entry.decision}</span><div><strong>{entry.location}</strong><small>{entry.reviewerEmail} · {new Date(entry.reviewedAt).toLocaleString()}</small>{entry.changes.length > 0 && <p>{entry.changes.join("; ")}</p>}{entry.note && <p>Note: {entry.note}</p>}</div></article>)}</div> : <p className="reviewEmpty">No reviewer decisions recorded yet.</p>}</section>;
}

function TimeTrends({ reports }: { reports: WasteReport[] }) {
  const data = useMemo(() => {
    const days = new Map<string, { date: string; reports: number; items: number }>();
    for (const report of reports) {
      const date = report.createdAt.slice(0, 10);
      const row = days.get(date) || { date, reports: 0, items: 0 };
      row.reports += 1; row.items += report.items.length; days.set(date, row);
    }
    return [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  }, [reports]);
  return <section className="card"><div className="eyebrowDark">TIME TREND</div><h2 className="sectionTitle">Are conditions changing?</h2><p className="muted">Last 30 observed days within the current filters. Compare similar survey effort before interpreting changes as improvement.</p><div style={{ width: "100%", height: 300 }}><ResponsiveContainer><LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={value => String(value).slice(5)} /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="reports" stroke="#0f766e" strokeWidth={3} name="Report markers" /><Line type="monotone" dataKey="items" stroke="#d97706" strokeWidth={2} name="Waste items" /></LineChart></ResponsiveContainer></div></section>;
}

function ActionCenter({ areas, interventions, onDeploy, canReview }: { areas: AreaCluster[]; interventions: Intervention[]; onDeploy: (area: AreaCluster, option: string, deployedAt: string) => void; canReview: boolean }) {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedAreaKey, setSelectedAreaKey] = useState<string | null>(null);
  const [deploymentDate, setDeploymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const topArea = areas.find(area => area.key === selectedAreaKey) || areas[0];
  const plan = topArea ? areaPlan(topArea) : null;
  if (!topArea || !plan) return <section className="stack"><div className="card emptyAction"><div className="eyebrowDark">ACTION CENTER</div><h2>Collect enough observations to choose an action</h2><p>Confirm reports from the same area first. EcoDNA will then rank suspected hotspots and offer action paths with visible evidence.</p></div></section>;

  const readyForMachine = topArea.reports.length >= 3 && topArea.itemCount >= 5 && topArea.dominantShare >= 40;
  const location = topArea.name || `${topArea.latitude.toFixed(3)}, ${topArea.longitude.toFixed(3)}`;
  const options = [
    { label: "Option 1 - Deploy targeted equipment", status: readyForMachine ? "Recommended" : "Needs more evidence", title: plan.machine, text: readyForMachine ? plan.title : "Do not commit to permanent equipment yet. Start with validation until this area has a clearer observed waste stream.", details: [`Why now: this area has ${topArea.reports.length} markers, ${topArea.itemCount} observed items, and ${topArea.dominantShare}% ${topArea.dominantMaterial}.`, "Confirm an operator, power or placement requirements, maintenance ownership, and a signed pickup agreement before installation.", "Run a 30-day supervised pilot first; record daily throughput, contamination, downtime, and servicing cost.", "Scale only if the machine captures the intended stream without creating overflow or unsafe queues."] },
    { label: "Option 2 - Improve collection and behavior", status: "Operational intervention", title: "Improve the local collection system", text: plan.actions, details: ["Audit the nearest bins, vendor points, and pedestrian routes to identify where disposal access is failing.", "Place clearly labelled collection points at the leakage source, not only at a distant recycling station.", "Assign pickup frequency and ownership, then brief vendors, cleaners, or local partners on the material stream.", "Use a short incentive, signage test, or vendor commitment and compare litter observations after two weeks."] },
    { label: "Option 3 - Validate and measure", status: "Evidence-first intervention", title: "Run a before/after measurement cycle", text: plan.measure, details: ["Repeat observations at the same locations, days, and time windows to reduce collection-effort bias.", "Set a baseline for report markers, item count, dominant material share, and contamination before intervening.", "Run the selected intervention for 2-4 weeks, then collect the same measurements again.", "Use the change in litter count and material mix to decide whether to scale, adapt, or stop the intervention."] }
  ];
  const selected = selectedOption === null ? null : options[selectedOption];
  const intervention = interventions.find(entry => entry.areaKey === topArea.key);
  return <section className="stack">
    <div className="areaChooser"><label>Action Center area<select value={topArea.key} onChange={event => { setSelectedAreaKey(event.target.value); setSelectedOption(null); }}><option value="">Select a hotspot</option>{areas.slice(0, 10).map(area => <option value={area.key} key={area.key}>{area.name || `${area.latitude.toFixed(3)}, ${area.longitude.toFixed(3)}`} — {area.level}</option>)}</select></label></div>
    <div className="actionHero"><div><div className="eyebrow">ACTION CENTER</div><h2>Choose the next move for {location}</h2><p>Highest observed area: {topArea.reports.length} report markers, {topArea.itemCount} items, and {topArea.dominantShare}% {topArea.dominantMaterial}.</p></div><div className={`priorityBadge priority${topArea.level}`}>{topArea.level} PRIORITY</div></div>
    <p className="muted actionDisclaimer">This ranking is based on observation density. Compare repeated surveys at similar times before treating it as a population-normalized waste rate.</p>
    <div className="decisionGrid">{options.map((option, index) => <article className={`decisionCard ${index === 0 && readyForMachine ? "decisionRecommended" : ""}`} key={option.label}><span>{option.label}</span><div className="decisionStatus">{option.status}</div><h3>{option.title}</h3><p>{option.text}</p><button className="detailButton" onClick={() => setSelectedOption(selectedOption === index ? null : index)} aria-expanded={selectedOption === index}>{selectedOption === index ? "Hide detailed plan" : "View detailed plan"}</button></article>)}</div>
    {selected && <section className="detailCard" aria-live="polite"><div><div className="eyebrowDark">DETAILED PLAN</div><h3>{selected.title}</h3><p>{selected.text}</p>{canReview ? <><label className="deploymentField">Deployment date<input type="date" value={deploymentDate} onChange={event => setDeploymentDate(event.target.value)} /></label><button className="primary" onClick={() => onDeploy(topArea, selected.title, deploymentDate)}>Mark intervention deployed</button></> : <p className="roleNotice">Reviewer approval is required to deploy this intervention.</p>}</div><ol>{selected.details.map(detail => <li key={detail}>{detail}</li>)}</ol></section>}
    <AreaProfile area={topArea} intervention={intervention} />
    {areas.length > 1 && <div className="card"><h3>Other areas to assess next</h3><div className="areaRanking">{areas.slice(1, 6).map((area, index) => <span key={area.key}>#{index + 2} {area.name || `${area.latitude.toFixed(2)}, ${area.longitude.toFixed(2)}`} - {area.reports.length} reports - {area.dominantMaterial}</span>)}</div></div>}
  </section>;
}

export default function Dashboard({ reports, mode = "data", onReportsChanged, canReview = false, reviewerEmail = "" }: { reports: WasteReport[]; mode?: "data" | "actions"; onReportsChanged?: () => void; canReview?: boolean; reviewerEmail?: string }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [profileArea, setProfileArea] = useState<AreaCluster | null>(null);
  const [dashboardStatus, setDashboardStatus] = useState("");
  useEffect(() => { void loadInterventions().then(setInterventions).catch(error => setDashboardStatus(error instanceof Error ? error.message : "Could not load interventions.")); }, []);
  const deployIntervention = async (area: AreaCluster, option: string, deployedAt: string) => {
    if (!canReview) return;
    const createdAt = new Date().toISOString();
    const entry: Intervention = { id: `intervention-${area.key.replace(/[^a-z0-9]+/gi, "-")}`, areaKey: area.key, areaName: area.name || `${area.latitude.toFixed(3)}, ${area.longitude.toFixed(3)}`, option, deployedAt, createdAt };
    try { setInterventions(await saveIntervention(entry)); setDashboardStatus("Intervention shared with the team."); }
    catch (error) { setDashboardStatus(error instanceof Error ? error.message : "Could not save intervention."); }
  };
  const decisionReports = useMemo(() => reports.filter(report => report.reviewStatus === "approved"), [reports]);
  const pendingReports = reports.filter(report => !report.reviewStatus).length;
  const filteredReports = useMemo(() => filterReports(decisionReports, filters), [decisionReports, filters]);
  const areas = useMemo(() => clusterAreas(filteredReports), [filteredReports]);
  const items = filteredReports.flatMap(report => report.items);
  const total = items.length;
  const materials = countBy(filteredReports, item => item.likelyMaterial);
  const packaging = countBy(filteredReports, item => item.packagingType);
  const categories = countBy(filteredReports, item => item.category);
  const brands = countBy(filteredReports, item => item.brand).filter(row => row.name.toLowerCase() !== "unknown").slice(0, 6);
  const dominantMaterial = materials[0]?.name || "No data";
  const dominantPackaging = packaging[0]?.name || "No data";
  const dominantCategory = categories[0]?.name || "No data";
  const hotspot = areas[0]?.level || "LOW";
  const demoReports = filteredReports.filter(report => report.source === "demo").length;
  const quality = useMemo(() => analyzeReportQuality(filteredReports), [filteredReports]);
  const lowConfidence = [...quality.values()].filter(item => item.confidence === "low").length;
  const duplicates = [...quality.values()].filter(item => item.issues.includes("Possible duplicate")).length;
  const missingNames = [...quality.values()].filter(item => item.issues.includes("Missing place name")).length;
  const outsideBounds = [...quality.values()].filter(item => item.issues.includes("Outside Jakarta survey bounds")).length;

  return <section className="stack">
    {dashboardStatus && <p className="status">{dashboardStatus}</p>}
    <FiltersPanel filters={filters} setFilters={setFilters} reports={decisionReports} filteredReports={filteredReports} areas={areas} />
    {pendingReports > 0 && <div className="notice">{pendingReports} submitted observation{pendingReports === 1 ? " is" : "s are"} awaiting reviewer approval and excluded from Waste DNA, hotspot rankings, trends, and actions.</div>}
    {mode === "actions" ? <ActionCenter areas={areas} interventions={interventions} onDeploy={deployIntervention} canReview={canReview} /> : <>
      <div className="kpis"><div className="kpi"><span>Confirmed reports</span><strong>{filteredReports.length}</strong></div><div className="kpi"><span>Waste items observed</span><strong>{total}</strong></div><div className="kpi"><span>Dominant material</span><strong className="kpiText">{dominantMaterial}</strong></div><div className="kpi"><span>Hotspot signal</span><strong>{hotspot}</strong></div></div>
      {areas.length > 0 && <HotspotRanking areas={areas} onSelect={setProfileArea} />}
      {profileArea && areas.some(area => area.key === profileArea.key) && <AreaProfile area={areas.find(area => area.key === profileArea.key) || profileArea} intervention={interventions.find(entry => entry.areaKey === profileArea.key)} />}
      {canReview ? <><ReviewQueue reports={reports} reviewerEmail={reviewerEmail} onChanged={onReportsChanged} /><AuditHistory reports={reports} /></> : <div className="card roleGate"><div className="eyebrowDark">HUMAN REVIEW</div><h2>Reviewer access required</h2><p className="muted">You can submit observations, but only an authorized reviewer can approve or reject evidence.</p></div>}
      <TimeTrends reports={filteredReports} />
      {demoReports > 0 && <div className="notice" role="status">Demo/sample data is included in {demoReports} of {filteredReports.length} report{filteredReports.length === 1 ? "" : "s"}. Use it to demonstrate the flow, not as field evidence.</div>}
      <div className="qualityCard"><div><div className="eyebrowDark">DATA QUALITY</div><h2>Reports needing review are red on the map</h2><p>High confidence means average AI confidence is at least 80%. Duplicate, unnamed, or out-of-bounds reports are also flagged red.</p></div><div className="qualityStats"><span><b>{lowConfidence}</b> low confidence</span><span><b>{duplicates}</b> possible duplicates</span><span><b>{missingNames}</b> missing names</span><span><b>{outsideBounds}</b> outside bounds</span></div></div>
      <div className="dnaHero"><div><div className="eyebrowDark">AREA WASTE DNA</div><h2>{dominantPackaging} / {dominantMaterial}</h2><p>{total ? <>Dominant category: <b>{dominantCategory}</b>. Based on {total} confirmed waste item{total === 1 ? "" : "s"}.</> : "Adjust filters, confirm observations, or load demo data to generate a local Waste DNA."}</p></div>{materials[0] && <div className="dnaScore"><strong>{pct(materials[0].value, total)}%</strong><span>of observed items are {dominantMaterial}</span></div>}</div>
      <div className="grid2"><div className="card"><h3>Material Composition</h3><p className="muted">Standardized material categories make reports directly comparable.</p><div className="rankList">{materials.map(row => <div className="rankRow" key={row.name}><div className="rankLabel"><span>{row.name}</span><b>{pct(row.value, total)}%</b></div><div className="barTrack"><div className="barFill" style={{ width: `${pct(row.value, total)}%` }} /></div></div>)}</div></div><div className="card"><h3>Packaging Format</h3><p className="muted">How the waste physically appears.</p><div style={{ width: "100%", height: 300 }}><ResponsiveContainer><BarChart data={packaging}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" angle={-18} textAnchor="end" height={70} /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="value" fill="#0f766e" /></BarChart></ResponsiveContainer></div></div></div>
      <div className="card"><h3>Product Categories</h3><div className="tags">{categories.map(row => <span className="tag" key={row.name}>{row.name}: {row.value} ({pct(row.value, total)}%)</span>)}</div></div>
      <div className="card"><h3>Verified Brand Observations</h3><p className="muted">Unknown brands are excluded to avoid overstating AI recognition.</p>{brands.length ? <div className="tags">{brands.map(brand => <span className="tag" key={brand.name}>{brand.name}: {brand.value}</span>)}</div> : <p className="muted">No verified brand observations yet.</p>}</div>
      <div className="card"><h3>Waste Map</h3><p className="muted">Teal markers pass current quality checks. Red markers need review. Use the confidence toggle to isolate them.</p><MapPanel reports={filteredReports} /></div>
    </>}
  </section>;
}
