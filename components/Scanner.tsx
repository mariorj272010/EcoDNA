"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { WasteItem, WasteReport } from "@/lib/types";
import { saveReportToServer } from "@/lib/storage";
import { CATEGORIES, PACKAGING_TYPES, MATERIALS } from "@/lib/taxonomy";

const LocationPicker = dynamic(() => import("./LocationPicker"), { ssr: false });

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function createEvidenceThumbnail(file: File): Promise<Blob> {
  const source = await createImageBitmap(file);
  const scale = Math.min(1, 560 / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));
  canvas.getContext("2d")?.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not compress the evidence photo.")), "image/jpeg", 0.68));
}

function SelectField({
  label, value, options, onChange
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

export default function Scanner({ onSaved }: { onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [items, setItems] = useState<WasteItem[]>([]);
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationName, setLocationName] = useState("");

  const canSubmit = useMemo(() => items.length > 0 && !!coords && !!file && !saving, [items, coords, file, saving]);

  function chooseFile(next: File | null) {
    setFile(next);
    setItems([]);
    setStatus("");
    if (!next) {
      setPreview("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result || ""));
    reader.readAsDataURL(next);
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setStatus("Analyzing image...");
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Analysis failed.");

      const normalized: WasteItem[] = (json.items || []).map((x: any) => ({
        id: uid("item"),
        brand: x.brand || "Unknown",
        category: x.category || "Other",
        packagingType: x.packagingType || "Other",
        likelyMaterial: x.likelyMaterial || "Unknown",
        confidence: Number.isFinite(Number(x.confidence)) ? Number(x.confidence) : 0
      }));

      setItems(normalized);
      setStatus(normalized.length ? `Detected ${normalized.length} item(s). Please verify.` : "No clear discarded packaging detected.");
    } catch (e: any) {
      setStatus(e.message || "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  function captureLocation() {
    setStatus("Requesting location...");
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setStatus("Location captured.");
      },
      error => {
        const message = error.code === error.PERMISSION_DENIED
          ? "Location permission was blocked. Allow location access using the control beside the browser address bar, then try again."
          : "Location unavailable. Check your connection or device location services, then try again.";
        setStatus(message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function patchItem(id: string, key: keyof WasteItem, value: string | number) {
    setItems(current => current.map(i => i.id === id ? { ...i, [key]: value } : i));
  }

  function removeItem(id: string) {
    setItems(current => current.filter(i => i.id !== id));
  }

  function addManualItem() {
    setItems(current => [...current, {
      id: uid("item"),
      brand: "Unknown",
      category: "Other",
      packagingType: "Other",
      likelyMaterial: "Unknown",
      confidence: 1
    }]);
  }

  async function confirm() {
    if (!coords || !file) return;
    setSaving(true);
    try {
      setStatus("Compressing and securely uploading evidence...");
      const reportId = uid("report");
      const evidenceForm = new FormData();
      evidenceForm.append("evidence", await createEvidenceThumbnail(file), "evidence.jpg");
      evidenceForm.append("reportId", reportId);
      const evidenceResponse = await fetch("/api/evidence", { method: "POST", body: evidenceForm });
      const evidencePayload = await evidenceResponse.json() as { path?: string; error?: string };
      if (!evidenceResponse.ok || !evidencePayload.path) throw new Error(evidencePayload.error || "Could not store the evidence photo.");
      const report: WasteReport = { id: reportId, createdAt: new Date().toISOString(), latitude: coords.latitude, longitude: coords.longitude, locationName: locationName.trim() || undefined, imagePath: evidencePayload.path, source: "field", items };
      await saveReportToServer(report);
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Could not save this report.");
      return;
    } finally {
      setSaving(false);
    }
    setStatus("Report submitted for independent reviewer approval. It will enter Waste DNA only after approval.");
    setFile(null);
    setPreview("");
    setItems([]);
    setCoords(null);
    setLocationName("");
    onSaved();
  }

  return (
    <section className="stack">
      <div className="card">
        <h2>1. Capture litter</h2>
        <p className="muted">Use your phone camera or upload an existing image. A small compressed evidence thumbnail is stored with the verified structured result for later human review.</p>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={e => chooseFile(e.target.files?.[0] || null)}
        />
        {preview && <img className="preview" src={preview} alt="Litter preview" />}
        <div className="actions">
          <button className="primary" disabled={!file || loading} onClick={analyze}>
            {loading ? "Analyzing..." : "Analyze with AI"}
          </button>
          <button onClick={captureLocation}>Capture Location</button>
        </div>
        {coords && <p className="success">Location: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</p>}
        <div className="locationSection">
          <div className="rowBetween">
            <div>
              <h3>Choose the observation location</h3>
              <p className="muted">Use device GPS above or click the map to place and adjust the marker manually.</p>
            </div>
            {coords && <button className="ghostDark" onClick={() => setCoords(null)}>Clear pin</button>}
          </div>
          <LocationPicker
            coordinates={coords}
            onChange={coordinates => {
              setCoords(coordinates);
              setStatus("Manual map location selected.");
            }}
          />
          <label>
            Place or address name (recommended)
            <input
              value={locationName}
              onChange={event => setLocationName(event.target.value)}
              placeholder="Example: Monas, Gambir, Central Jakarta"
            />
          </label>
        </div>
        {status && <p className="status">{status}</p>}
      </div>

      {items.length > 0 && (
        <div className="card">
          <div className="rowBetween">
            <div>
              <h2>2. Verify AI result</h2>
              <p className="muted">
                Category, packaging and material use fixed choices so the dashboard stays consistent. Likely material is a visual estimate, not chemical identification.
              </p>
            </div>
            <button onClick={addManualItem}>+ Add item</button>
          </div>

          <div className="stack">
            {items.map((item, idx) => (
              <div className="itemEditor" key={item.id}>
                <div className="rowBetween">
                  <strong>Item {idx + 1}</strong>
                  <span className="confidence">{Math.round(item.confidence * 100)}% AI confidence</span>
                </div>

                <div className="formGrid">
                  <label>
                    Brand
                    <input
                      value={item.brand}
                      onChange={e => patchItem(item.id, "brand", e.target.value)}
                      placeholder="Unknown"
                    />
                  </label>

                  <SelectField
                    label="Category"
                    value={item.category}
                    options={CATEGORIES}
                    onChange={value => patchItem(item.id, "category", value)}
                  />

                  <SelectField
                    label="Packaging"
                    value={item.packagingType}
                    options={PACKAGING_TYPES}
                    onChange={value => patchItem(item.id, "packagingType", value)}
                  />

                  <SelectField
                    label="Likely material"
                    value={item.likelyMaterial}
                    options={MATERIALS}
                    onChange={value => patchItem(item.id, "likelyMaterial", value)}
                  />
                </div>

                <button className="danger" onClick={() => removeItem(item.id)}>Remove</button>
              </div>
            ))}
          </div>

          <button className="primary wide" disabled={!canSubmit} onClick={confirm}>
            {saving ? "Uploading evidence..." : "Confirm Report"}
          </button>
          {!coords && <p className="muted">Capture location before confirming.</p>}
        </div>
      )}
    </section>
  );
}
