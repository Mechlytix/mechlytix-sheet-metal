"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { parseDXFGeometry } from "@/lib/dxf/parse-dxf";
import { calculatePrice } from "@/lib/pricing/cost-model";
import { getFeedRateWithCustom } from "@/lib/pricing/feed-rates";
import { formatCurrency, formatLength } from "@/lib/units";
import type { PricingGeometry, PricingResult, DXFIntent, PriceBreak } from "@/lib/pricing/types";
import type { Material, MachineProfile } from "@/lib/types/database";
import { DxfViewer } from "@/components/DxfViewer";
import { CustomerSelector } from "@/components/CustomerSelector";

// ─────────────────────────────────────────────────────────────
// /dashboard/quoter  -  Unified STEP / DXF Instant Quoter (Multi-Part)
// ─────────────────────────────────────────────────────────────

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
  | { name: "analyzing"; filenames: string[] }
  | { name: "ready" }
  | { name: "saving" }
  | { name: "saved"; quoteId: string };

interface QuoteItem {
  id: string;
  filename: string;
  geometry: PricingGeometry;
  sourceFile: File | null;
  // Per-part config
  materialId: string;
  machineId: string;
  thickness: number;
  quantity: number;
  markup: number;
  layerIntents: Record<string, DXFIntent>;
  pathIntents: Record<string, DXFIntent>;
  manualBendCount: number | null;
  leadTime: string;
  priceBreaks: PriceBreak[];
}

// ─── File Drop Zone ──────────────────────────────────────────

function DropZone({
  onFiles,
  busy,
}: {
  onFiles: (files: File[]) => void;
  busy: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) onFiles(droppedFiles);
    },
    [onFiles]
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
        multiple
        accept=".step,.stp,.dxf"
        style={{ display: "none" }}
        onChange={(e) => { 
          const f = e.target.files; 
          if (f && f.length > 0) onFiles(Array.from(f)); 
        }}
      />

      <div className="dz-hero-glow" />

      {busy ? (
        <>
          <span className="dz-spinner large" />
          <p className="dz-hero-title">Analysing geometry...</p>
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
        </>
      )}
    </div>
  );
}

// ─── Geometry Card ──────────────────────────────────────────

function GeometryCard({ geo, units }: { geo: PricingGeometry; units: string }) {
  const u = units as "metric" | "imperial";
  return (
    <div className="geo-card" style={{ marginBottom: "1rem" }}>
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
            {geo.bendCount > 0 ? geo.bendCount : "—"}
          </span>
        </div>
        {geo.thickness > 0 && (
          <div className="geo-item">
            <span className="geo-label">Thickness</span>
            <span className={`geo-value ${geo.thicknessConfidence === "detected" ? "detected" : ""}`}>
              {formatLength(geo.thickness, u, 2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quote Breakdown Card ─────────────────────────────────────

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

      <div className="quote-save-section">
        <div className="form-field">
          <label>Customer</label>
          <CustomerSelector userId={userId} value={customerId} onChange={setCustomerId} />
        </div>
        <div className="form-field">
          <label>Notes (optional)</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Batch notes..." />
        </div>
        <button className="btn-primary" onClick={() => onSave(customerId, notes)} disabled={saving || !customerId} style={{ width: "100%" }}>
          {saving ? "Saving..." : !customerId ? "Select Customer to Save" : "💾 Save Batch"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Quoter Page ────────────────────────────────────────

export default function QuoterPage() {
  const { units } = useDashboard();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItem = items[activeIndex];

  const [materials, setMaterials] = useState<Material[]>([]);
  const [machines, setMachines]   = useState<MachineProfile[]>([]);
  const [userId, setUserId]       = useState<string | null>(null);
  
  const [defaultMaterialId, setDefaultMaterialId] = useState<string>("");
  const [defaultMachineId, setDefaultMachineId]   = useState<string>("");
  const [defaultMarkup, setDefaultMarkup]         = useState(15);

  const [result, setResult] = useState<PricingResult | null>(null);

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

      if (settings) setDefaultMarkup(settings.default_markup_percent ?? 15);
      if (mats && mats.length > 0) setDefaultMaterialId(mats[0].id);
      if (machs && machs.length > 0) {
        const def = machs.find((m) => m.is_default) ?? machs[0];
        setDefaultMachineId(def.id);
      }
    }
    load();
  }, []);

  const updateActiveItem = useCallback((patch: Partial<QuoteItem>) => {
    setItems(prev => prev.map((item, i) => i === activeIndex ? { ...item, ...patch } : item));
  }, [activeIndex]);

  const effectiveGeometry = useMemo(() => {
    if (!activeItem) return null;
    const geo = activeItem.geometry;
    if (geo.inputType !== "dxf" || !geo.dxfData) return geo;

    let newPerimeter = 0;
    let newPierceCount = 0;
    let autoBendCount = 0;

    geo.dxfData.paths.forEach((p) => {
      const intent = activeItem.pathIntents[p.id] || activeItem.layerIntents[p.layer] || "cut";
      if (intent === "cut") { newPerimeter += p.length; newPierceCount++; }
      else if (intent === "bend") { autoBendCount++; }
    });

    return {
      ...geo,
      perimeter: newPerimeter,
      pierceCount: newPierceCount,
      bendCount: activeItem.manualBendCount ?? autoBendCount,
    };
  }, [activeItem]);

  // Recalculation logic for active item AND all price breaks
  useEffect(() => {
    if (!effectiveGeometry || !activeItem || (phase.name !== "ready" && phase.name !== "saving")) { 
      setResult(null); 
      return; 
    }

    const mat  = materials.find((m) => m.id === activeItem.materialId);
    const mach = machines.find((m)  => m.id === activeItem.machineId);
    if (!mat || !mach) return;

    const geo  = effectiveGeometry;
    let thickMm = activeItem.thickness || geo.thickness || 1;
    const feedRate = getFeedRateWithCustom(mach.feed_rates, mat.category, thickMm, mach.power_kw ?? 4);

    // 1. Primary Result
    const r = calculatePrice({
      geometry: { ...geo, thickness: thickMm },
      materialCostPerKg: mat.cost_per_kg, materialDensityKgM3: mat.density_kg_m3, scrapValuePerKg: mat.scrap_value_per_kg ?? 0,
      machineHourlyRate: mach.hourly_rate, feedRateMmPerMin: feedRate, pierceTimeSeconds: mach.pierce_time_seconds ?? 0.5,
      setupTimeMinutes: mach.setup_time_minutes ?? 15, costPerBend: mach.cost_per_bend ?? 2.5,
      quantity: activeItem.quantity, markupPercent: activeItem.markup, wasteFactor: 1.15,
    });
    setResult(r);

    // 2. Refresh all price breaks
    const updatedBreaks = activeItem.priceBreaks.map(pb => {
      const tierResult = calculatePrice({
        geometry: { ...geo, thickness: thickMm },
        materialCostPerKg: mat.cost_per_kg, materialDensityKgM3: mat.density_kg_m3, scrapValuePerKg: mat.scrap_value_per_kg ?? 0,
        machineHourlyRate: mach.hourly_rate, feedRateMmPerMin: feedRate, pierceTimeSeconds: mach.pierce_time_seconds ?? 0.5,
        setupTimeMinutes: mach.setup_time_minutes ?? 15, costPerBend: mach.cost_per_bend ?? 2.5,
        quantity: pb.quantity, markupPercent: activeItem.markup, wasteFactor: 1.15,
      });

      const m = pb.overrides.material ?? tierResult.materialCostPerPart;
      const c = pb.overrides.cutting  ?? tierResult.cuttingCostPerPart;
      const b = pb.overrides.bending  ?? tierResult.bendingCostPerPart;
      const s = pb.overrides.setup    ?? tierResult.setupCostPerPart;
      const markup = pb.overrides.markup ?? activeItem.markup;

      const net = m + c + b + s;
      const unit = net * (1 + markup / 100);

      return {
        ...pb,
        materialCostPerPart: m, cuttingCostPerPart: c, bendingCostPerPart: b, setupCostPerPart: s,
        setupCostTotal: tierResult.setupCostTotal, unitPrice: unit, totalPrice: unit * pb.quantity,
      };
    });

    if (JSON.stringify(updatedBreaks) !== JSON.stringify(activeItem.priceBreaks)) {
      updateActiveItem({ priceBreaks: updatedBreaks });
    }

  }, [phase.name, activeItem, effectiveGeometry, materials, machines, updateActiveItem]);

  const onFiles = useCallback(async (files: File[]) => {
    setPhase({ name: "analyzing", filenames: files.map(f => f.name) });
    const newItems: QuoteItem[] = [];

    try {
      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!ext || !["step", "stp", "dxf"].includes(ext)) continue;

        let geo: PricingGeometry;
        const initialIntents: Record<string, DXFIntent> = {};

        if (ext === "dxf") {
          const text = await file.text();
          geo = parseDXFGeometry(text);
          if (geo.dxfData) geo.dxfData.layers.forEach(l => { initialIntents[l.name] = l.intent || "cut"; });
        } else {
          const { getGeometryAPI } = await import("@/lib/worker/geometry-api");
          const api = getGeometryAPI();
          await api.initialize();
          const buffer = await file.arrayBuffer();
          const raw = await api.extractPricingGeometry(buffer);
          geo = {
            inputType: "step", boundingWidth: raw.boundingWidth, boundingHeight: raw.boundingHeight,
            partArea: raw.partArea, perimeter: raw.perimeter, pierceCount: raw.pierceCount,
            bendCount: raw.bendCount, bendAngles: raw.bendAngles, thickness: raw.thickness,
            thicknessConfidence: raw.thickness > 0 ? "detected" : "required",
          };
        }

        newItems.push({
          id: Math.random().toString(36).substr(2, 9), filename: file.name, geometry: geo, sourceFile: file,
          materialId: defaultMaterialId, machineId: defaultMachineId, thickness: geo.thickness || 0,
          quantity: 1, markup: defaultMarkup, layerIntents: initialIntents, pathIntents: {},
          manualBendCount: null, leadTime: "7-10 Days", priceBreaks: []
        });
      }

      setItems(prev => {
        const updated = [...prev, ...newItems];
        if (prev.length === 0 && updated.length > 0) setActiveIndex(0);
        return updated;
      });
      setPhase({ name: "ready" });
    } catch (err) {
      alert(`Error analysing files: ${err instanceof Error ? err.message : String(err)}`);
      setPhase({ name: "idle" });
    }
  }, [defaultMaterialId, defaultMachineId, defaultMarkup]);

  const handleSave = useCallback(async (customerId: string | null, notes: string) => {
    if (phase.name !== "ready" || items.length === 0 || !userId) return;
    setPhase({ name: "saving" });

    const supabase = createClient();
    const groupId = crypto.randomUUID();
    let firstQuoteId = "";

    try {
      for (const item of items) {
        const mat  = materials.find((m) => m.id === item.materialId);
        const mach = machines.find((m)  => m.id === item.machineId);
        if (!mat || !mach) continue;

        const thickMm = item.thickness || item.geometry.thickness || 1;
        const feedRate = getFeedRateWithCustom(mach.feed_rates, mat.category, thickMm, mach.power_kw ?? 4);

        let effGeo = item.geometry;
        if (effGeo.inputType === "dxf" && effGeo.dxfData) {
          let newPerimeter = 0, newPierceCount = 0, autoBendCount = 0;
          effGeo.dxfData.paths.forEach((p) => {
            const intent = item.pathIntents[p.id] || item.layerIntents[p.layer] || "cut";
            if (intent === "cut") { newPerimeter += p.length; newPierceCount++; }
            else if (intent === "bend") { autoBendCount++; }
          });
          effGeo = { ...effGeo, perimeter: newPerimeter, pierceCount: newPierceCount, bendCount: item.manualBendCount ?? autoBendCount };
        }

        const r = calculatePrice({
          geometry: { ...effGeo, thickness: thickMm },
          materialCostPerKg: mat.cost_per_kg, materialDensityKgM3: mat.density_kg_m3, scrapValuePerKg: mat.scrap_value_per_kg ?? 0,
          machineHourlyRate: mach.hourly_rate, feedRateMmPerMin: feedRate, pierceTimeSeconds: mach.pierce_time_seconds ?? 0.5,
          setupTimeMinutes: mach.setup_time_minutes ?? 15, costPerBend: mach.cost_per_bend ?? 2.5,
          quantity: item.quantity, markupPercent: item.markup, wasteFactor: 1.15,
        });

        let uploadId = null;
        if (item.sourceFile) {
          const path = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${item.sourceFile.name.split(".").pop()}`;
          const { data: uploadData } = await supabase.storage.from("step-files").upload(path, item.sourceFile);
          if (uploadData) {
            const { data: dbUpload } = await supabase.from("uploads").insert({
              user_id: userId, filename: item.sourceFile.name, storage_path: path,
              file_size_bytes: item.sourceFile.size, file_type: "processed", status: "processed"
            }).select("id").single();
            if (dbUpload) uploadId = dbUpload.id;
          }
        }

        const { data: quoteData, error: quoteErr } = await supabase.from("quotes").insert({
          user_id: userId, group_id: groupId, filename: item.filename,
          input_type: effGeo.inputType, bounding_width_mm: effGeo.boundingWidth, bounding_height_mm: effGeo.boundingHeight,
          perimeter_mm: effGeo.perimeter, pierce_count: effGeo.pierceCount, part_area_mm2: effGeo.partArea,
          bend_count: effGeo.bendCount, thickness_mm: r.thicknessMm, material_id: item.materialId, machine_id: item.machineId,
          quantity: item.quantity, markup_percent: item.markup, material_cost: r.materialCostPerPart,
          cutting_cost: r.cuttingCostPerPart, bending_cost: r.bendingCostPerPart, setup_cost: r.setupCostTotal,
          unit_price: r.unitPrice, total_price: r.totalPrice, customer_id: customerId, notes: notes,
          status: "draft", upload_id: uploadId, price_breaks: item.priceBreaks, lead_time: item.leadTime
        }).select("id").single();

        if (quoteData && !firstQuoteId) firstQuoteId = quoteData.id;
        if (quoteErr) throw quoteErr;
      }
      setPhase({ name: "saved", quoteId: firstQuoteId });
    } catch (err) {
      alert("Failed to save quotes: " + (err instanceof Error ? err.message : String(err)));
      setPhase({ name: "ready" });
    }
  }, [items, userId, materials, machines]);

  // Tier Management Logic
  const addTier = (qty: number) => {
    if (qty <= 0 || activeItem.priceBreaks.some(pb => pb.quantity === qty)) return;
    const newTier = { 
        quantity: qty, unitPrice: 0, totalPrice: 0,
        materialCostPerPart: 0, cuttingCostPerPart: 0, bendingCostPerPart: 0, 
        setupCostPerPart: 0, setupCostTotal: 0, leadTime: activeItem.leadTime,
        overrides: { material: null, cutting: null, bending: null, setup: null, markup: null }
    };
    updateActiveItem({
      priceBreaks: [...activeItem.priceBreaks, newTier].sort((a,b) => a.quantity - b.quantity)
    });
  };

  const removeTier = (idx: number) => {
    const next = [...activeItem.priceBreaks];
    next.splice(idx, 1);
    updateActiveItem({ priceBreaks: next });
  };

  const updateOverride = (idx: number, field: keyof PriceBreak["overrides"], val: string) => {
    const parsed = parseFloat(val);
    const newVal = isNaN(parsed) ? null : parsed;
    updateActiveItem({
      priceBreaks: activeItem.priceBreaks.map((pb, i) => i === idx ? {
        ...pb, overrides: { ...pb.overrides, [field]: newVal }
      } : pb)
    });
  };
  
  const updateTierLeadTime = (idx: number, val: string) => {
    updateActiveItem({
      priceBreaks: activeItem.priceBreaks.map((pb, i) => i === idx ? { ...pb, leadTime: val } : pb)
    });
  };

  if (phase.name === "saved") {
    return (
      <div className="dash-page">
        <div className="quote-saved-banner">
          <span className="qs-icon">✓</span>
          <div><h2>Batch Quote Saved</h2><p>All items have been linked and saved to your history.</p></div>
          <div className="qs-actions">
            <a href={`/dashboard/quotes/${phase.quoteId}`} className="btn-primary">View Quote History {"\u2192"}</a>
            <button className="btn-ghost" onClick={() => { setItems([]); setActiveIndex(0); setPhase({ name: "idle" }); }}>New Batch</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div><h1 className="dash-page-title">Instant Quoter</h1><p className="dash-page-subtitle">Configure multi-part batches with volume pricing</p></div>
        {items.length > 0 && phase.name === "idle" && (
          <button className="btn-ghost" onClick={() => setPhase({ name: "ready" })}>{"\u2190"} Back to Config</button>
        )}
      </div>

      {(phase.name === "idle" || phase.name === "analyzing") && (
        <DropZone onFiles={onFiles} busy={phase.name === "analyzing"} />
      )}

      {(phase.name === "ready" || phase.name === "saving") && activeItem && (
        <div className="quoter-layout quoter-multi-layout">
          <div className="quoter-items-sidebar no-print">
            <div className="sidebar-header"><h3 className="sidebar-title">Batch Items</h3><span className="item-count-badge">{items.length}</span></div>
            <div className="items-list">
              {items.map((item, idx) => (
                <button key={item.id} className={`item-tab ${activeIndex === idx ? "active" : ""}`} onClick={() => setActiveIndex(idx)}>
                  <div className="item-tab-info"><span className="item-tab-name">{item.filename}</span><span className="item-tab-meta">Qty {item.quantity}</span></div>
                </button>
              ))}
              <button className="btn-add-more" onClick={() => setPhase({ name: "idle" })}>+ Add Part</button>
            </div>
          </div>

          <div className="quoter-left">
            <div className="quoter-view-container" style={{ height: 500, background: "var(--bg-secondary)", borderRadius: 12, marginBottom: "1rem", overflow: "hidden", position: "relative" }}>
              <DxfViewer 
                geometry={activeItem.geometry} 
                layerIntents={activeItem.layerIntents} 
                pathIntents={activeItem.pathIntents}
                onPathClick={(pid, intent) => {
                  const nextIntent = intent === "cut" ? "bend" : intent === "bend" ? "ignore" : "cut";
                  updateActiveItem({ pathIntents: { ...activeItem.pathIntents, [pid]: nextIntent } });
                }}
              />
            </div>

            {effectiveGeometry && <GeometryCard geo={effectiveGeometry} units={units} />}

            <div className="config-panel">
              <h3 className="config-title">Basic Configuration</h3>
              <div className="config-grid">
                <div className="form-field"><label>Material</label>
                  <select value={activeItem.materialId} onChange={(e) => updateActiveItem({ materialId: e.target.value })}>
                    {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.grade})</option>)}
                  </select>
                </div>
                <div className="form-field"><label>Machine</label>
                  <select value={activeItem.machineId} onChange={(e) => updateActiveItem({ machineId: e.target.value })}>
                    {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="form-field"><label>Primary Quantity</label>
                  <input type="number" value={activeItem.quantity} onChange={(e) => updateActiveItem({ quantity: Math.max(1, +e.target.value) })} />
                </div>
                <div className="form-field"><label>Markup (%)</label>
                  <input type="number" value={activeItem.markup} onChange={(e) => updateActiveItem({ markup: Math.max(0, +e.target.value) })} />
                </div>
                <div className="form-field"><label>Lead Time</label>
                  <input type="text" value={activeItem.leadTime} onChange={(e) => updateActiveItem({ leadTime: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="config-panel" style={{ marginTop: "1rem" }}>
              <h3 className="config-title">Quantity Tiers &amp; Price Breaks</h3>
              <div className="tier-manager">
                <table className="quoter-tier-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", width: 100 }}>QTY</th>
                      <th style={{ textAlign: "right" }}>MATERIAL</th>
                      <th style={{ textAlign: "right" }}>CUTTING</th>
                      <th style={{ textAlign: "right" }}>BENDING</th>
                      <th style={{ textAlign: "right" }}>SETUP</th>
                      <th style={{ textAlign: "right", width: 90 }}>MARKUP %</th>
                      <th style={{ textAlign: "left", paddingLeft: "1.5rem" }}>LEAD TIME</th>
                      <th style={{ textAlign: "right" }}>UNIT PRICE</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Primary Qty Row (Non-removable but cost-editable) */}
                    <tr>
                      <td style={{ fontWeight: 600 }}>{activeItem.quantity} <small>(Base)</small></td>
                      <td className="tier-val-auto">{formatCurrency(result?.materialCostPerPart ?? 0)}</td>
                      <td className="tier-val-auto">{formatCurrency(result?.cuttingCostPerPart ?? 0)}</td>
                      <td className="tier-val-auto">{formatCurrency(result?.bendingCostPerPart ?? 0)}</td>
                      <td className="tier-val-auto">{formatCurrency(result?.setupCostPerPart ?? 0)}</td>
                      <td className="tier-val-auto">{activeItem.markup}%</td>
                      <td className="tier-val-auto" style={{ textAlign: "left", paddingLeft: "1.5rem" }}>{activeItem.leadTime}</td>
                      <td className="tier-val-highlight">{formatCurrency(result?.unitPrice ?? 0)}</td>
                      <td></td>
                    </tr>
                    {/* Additional Tiers */}
                    {activeItem.priceBreaks.map((pb, i) => (
                      <tr key={i}>
                        <td>
                          <input type="number" className="tier-editable-input" value={pb.quantity} onChange={(e) => updateActiveItem({
                            priceBreaks: activeItem.priceBreaks.map((p, idx) => idx === i ? { ...p, quantity: Math.max(1, +e.target.value) } : p)
                          })} style={{ textAlign: "left", width: 60 }} />
                        </td>
                        <td className="tier-val-auto">{formatCurrency(pb.materialCostPerPart)}</td>
                        <td className="tier-val-auto">{formatCurrency(pb.cuttingCostPerPart)}</td>
                        <td className="tier-val-auto">{formatCurrency(pb.bendingCostPerPart)}</td>
                        <td className="tier-val-auto">{formatCurrency(pb.setupCostPerPart)}</td>
                        <td className="tier-input-cell" style={{ width: 90 }}>
                          <input className={`tier-editable-input ${pb.overrides.markup !== null ? "overridden" : ""}`}
                            value={pb.overrides.markup ?? activeItem.markup}
                            onChange={(e) => updateOverride(i, "markup", e.target.value)}
                            style={{ textAlign: "right", paddingRight: 16 }} />
                          <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-dim)" }}>%</span>
                        </td>
                        <td style={{ textAlign: "left", paddingLeft: "1.5rem" }}>
                          <input className="tier-editable-input" value={pb.leadTime ?? ""} onChange={(e) => updateTierLeadTime(i, e.target.value)} style={{ textAlign: "left" }} />
                        </td>
                        <td className="tier-val-highlight">{formatCurrency(pb.unitPrice)}</td>
                        <td><button className="btn-tier-remove" onClick={() => removeTier(i)}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="tier-add-row">
                  <input type="number" className="tier-add-input" placeholder="Add Qty..." 
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const val = parseInt((e.target as HTMLInputElement).value);
                        if (val) { addTier(val); (e.target as HTMLInputElement).value = ""; }
                      }
                    }} />
                  <span className="tier-add-hint">Press Enter to add volume break</span>
                </div>
              </div>
            </div>

            {activeItem.geometry.inputType === "dxf" && activeItem.geometry.dxfData && (
              <div className="config-panel" style={{ marginTop: "1rem" }}>
                <h3 className="config-title">DXF Layers</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {activeItem.geometry.dxfData.layers.map(layer => {
                    const currentIntent = activeItem.layerIntents[layer.name] || "cut";
                    return (
                      <div key={layer.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 6, background: "rgba(255,255,255,0.03)" }}>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{layer.name}</span>
                        <div className="layer-intent-toggle">
                          {(["cut", "bend", "ignore"] as DXFIntent[]).map(intent => (
                            <button key={intent} className={`layer-intent-btn ${currentIntent === intent ? "active" : ""} layer-intent-btn--${intent}`}
                              onClick={() => updateActiveItem({ layerIntents: { ...activeItem.layerIntents, [layer.name]: intent } })}
                            >{intent}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="quoter-right">
            {result ? (
              <QuoteBreakdown result={result} filename={activeItem.filename} onSave={handleSave} saving={phase.name === "saving"} userId={userId} />
            ) : (
              <div className="quote-card empty"><p>Select material/machine to see results</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
