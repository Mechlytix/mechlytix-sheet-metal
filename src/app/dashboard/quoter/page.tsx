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
import { CustomerSelector } from "@/components/CustomerSelector";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// /dashboard/quoter â€” Unified STEP / DXF Instant Quoter
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ File Drop Zone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      className={`dz-hero ${drag ? "drag-over" : ""} ${busy ? "busy" : ""}`}
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

      {/* Animated background glow */}
      <div className="dz-hero-glow" />

      {busy ? (
        <>
          <span className="dz-spinner large" />
          <p className="dz-hero-title">Analysing geometryâ€¦</p>
          <p className="dz-hero-sub">Extracting dimensions, perimeter and bend data</p>
        </>
      ) : (
        <>
          <div className="dz-hero-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <p className="dz-hero-title">Drop your part file to get an instant price</p>
          <p className="dz-hero-sub">Drag &amp; drop or <span className="dz-hero-link">click to browse</span></p>
          <div className="dz-hero-formats">
            <span className="dz-format-pill">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              STEP / STP - 3D model
            </span>
            <span className="dz-format-divider">{"\u00B7"}</span>
            <span className="dz-format-pill">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              DXF - 2D flat pattern
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// â”€â”€â”€ Geometry Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function GeometryCard({ geo, units }: { geo: PricingGeometry; units: string }) {
  const u = units as "metric" | "imperial";
  return (
    <div className="geo-card">
      <h3 className="geo-card-title">Extracted Geometry</h3>
      <div className="geo-grid">
        <div className="geo-item">
          <span className="geo-label">Flat Pattern</span>
          <span className="geo-value">
            {formatLength(geo.boundingWidth, u, 0)} {"\u00D7"} {formatLength(geo.boundingHeight, u, 0)}
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
              ? `${geo.bendCount} (${geo.bendAngles.map((a) => `${Math.round(a)}Â°`).join(", ")})`
              : "â€”"}
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

// â”€â”€â”€ Quote Breakdown Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function QuoteBreakdown({
  result,
  filename,
  onSave,
  saving,
  userId,
}: {
  result: PricingResult;
  filename: string;
  onSave: (customerId: string | null, notes: string) => void;
  saving: boolean;
  userId: string | null;
}) {
  const [customerId, setCustomerId] = useState<string | null>(null);
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
            <p key={i} className="quote-warning">âš  {w}</p>
          ))}
        </div>
      )}

      {/* Save quote */}
      <div className="quote-save-section">
        <div className="form-field">
          <label>Customer</label>
          <CustomerSelector
            userId={userId}
            value={customerId}
            onChange={(id) => setCustomerId(id)}
          />
        </div>
        <div className="form-field">
          <label>Notes (optional)</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="2.0mm CR4, Qty 25, by 30 April" />
        </div>
        <button
          className="btn-primary"
          onClick={() => onSave(customerId, notes)}
          disabled={saving}
        >
          {saving ? "Savingâ€¦" : "ðŸ’¾ Save Quote"}
        </button>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main Quoter Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  const handleSave = useCallback(async (customerId: string | null, notes: string) => {
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
      customer_id:        customerId || null,
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



  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (phase.name === "saved") {
    return (
      <div className="dash-page">
        <div className="quote-saved-banner">
          <span className="qs-icon">âœ“</span>
          <div>
            <h2>Quote Saved</h2>
            <p>Your quote has been saved to the quote history.</p>
          </div>
          <div className="qs-actions">
            <a href={`/dashboard/quotes/${phase.quoteId}`} className="btn-primary">View Quote â†’</a>
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
            {"\u2190"} New File
          </button>
        )}
      </div>

      {/* â”€â”€ Idle / Analyzing: full-width hero drop zone â”€â”€ */}
      {(phase.name === "idle" || phase.name === "analyzing") && (
        <DropZone onFile={handleFile} busy={phase.name === "analyzing"} />
      )}

      {/* â”€â”€ Ready / Saving: two-column layout â”€â”€ */}
      {(phase.name === "ready" || phase.name === "saving") && (
        <div className="quoter-layout">
          {/* Left: geometry + config */}
          <div className="quoter-left">
            {effectiveGeometry && (
              <GeometryCard geo={effectiveGeometry} units={units} />
            )}

            {/* DXF Layer Toggles */}
            {effectiveGeometry?.inputType === "dxf" && effectiveGeometry.dxfData && (
              <div className="config-panel" style={{ marginTop: "1rem" }}>
                <h3 className="config-title">DXF Layers</h3>
                <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "-4px 0 4px" }}>Map layers to operations, or click lines on the drawing.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {effectiveGeometry.dxfData.layers.map(layer => {
                    const currentIntent = layerIntents[layer.name] || "cut";
                    return (
                      <div key={layer.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 6, background: "rgba(255,255,255,0.03)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", marginRight: 8 }}>
                          <div style={{ width: 10, height: 10, borderRadius: "50%", flexShrink: 0, background: layer.color }} />
                          <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{layer.name}</span>
                          <span style={{ fontSize: 11, color: "var(--text-dim)", flexShrink: 0 }}>({layer.entityCount})</span>
                        </div>
                        <div className="layer-intent-toggle">
                          {(["cut", "bend", "ignore"] as DXFIntent[]).map(intent => (
                            <button
                              key={intent}
                              className={`layer-intent-btn ${currentIntent === intent ? "active" : ""} layer-intent-btn--${intent}`}
                              onClick={() => setLayerIntents(prev => ({ ...prev, [layer.name]: intent }))}
                            >{intent}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Remnant Banner */}
            {remnantMatches.length > 0 && !remnantDismissed && (
              <div className="remnant-banner" style={{ marginTop: "1rem" }}>
                <div className="rb-icon">â™»ï¸</div>
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
                        <span className="rb-dot" style={{ background: r.materials?.color_hex ?? "#888" }} />
                        <span className="rb-dims">{r.width_mm} Ã— {r.height_mm} Ã— {r.thickness_mm}mm</span>
                        {r.location && <span className="rb-loc">ðŸ“ {r.location}</span>}
                      </button>
                    ))}
                  </div>
                  {usingRemnant && (
                    <p className="rb-using">âœ“ Using remnant â€” no nesting waste applied (15% saving)</p>
                  )}
                </div>
                <button className="rb-dismiss" onClick={() => { setRemnantDismissed(true); setUsingRemnant(false); }}>âœ•</button>
              </div>
            )}

            {phase.name === "saving" && (
              <div className="saving-overlay">Saving quoteâ€¦</div>
            )}

            {/* Config panel */}
            <div className="config-panel" style={{ marginTop: "1rem" }}>
              <h3 className="config-title">Quote Parameters</h3>

              {/* Material */}
              <div className="form-field">
                <label>Material</label>
                <select value={selectedMaterialId} onChange={(e) => setSelectedMaterialId(e.target.value)}>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}{m.grade ? ` (${m.grade})` : ""}</option>
                  ))}
                </select>
                {selectedMat && (
                  <span className="field-hint">Â£{selectedMat.cost_per_kg.toFixed(2)}/kg· {selectedMat.density_kg_m3.toLocaleString()} kg/mÂ³· K-factor {selectedMat.k_factor}</span>
                )}
              </div>

              {/* Thickness â€” only required for DXF */}
              {effectiveGeometry?.thicknessConfidence === "required" && (
                <div className="form-field">
                  <label>Thickness (mm) *</label>
                  <input
                    type="number" step="0.1" min="0.1" max="50"
                    value={thicknessInput}
                    onChange={(e) => setThicknessInput(e.target.value)}
                    placeholder="e.g. 2.0"
                  />
                  <span className="field-hint">DXF files don&apos;t contain thickness â€” enter the material thickness</span>
                </div>
              )}

              {/* Machine */}
              <div className="form-field">
                <label>Machine</label>
                <select value={selectedMachineId} onChange={(e) => setSelectedMachineId(e.target.value)}>
                  {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                {selectedMach && selectedMat && (
                  <span className="field-hint">
                    Feed rate: {getFeedRateWithCustom(
                      selectedMach.feed_rates, selectedMat.category,
                      effectiveGeometry?.thicknessConfidence === "detected" ? effectiveGeometry.thickness : (parseFloat(thicknessInput) || 2),
                      selectedMach.power_kw ?? 4
                    ).toLocaleString()} mm/min
                  </span>
                )}
              </div>

              {/* Bends override (DXF only) */}
              {effectiveGeometry?.inputType === "dxf" && (
                <div className="form-field">
                  <label>Number of Bends</label>
                  <input
                    type="number" min="0"
                    value={manualBendCount !== null ? manualBendCount : effectiveGeometry.bendCount}
                    onChange={(e) => { const val = e.target.value; setManualBendCount(val === "" ? 0 : parseInt(val)); }}
                  />
                  <span className="field-hint">Auto-calculated from bend layers. Override if needed.</span>
                </div>
              )}

              {/* Quantity + Markup */}
              <div className="form-row-2">
                <div className="form-field">
                  <label>Quantity</label>
                  <input type="number" min="1" max="10000" value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div className="form-field">
                  <label>Markup (%)</label>
                  <input type="number" min="0" max="200" step="1" value={markup}
                    onChange={(e) => setMarkup(Math.max(0, parseFloat(e.target.value) || 0))} />
                </div>
              </div>
            </div>
          </div>

          {/* Right: DXF viewer + price breakdown */}
          <div className="quoter-right" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {effectiveGeometry?.inputType === "dxf" && (
              <div style={{ width: "100%", height: 320, flexShrink: 0 }}>
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

            {result ? (
              <QuoteBreakdown
                result={result}
                filename={savedFilename}
                onSave={handleSave}
                saving={phase.name === "saving"}
                userId={userId}
              />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", background: "var(--bg-secondary)", border: "1px dashed var(--border-subtle)", borderRadius: "var(--radius-lg)", textAlign: "center", gap: 10 }}>
                <div style={{ fontSize: 28 }}>{"\u26A0\uFE0F"}</div>
                <p style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)", fontSize: 14 }}>Missing Parameters</p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>Select a material, machine, and enter the material thickness to calculate a price.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
