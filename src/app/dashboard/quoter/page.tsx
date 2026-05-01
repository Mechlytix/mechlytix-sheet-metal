"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { parseDXFGeometry } from "@/lib/dxf/parse-dxf";
import { calculatePrice } from "@/lib/pricing/cost-model";
import { getFeedRateWithCustom } from "@/lib/pricing/feed-rates";
import { formatCurrency, formatLength } from "@/lib/units";
import type { PricingGeometry, PricingResult, DXFIntent } from "@/lib/pricing/types";
import type { Material, MachineProfile } from "@/lib/types/database";
import { DxfViewer } from "@/components/DxfViewer";

// ─────────────────────────────────────────────────────────
// /dashboard/quoter — Unified STEP / DXF Instant Quoter
// ─────────────────────────────────────────────────────────

interface RemnantMatch {
  id: string;
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  location: string | null;
  material_id: string | null;
  materials: { name: string; color_hex: string | null } | null;
}

type Phase =
  | { name: "idle" }
  | { name: "analyzing"; filename: string }
  | { name: "ready"; geometry: PricingGeometry; filename: string }
  | { name: "saving" }
  | { name: "saved"; quoteId: string };

// ─── File Drop Zone ───────────────────────────────────────

function DropZone({
  onFile,
  busy,
}: {
  onFile: (file: File) => void;
  busy: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div
      className={`drop-zone ${drag ? "drag-over" : ""} ${busy ? "busy" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      onClick={() => !busy && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".step,.stp,.dxf"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
      <div className="dz-icon">
        {busy ? (
          <span className="dz-spinner" />
        ) : (
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        )}
      </div>
      <p className="dz-title">{busy ? "Analysing file…" : "Drop your part file here"}</p>
      <p className="dz-subtitle">
        <strong>STEP / STP</strong> — 3D model with bends detected<br />
        <strong>DXF</strong> — 2D flat pattern
      </p>
      {!busy && (
        <span className="dz-browse">or click to browse</span>
      )}
    </div>
  );
}

// ─── Geometry Card ────────────────────────────────────────

function GeometryCard({ geo, units }: { geo: PricingGeometry; units: string }) {
  const u = units as "metric" | "imperial";
  return (
    <div className="geo-card">
      <h3 className="geo-card-title">Extracted Geometry</h3>
      <div className="geo-grid">
        <div className="geo-item">
          <span className="geo-label">Flat Pattern</span>
          <span className="geo-value">
            {formatLength(geo.boundingWidth, u, 0)} × {formatLength(geo.boundingHeight, u, 0)}
          </span>
        </div>
        <div className="geo-item">
          <span className="geo-label">Cut Length</span>
          <span className="geo-value">{formatLength(geo.perimeter, u, 0)}</span>
        </div>
        <div className="geo-item">
          <span className="geo-label">Pierces</span>
          <span className="geo-value">{geo.pierceCount}</span>
        </div>
        <div className="geo-item">
          <span className="geo-label">Bends</span>
          <span className="geo-value">
            {geo.bendCount > 0
              ? `${geo.bendCount} (${geo.bendAngles.map((a) => `${Math.round(a)}°`).join(", ")})`
              : "—"}
          </span>
        </div>
        {geo.thickness > 0 && (
          <div className="geo-item">
            <span className="geo-label">Thickness</span>
            <span className={`geo-value ${geo.thicknessConfidence === "detected" ? "detected" : ""}`}>
              {formatLength(geo.thickness, u, 2)}
              {geo.thicknessConfidence === "detected" && (
                <span className="geo-auto-badge">auto</span>
              )}
            </span>
          </div>
        )}
        <div className="geo-item">
          <span className="geo-label">Input Type</span>
          <span className="geo-value uppercase">{geo.inputType}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Quote Breakdown Card ─────────────────────────────────

function QuoteBreakdown({
  result,
  filename,
  onSave,
  saving,
}: {
  result: PricingResult;
  filename: string;
  onSave: (customerName: string, notes: string) => void;
  saving: boolean;
}) {
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");

  const rows = [
    { label: "Material", value: result.materialCostPerPart, note: `${result.weightKg.toFixed(3)} kg` },
    { label: "Cutting", value: result.cuttingCostPerPart, note: `${result.cutTimeMinutes.toFixed(2)} min` },
    { label: "Bending", value: result.bendingCostPerPart, note: null },
    { label: "Setup (per part)", value: result.setupCostPerPart, note: null },
  ];

  return (
    <div className="quote-card">
      <div className="quote-card-header">
        <div>
          <p className="quote-card-filename">{filename}</p>
          <div className="quote-price-display">
            <span className="quote-unit-price">{formatCurrency(result.unitPrice)}</span>
            <span className="quote-per-part">/ part</span>
          </div>
          <p className="quote-total">
            Total ({Math.round(result.totalPrice / result.unitPrice)} parts):{" "}
            <strong>{formatCurrency(result.totalPrice)}</strong>
          </p>
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="quote-breakdown">
        <h4 className="quote-breakdown-title">Cost Breakdown</h4>
        {rows.map((row) => (
          <div key={row.label} className="breakdown-row">
            <span className="breakdown-label">{row.label}</span>
            {row.note && <span className="breakdown-note">{row.note}</span>}
            <span className="breakdown-value">{formatCurrency(row.value)}</span>
          </div>
        ))}
        <div className="breakdown-row net">
          <span className="breakdown-label">Net cost</span>
          <span className="breakdown-value">{formatCurrency(result.netCostPerPart)}</span>
        </div>
        <div className="breakdown-row markup">
          <span className="breakdown-label">Markup ({result.markupPercent}%)</span>
          <span className="breakdown-value">
            +{formatCurrency(result.unitPrice - result.netCostPerPart)}
          </span>
        </div>
        <div className="breakdown-row total-row">
          <span className="breakdown-label">Unit Price</span>
          <span className="breakdown-value highlight">{formatCurrency(result.unitPrice)}</span>
        </div>
      </div>

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="quote-warnings">
          {result.warnings.map((w, i) => (
            <p key={i} className="quote-warning">⚠ {w}</p>
          ))}
        </div>
      )}

      {/* Save quote */}
      <div className="quote-save-section">
        <div className="form-field">
          <label>Customer Name (optional)</label>
          <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Acme Engineering" />
        </div>
        <div className="form-field">
          <label>Notes (optional)</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="2.0mm CR4, Qty 25, by 30 April" />
        </div>
        <button
          className="btn-primary"
          onClick={() => onSave(customer, notes)}
          disabled={saving}
        >
          {saving ? "Saving…" : "💾 Save Quote"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Quoter Page ─────────────────────────────────────

export default function QuoterPage() {
  const { units } = useDashboard();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [geometry, setGeometry] = useState<PricingGeometry | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [savedFilename, setSavedFilename] = useState("");

  // Config state
  const [materials, setMaterials] = useState<Material[]>([]);
  const [machines, setMachines]   = useState<MachineProfile[]>([]);
  const [userId, setUserId]       = useState<string | null>(null);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [selectedMachineId, setSelectedMachineId]   = useState<string>("");
  const [quantity, setQuantity]     = useState(1);
  const [markup, setMarkup]         = useState(15);
  const [thicknessInput, setThicknessInput] = useState(""); // DXF only
  const [usingRemnant, setUsingRemnant]     = useState(false); // no waste when using remnant

  // DXF state
  const [layerIntents, setLayerIntents] = useState<Record<string, DXFIntent>>({});
  const [pathIntents, setPathIntents] = useState<Record<string, DXFIntent>>({});
  const [manualBendCount, setManualBendCount] = useState<number | null>(null);

  // Remnant check results
  const [remnantMatches, setRemnantMatches]   = useState<RemnantMatch[]>([]);
  const [remnantDismissed, setRemnantDismissed] = useState(false);

  // Computed result
  const [result, setResult] = useState<PricingResult | null>(null);

  // Load materials + machines + user + defaults
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [{ data: mats }, { data: machs }, { data: settings }] = await Promise.all([
        supabase.from("materials").select("*").or(`is_system.eq.true,user_id.eq.${user.id}`).order("category").order("name"),
        supabase.from("machine_profiles").select("*").or(`is_system.eq.true,user_id.eq.${user.id}`).order("name"),
        supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      setMaterials(mats ?? []);
      setMachines(machs ?? []);

      // Apply saved defaults
      if (settings) {
        setMarkup(settings.default_markup_percent ?? 15);
      }

      if (mats && mats.length > 0) setSelectedMaterialId(mats[0].id);
      if (machs && machs.length > 0) {
        const def = machs.find((m) => m.is_default) ?? machs[0];
        setSelectedMachineId(def.id);
      }
    }
    load();
  }, []);

  // Compute effective geometry (DXF layers affect perimeter and pierces)
  const effectiveGeometry = useMemo(() => {
    if (!geometry) return null;
    if (geometry.inputType !== "dxf" || !geometry.dxfData) return geometry;

    let newPerimeter = 0;
    let newPierceCount = 0;
    let autoBendCount = 0;

    geometry.dxfData.paths.forEach(p => {
      const intent = pathIntents[p.id] || layerIntents[p.layer] || "cut";
      if (intent === "cut") {
        newPerimeter += p.length;
        newPierceCount++;
      } else if (intent === "bend") {
        autoBendCount++;
      }
    });
    
    return {
      ...geometry,
      perimeter: newPerimeter,
      pierceCount: newPierceCount,
      bendCount: manualBendCount !== null ? manualBendCount : autoBendCount,
    };
  }, [geometry, layerIntents, pathIntents, manualBendCount]);

  // Re-compute price whenever inputs change
  useEffect(() => {
    if (!effectiveGeometry || (phase.name !== "ready" && phase.name !== "saving")) { 
      setResult(null); 
      return; 
    }

    const mat  = materials.find((m) => m.id === selectedMaterialId);
    const mach = machines.find((m)  => m.id === selectedMachineId);
    if (!mat || !mach) return;

    const geo  = effectiveGeometry;
    let thickMm: number;
    if (geo.thicknessConfidence === "detected") {
      thickMm = geo.thickness;
    } else {
      const parsed = parseFloat(thicknessInput);
      if (isNaN(parsed) || parsed <= 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setResult(null);
        return;
      }
      thickMm = parsed;
    }

    const feedRate = getFeedRateWithCustom(mach.feed_rates, mat.category, thickMm, mach.power_kw ?? 4);

    const r = calculatePrice({
      geometry: { ...geo, thickness: thickMm },
      materialCostPerKg:  mat.cost_per_kg,
      materialDensityKgM3: mat.density_kg_m3,
      scrapValuePerKg:    mat.scrap_value_per_kg ?? 0,
      machineHourlyRate:  mach.hourly_rate,
      feedRateMmPerMin:   feedRate,
      pierceTimeSeconds:  mach.pierce_time_seconds ?? 0.5,
      setupTimeMinutes:   mach.setup_time_minutes ?? 15,
      costPerBend:        mach.cost_per_bend ?? 2.5,
      quantity,
      markupPercent: markup,
      wasteFactor: usingRemnant ? 1.0 : 1.15,
    });
    setResult(r);
  }, [phase, effectiveGeometry, selectedMaterialId, selectedMachineId, quantity, markup, thicknessInput, materials, machines, usingRemnant]);

  // Check scrap rack for remnants
  useEffect(() => {
    if (!effectiveGeometry || !userId || phase.name !== "ready") {
      setRemnantMatches([]);
      setRemnantDismissed(false);
      return;
    }
    const { boundingWidth, boundingHeight } = effectiveGeometry;
    if (!boundingWidth || !boundingHeight) return;

    const supabase = createClient();
    supabase
      .from("remnants")
      .select("id, width_mm, height_mm, thickness_mm, location, material_id, materials(name, color_hex)")
      .eq("user_id", userId)
      .eq("status", "available")
      .gte("width_mm", boundingWidth)
      .gte("height_mm", boundingHeight)
      .order("width_mm", { ascending: true })
      .limit(3)
      .then(({ data }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setRemnantMatches((data as any[]) ?? []);
      });
  }, [effectiveGeometry, userId, phase.name]);


  // Handle file drop
  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["step", "stp", "dxf"].includes(ext)) {
      alert("Please drop a STEP (.step, .stp) or DXF (.dxf) file.");
      return;
    }

    setPhase({ name: "analyzing", filename: file.name });
    setSourceFile(file);

    try {
      let geo: PricingGeometry;

      if (ext === "dxf") {
        const text = await file.text();
        geo = parseDXFGeometry(text);
        if (geo.dxfData) {
          const initialIntents: Record<string, DXFIntent> = {};
          geo.dxfData.layers.forEach(l => { initialIntents[l.name] = l.intent || "cut"; });
          setLayerIntents(initialIntents);
          setPathIntents({});
          setManualBendCount(null);
        }
      } else {
        const { getGeometryAPI } = await import("@/lib/worker/geometry-api");
        const api = getGeometryAPI();
        await api.initialize();
        const buffer = await file.arrayBuffer();
        const raw = await api.extractPricingGeometry(buffer);
        geo = {
          inputType: "step",
          boundingWidth:  raw.boundingWidth,
          boundingHeight: raw.boundingHeight,
          partArea:       raw.partArea,
          perimeter:      raw.perimeter,
          pierceCount:    raw.pierceCount,
          bendCount:      raw.bendCount,
          bendAngles:     raw.bendAngles,
          thickness:      raw.thickness,
          thicknessConfidence: raw.thickness > 0 ? "detected" : "required",
        };
      }

      setGeometry(geo);
      setSavedFilename(file.name);
      setPhase({ name: "ready", geometry: geo, filename: file.name });
    } catch (err) {
      alert(`Error analysing file: ${err instanceof Error ? err.message : String(err)}`);
      setPhase({ name: "idle" });
    }
  }, []);

  // Save quote to Supabase
  const handleSave = useCallback(async (customerName: string, notes: string) => {
    if (phase.name !== "ready" || !result || !userId || !effectiveGeometry) return;
    setPhase({ name: "saving" });

    const supabase = createClient();
    const geo = effectiveGeometry;
    
    // 1. Upload file if present
    let uploadId = null;
    if (sourceFile) {
      const ext = sourceFile.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("step-files")
        .upload(path, sourceFile);
        
      if (!uploadErr && uploadData) {
        const { data: dbUpload } = await supabase.from("uploads").insert({
          user_id: userId,
          filename: sourceFile.name,
          storage_path: path,
          file_size_bytes: sourceFile.size,
          file_type: sourceFile.type || `application/${ext}`,
          status: "processed"
        }).select("id").single();
        if (dbUpload) uploadId = dbUpload.id;
      } else {
        console.warn("Failed to upload source file:", uploadErr);
      }
    }

    // 2. Insert quote
    const { data, error } = await supabase.from("quotes").insert({
      user_id:            userId,
      filename:           phase.filename,
      input_type:         geo.inputType,
      bounding_width_mm:  geo.boundingWidth,
      bounding_height_mm: geo.boundingHeight,
      perimeter_mm:       geo.perimeter,
      pierce_count:       geo.pierceCount,
      part_area_mm2:      geo.partArea,
      bend_count:         geo.bendCount,
      thickness_mm:       result.thicknessMm,
      material_id:        selectedMaterialId || null,
      machine_id:         selectedMachineId  || null,
      quantity,
      markup_percent:     markup,
      material_cost:      result.materialCostPerPart,
      cutting_cost:       result.cuttingCostPerPart,
      bending_cost:       result.bendingCostPerPart,
      setup_cost:         result.setupCostTotal,
      unit_price:         result.unitPrice,
      total_price:        result.totalPrice,
      customer_name:      customerName || null,
      notes:              notes || null,
      status:             "draft",
      upload_id:          uploadId,
    }).select("id").single();

    if (error || !data) {
      alert("Failed to save quote: " + (error?.message ?? "unknown error"));
      if (effectiveGeometry) setPhase({ name: "ready", geometry: effectiveGeometry, filename: savedFilename });
      return;
    }
    setPhase({ name: "saved", quoteId: data.id });
  }, [phase, result, userId, effectiveGeometry, savedFilename, selectedMaterialId, selectedMachineId, quantity, markup, sourceFile]);

  const selectedMat  = materials.find((m) => m.id === selectedMaterialId);
  const selectedMach = machines.find((m) => m.id === selectedMachineId);



  // ── Render ────────────────────────────────────────────

  if (phase.name === "saved") {
    return (
      <div className="dash-page">
        <div className="quote-saved-banner">
          <span className="qs-icon">✓</span>
          <div>
            <h2>Quote Saved</h2>
            <p>Your quote has been saved to the quote history.</p>
          </div>
          <div className="qs-actions">
            <a href={`/dashboard/quotes/${phase.quoteId}`} className="btn-primary">View Quote →</a>
            <button className="btn-ghost" onClick={() => setPhase({ name: "idle" })}>New Quote</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Instant Quoter</h1>
          <p className="dash-page-subtitle">Drop a STEP or DXF file to get an instant price</p>
        </div>
        {phase.name !== "idle" && phase.name !== "analyzing" && (
          <button className="btn-ghost" onClick={() => {
            setPhase({ name: "idle" });
            setResult(null);
            setGeometry(null);
            setRemnantMatches([]);
            setRemnantDismissed(false);
            setUsingRemnant(false);
          }}>
            ← New File
          </button>
        )}
      </div>

      <div className="quoter-layout">
        {/* ── Left column: file + config ── */}
        <div className="quoter-left">
          {(phase.name === "idle" || phase.name === "analyzing") && (
            <DropZone
              onFile={handleFile}
              busy={phase.name === "analyzing"}
            />
          )}

          {phase.name === "ready" && effectiveGeometry && (
            <GeometryCard geo={effectiveGeometry} units={units} />
          )}

          {/* LAYER TOGGLE UI (only for DXF) */}
          {(phase.name === "ready" || phase.name === "saving") && effectiveGeometry?.inputType === "dxf" && effectiveGeometry.dxfData && (
            <div className="config-panel" style={{ marginTop: "1rem" }}>
              <h3 className="config-title">DXF Layers</h3>
              <p className="text-xs text-gray-400 mb-3">Map layers to operations. You can also click lines directly on the drawing to toggle them.</p>
              <div className="flex flex-col gap-3">
                {effectiveGeometry.dxfData.layers.map(layer => {
                  const currentIntent = layerIntents[layer.name] || "cut";
                  return (
                    <div key={layer.name} className="flex items-center justify-between text-sm hover:bg-gray-800 p-1.5 rounded transition-colors">
                      <div className="flex items-center gap-2 overflow-hidden mr-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: layer.color }}></div>
                        <span className="truncate text-gray-300">{layer.name}</span>
                        <span className="text-gray-500 text-xs shrink-0">({layer.entityCount})</span>
                      </div>
                      <div className="flex bg-gray-900 rounded p-0.5 shrink-0">
                        {(["cut", "bend", "ignore"] as DXFIntent[]).map(intent => (
                          <button
                            key={intent}
                            onClick={() => setLayerIntents(prev => ({ ...prev, [layer.name]: intent }))}
                            className={`px-2 py-1 text-xs rounded capitalize transition-colors ${
                              currentIntent === intent
                                ? intent === "cut" ? "bg-orange-500/20 text-orange-400" : intent === "bend" ? "bg-blue-500/20 text-blue-400" : "bg-gray-700 text-gray-200"
                                : "text-gray-500 hover:text-gray-300"
                            }`}
                          >
                            {intent}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Remnant Match Banner ── */}
          {phase.name === "ready" && remnantMatches.length > 0 && !remnantDismissed && (
            <div className="remnant-banner" style={{ marginTop: "1rem" }}>
              <div className="rb-icon">♻️</div>
              <div className="rb-body">
                <p className="rb-title">
                  {remnantMatches.length} remnant{remnantMatches.length > 1 ? "s" : ""} on your rack fit this part
                </p>
                <div className="rb-list">
                  {remnantMatches.map((r) => (
                    <button
                      key={r.id}
                      className={`rb-item ${usingRemnant && selectedMaterialId === (r.material_id ?? "") ? "rb-item-active" : ""}`}
                      onClick={() => {
                        if (r.material_id) setSelectedMaterialId(r.material_id);
                        if (r.thickness_mm) setThicknessInput(String(r.thickness_mm));
                        setUsingRemnant(true);
                      }}
                    >
                      <span
                        className="rb-dot"
                        style={{ background: r.materials?.color_hex ?? "#888" }}
                      />
                      <span className="rb-dims">
                        {r.width_mm} × {r.height_mm} × {r.thickness_mm}mm
                      </span>
                      {r.location && (
                        <span className="rb-loc">📍 {r.location}</span>
                      )}
                    </button>
                  ))}
                </div>
                {usingRemnant && (
                  <p className="rb-using">
                    ✓ Using remnant — no nesting waste applied (15% saving)
                  </p>
                )}
              </div>
              <button className="rb-dismiss" onClick={() => { setRemnantDismissed(true); setUsingRemnant(false); }}>✕</button>
            </div>
          )}

          {phase.name === "saving" && (
            <div className="saving-overlay">Saving quote…</div>
          )}

          {/* Config panel */}
          {effectiveGeometry && (phase.name === "ready" || phase.name === "saving") && (
            <div className="config-panel" style={{ marginTop: "1rem" }}>
              <h3 className="config-title">Quote Parameters</h3>

              {/* Material */}
              <div className="form-field">
                <label>Material</label>
                <select
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}{m.grade ? ` (${m.grade})` : ""}
                    </option>
                  ))}
                </select>
                {selectedMat && (
                  <span className="field-hint">
                    £{selectedMat.cost_per_kg.toFixed(2)}/kg · {selectedMat.density_kg_m3.toLocaleString()} kg/m³ · K-factor {selectedMat.k_factor}
                  </span>
                )}
              </div>

              {/* Thickness — only required for DXF */}
              {effectiveGeometry.thicknessConfidence === "required" && (
                <div className="form-field">
                  <label>Thickness (mm) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="50"
                    value={thicknessInput}
                    onChange={(e) => setThicknessInput(e.target.value)}
                    placeholder="e.g. 2.0"
                  />
                  <span className="field-hint">DXF files don&apos;t contain thickness — enter the material thickness</span>
                </div>
              )}

              {/* Machine */}
              <div className="form-field">
                <label>Machine</label>
                <select
                  value={selectedMachineId}
                  onChange={(e) => setSelectedMachineId(e.target.value)}
                >
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                {selectedMach && selectedMat && (
                  <span className="field-hint">
                    Feed rate: {getFeedRateWithCustom(
                      selectedMach.feed_rates,
                      selectedMat.category,
                      effectiveGeometry.thicknessConfidence === "detected" ? effectiveGeometry.thickness : (parseFloat(thicknessInput) || 2),
                      selectedMach.power_kw ?? 4
                    ).toLocaleString()} mm/min
                  </span>
                )}
              </div>

              {/* Number of Bends */}
              {effectiveGeometry.inputType === "dxf" && (
                <div className="form-field">
                  <label>Number of Bends</label>
                  <input
                    type="number"
                    min="0"
                    value={manualBendCount !== null ? manualBendCount : effectiveGeometry.bendCount}
                    onChange={(e) => {
                      const val = e.target.value;
                      setManualBendCount(val === "" ? 0 : parseInt(val));
                    }}
                  />
                  <span className="field-hint">Auto-calculated from bend layers and clicks. Override if needed.</span>
                </div>
              )}

              {/* Quantity */}
              <div className="form-row-2">
                <div className="form-field">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
                <div className="form-field">
                  <label>Markup (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    step="1"
                    value={markup}
                    onChange={(e) => setMarkup(Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column: price card ── */}
        <div className="quoter-right flex flex-col gap-4">
          {phase.name === "idle" && (
            <div className="quoter-placeholder">
              <div className="qp-icon">⚡</div>
              <h3>Upload a part file</h3>
              <p>Your instant price breakdown will appear here</p>
              <ul className="qp-list">
                <li>STEP / STP — 3D models with auto bend detection</li>
                <li>DXF — 2D flat patterns from any CAD system</li>
              </ul>
            </div>
          )}

          {phase.name === "analyzing" && (
            <div className="quoter-placeholder">
              <div className="dz-spinner large" />
              <h3>Analysing geometry…</h3>
              <p>Extracting dimensions, perimeter, and bend data</p>
            </div>
          )}

          {/* DXF Viewer on top of the right column */}
          {(phase.name === "ready" || phase.name === "saving") && effectiveGeometry?.inputType === "dxf" && (
            <div className="w-full h-80 shrink-0">
              <DxfViewer 
                geometry={effectiveGeometry} 
                layerIntents={layerIntents} 
                pathIntents={pathIntents}
                onPathClick={(id, currentIntent) => {
                  const nextIntent: DXFIntent = currentIntent === "cut" ? "bend" : currentIntent === "bend" ? "ignore" : "cut";
                  setPathIntents(prev => ({ ...prev, [id]: nextIntent }));
                }}
              />
            </div>
          )}

          {(phase.name === "ready" || phase.name === "saving") && result && (
            <QuoteBreakdown
              result={result}
              filename={savedFilename}
              onSave={handleSave}
              saving={phase.name === "saving"}
            />
          )}

          {(phase.name === "ready" || phase.name === "saving") && !result && (
            <div className="quoter-placeholder mt-4 flex flex-col items-center justify-center p-8 bg-gray-900 border border-gray-800 border-dashed rounded-lg text-center text-gray-400">
              <div className="text-3xl mb-3">☝️</div>
              <p className="font-medium text-gray-300 mb-1">Missing Parameters</p>
              <p className="text-sm">Please select a material, machine, and specify the material thickness to instantly calculate your price.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
