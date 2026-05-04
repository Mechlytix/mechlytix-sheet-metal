"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CustomerSelector } from "@/components/CustomerSelector";
import { QuoteStatusManager } from "@/components/QuoteStatusManager";
import { QuoteShareButton } from "@/components/QuoteShareButton";
import { PdfDownloadButton } from "@/components/PdfDownloadButton";
import { PdfPreviewButton } from "@/components/PdfPreviewButton";
import { QuoteAttachments } from "@/components/QuoteAttachments";
import { DxfViewer } from "@/components/DxfViewer";
import Link from "next/link";
import { calculatePrice } from "@/lib/pricing/cost-model";
import { getFeedRateWithCustom } from "@/lib/pricing/feed-rates";
import type { PricingGeometry, DXFIntent, PricingResult, PriceBreak } from "@/lib/pricing/types";

/* ─────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────── */

interface Material {
  id: string; name: string; grade: string | null; category: string;
  color_hex: string | null; cost_per_kg: number; density_kg_m3: number;
  scrap_value_per_kg: number;
}

interface Machine {
  id: string; name: string; machine_type: string | null;
  hourly_rate: number; power_kw: number | null;
  feed_rates: any;
  pierce_time_seconds: number;
  setup_time_minutes: number;
  cost_per_bend: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>;

interface Props {
  quote: Quote;
  batchQuotes: Quote[];
  customer: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  brandColor: string;
  userId: string;
  createdDate: string | null;
  expiresDate: string | null;
  dxfPreviews: Record<string, PricingGeometry>;
  materials: Material[];
  machines: Machine[];
}

/* ── Helpers ── */

function fmt(n: number | null | undefined, prefix = "\u00A3", dp = 2) {
  if (n == null) return "\u2014";
  return `${prefix}${n.toFixed(dp)}`;
}
function fmtMm(n: number | null | undefined) {
  if (n == null) return "\u2014";
  return `${n.toFixed(1)} mm`;
}

/* ── Small input helper with override support ── */
function CostInput({ value, onChange, onReset, isOverridden, prefix = "\u00A3", step = 0.01, min = 0 }: {
  value: number; onChange: (v: number) => void; onReset: () => void; isOverridden: boolean;
  prefix?: string; step?: number; min?: number;
}) {
  const [displayValue, setDisplayValue] = React.useState(value.toFixed(2));
  const [hasError, setHasError] = React.useState(false);

  // Sync internal state when prop changes externally (e.g. from recalculation)
  React.useEffect(() => {
    const roundedProp = Math.round(value * 100) / 100;
    const currentDisplayNum = parseFloat(displayValue);
    if (isNaN(currentDisplayNum) || Math.abs(currentDisplayNum - roundedProp) > 0.001) {
      setDisplayValue(roundedProp.toFixed(2));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);
    const parsed = parseFloat(raw);
    
    if (!isNaN(parsed)) {
      if (parsed < min) {
        setHasError(true);
        setTimeout(() => setHasError(false), 1500);
        onChange(min);
      } else {
        onChange(Math.round(parsed * 100) / 100);
      }
    } else if (raw === "") {
      onChange(min);
    }
  };

  return (
    <div className={`qd-inline-input-wrap ${isOverridden ? "qd-overridden" : ""} ${hasError ? "qd-input-error" : ""}`}>
      {prefix && <span className="qd-inline-prefix">{prefix}</span>}
      <input type="number" className="qd-inline-input"
        value={displayValue}
        step={step} min={min}
        onChange={handleChange}
        onBlur={() => setDisplayValue(value.toFixed(2))} />
      <div className="qd-input-meta">
        {hasError && <span className="qd-error-tooltip">Min {min}</span>}
        {!hasError && (isOverridden ? (
          <span className="qd-override-badge" title="Manual override active">override</span>
        ) : (
          <span className="qd-auto-badge">auto</span>
        ))}
        {isOverridden && !hasError && (
          <button className="qd-reset-btn" onClick={onReset} title="Reset to calculated value">↺</button>
        )}
      </div>
    </div>
  );
}

function NumInput({ value, onChange, prefix, step = 0.01, min = 0 }: {
  value: number; onChange: (v: number) => void; prefix?: string; step?: number; min?: number;
}) {
  const [displayValue, setDisplayValue] = React.useState(value.toFixed(2));
  const [hasError, setHasError] = React.useState(false);

  React.useEffect(() => {
    const roundedProp = Math.round(value * 100) / 100;
    const currentDisplayNum = parseFloat(displayValue);
    if (isNaN(currentDisplayNum) || Math.abs(currentDisplayNum - roundedProp) > 0.001) {
      setDisplayValue(roundedProp.toFixed(2));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);
    const parsed = parseFloat(raw);
    
    if (!isNaN(parsed)) {
      if (parsed < min) {
        setHasError(true);
        setTimeout(() => setHasError(false), 1500);
        onChange(min);
      } else {
        onChange(Math.round(parsed * 100) / 100);
      }
    } else if (raw === "") {
      onChange(min);
    }
  };

  return (
    <div className={`qd-inline-input-wrap ${hasError ? "qd-input-error" : ""}`}>
      {prefix && <span className="qd-inline-prefix">{prefix}</span>}
      <input type="number" className="qd-inline-input"
        value={displayValue}
        step={step} min={min}
        onChange={handleChange}
        onBlur={() => setDisplayValue(value % 1 === 0 ? value.toString() : value.toFixed(2))} />
      {hasError && <div className="qd-input-meta"><span className="qd-error-tooltip">Min {min}</span></div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────── */

export function QuoteDetailClient({
  quote, batchQuotes, customer, profile, brandColor,
  userId, createdDate, expiresDate, dxfPreviews,
  materials, machines,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Batch part navigation ──
  const isBatch = batchQuotes.length > 1;
  const [activePartIndex, setActivePartIndex] = useState(() =>
    Math.max(0, batchQuotes.findIndex(q => q.id === quote.id))
  );
  const activeQuote = batchQuotes[activePartIndex] || quote;
  const activeDxf = dxfPreviews[activeQuote.id] || null;

  // Derived mat/mach for the active part
  const mat = activeQuote.materials || materials.find(m => m.id === activeQuote.material_id) || null;
  const mach = activeQuote.machine_profiles || machines.find(m => m.id === activeQuote.machine_id) || null;

  // ── Price Breaks (per active part) ──
  const [priceBreaks, setPriceBreaks] = useState<PriceBreak[]>(() => {
    if (activeQuote.price_breaks && Array.isArray(activeQuote.price_breaks) && activeQuote.price_breaks.length > 0) {
      return activeQuote.price_breaks;
    }
    return [{
      quantity: activeQuote.quantity || 1,
      unitPrice: activeQuote.unit_price || 0,
      totalPrice: activeQuote.total_price || 0,
      materialCostPerPart: activeQuote.material_cost || 0,
      cuttingCostPerPart: activeQuote.cutting_cost || 0,
      bendingCostPerPart: activeQuote.bending_cost || 0,
      setupCostPerPart: (activeQuote.setup_cost || 0) / (activeQuote.quantity || 1),
      setupCostTotal: activeQuote.setup_cost || 0,
      overrides: { material: null, cutting: null, bending: null, setup: null }
    }];
  });

  const primaryBreak = priceBreaks[0] || { quantity: 1, unitPrice: 0, totalPrice: 0 };

  const [markupPercent, setMarkupPercent] = useState(activeQuote.markup_percent ?? 15);
  const [thicknessMm, setThicknessMm] = useState(activeQuote.thickness_mm ?? 0);
  const [pierceCount, setPierceCount] = useState(activeQuote.pierce_count ?? 0);
  const [bendCount, setBendCount] = useState(activeQuote.bend_count ?? 0);
  const [materialId, setMaterialId] = useState(activeQuote.material_id ?? "");
  const [machineId, setMachineId] = useState(activeQuote.machine_id ?? "");
  const [customerId, setCustomerId] = useState<string | null>(quote.customer_id ?? null);
  const [customerRef, setCustomerRef] = useState(quote.customer_ref ?? "");
  const [expiresAt, setExpiresAt] = useState(quote.expires_at ? quote.expires_at.slice(0, 10) : "");
  const [notes, setNotes] = useState(quote.notes ?? "");

  // ── Sync part-specific state when switching parts ──
  React.useEffect(() => {
    const q = batchQuotes[activePartIndex] || quote;
    const breaks = (q.price_breaks && Array.isArray(q.price_breaks) && q.price_breaks.length > 0) ? q.price_breaks : [{
      quantity: q.quantity || 1, unitPrice: q.unit_price || 0, totalPrice: q.total_price || 0,
      materialCostPerPart: q.material_cost || 0, cuttingCostPerPart: q.cutting_cost || 0,
      bendingCostPerPart: q.bending_cost || 0,
      setupCostPerPart: (q.setup_cost || 0) / (q.quantity || 1), setupCostTotal: q.setup_cost || 0,
      overrides: { material: null, cutting: null, bending: null, setup: null }
    }];
    setPriceBreaks(breaks);
    setMarkupPercent(q.markup_percent ?? 15);
    setThicknessMm(q.thickness_mm ?? 0);
    setPierceCount(q.pierce_count ?? 0);
    setBendCount(q.bend_count ?? 0);
    setMaterialId(q.material_id ?? "");
    setMachineId(q.machine_id ?? "");
    setLayerIntents({});
    setPathIntents({});
  }, [activePartIndex]);

  // ── DXF layer/path intents ──
  const [layerIntents, setLayerIntents] = useState<Record<string, DXFIntent>>({});
  const [pathIntents, setPathIntents] = useState<Record<string, DXFIntent>>({});

  // Helper to clear an override for a specific break
  const resetOverride = (idx: number, field: keyof PriceBreak["overrides"]) => {
    setPriceBreaks(prev => prev.map((b, i) => i === idx ? {
      ...b, overrides: { ...b.overrides, [field]: null }
    } : b));
  };

  const updateOverride = (idx: number, field: keyof PriceBreak["overrides"], value: number | null) => {
    setPriceBreaks(prev => prev.map((b, i) => i === idx ? {
      ...b, overrides: { ...b.overrides, [field]: value }
    } : b));
  };

  const handleAddBreak = (qtyInput: number) => {
    if (qtyInput <= 0 || priceBreaks.some(pb => pb.quantity === qtyInput)) return;
    setPriceBreaks(prev => [...prev, {
      quantity: qtyInput,
      unitPrice: 0,
      totalPrice: 0,
      materialCostPerPart: 0,
      cuttingCostPerPart: 0,
      bendingCostPerPart: 0,
      setupCostPerPart: 0,
      setupCostTotal: 0,
      overrides: { material: null, cutting: null, bending: null, setup: null, markup: null }
    }].sort((a,b) => a.quantity - b.quantity));
  };

  const handleRemoveBreak = (idx: number) => {
    if (priceBreaks.length <= 1) return;
    setPriceBreaks(prev => prev.filter((_, i) => i !== idx));
  };

  const updateBreakQty = (idx: number, qty: number) => {
    setPriceBreaks(prev => prev.map((b, i) => i === idx ? { ...b, quantity: qty } : b));
  };

  // ── Effective Geometry (updates from DXF layers or quote data) ──
  const effectiveGeometry = useMemo(() => {
    if (activeDxf) {
      if (activeDxf.inputType !== "dxf" || !activeDxf.dxfData) return activeDxf;

      let newPerimeter = 0;
      let newPierceCount = 0;
      let autoBendCount = 0;

      activeDxf.dxfData.paths.forEach(p => {
        const intent = pathIntents[p.id] || layerIntents[p.layer] || "cut";
        if (intent === "cut") {
          newPerimeter += p.length;
          newPierceCount++;
        } else if (intent === "bend") {
          autoBendCount++;
        }
      });

      return {
        ...activeDxf,
        perimeter: newPerimeter,
        pierceCount: newPierceCount,
        bendCount: autoBendCount,
      };
    }
    
    // Fallback to active quote's stored data
    return {
      inputType: activeQuote.input_type,
      perimeter: activeQuote.perimeter_mm || 0,
      partArea: activeQuote.part_area_mm2 || 0,
      boundingWidth: activeQuote.bounding_width_mm || 0,
      boundingHeight: activeQuote.bounding_height_mm || 0,
      thickness: activeQuote.thickness_mm || 0,
      bendCount: activeQuote.bend_count || 0,
      pierceCount: activeQuote.pierce_count || 0,
    } as PricingGeometry;
  }, [activeDxf, activeQuote, layerIntents, pathIntents]);

  // ── Live Recalculation (All Breaks) ──
  React.useEffect(() => {
    if (!editing || !effectiveGeometry) return;

    const selectedMat = materials.find(m => m.id === materialId);
    const selectedMach = machines.find(m => m.id === machineId);
    if (!selectedMat || !selectedMach) return;

    const thick = thicknessMm || effectiveGeometry.thickness || 1;
    const feedRate = getFeedRateWithCustom(selectedMach.feed_rates, selectedMat.category, thick, selectedMach.power_kw ?? 4);

    // Calculate all breaks
    const updatedBreaks = priceBreaks.map(pb => {
      const r = calculatePrice({
        geometry: { ...effectiveGeometry, thickness: thick },
        materialCostPerKg: selectedMat.cost_per_kg,
        materialDensityKgM3: selectedMat.density_kg_m3,
        scrapValuePerKg: selectedMat.scrap_value_per_kg ?? 0,
        machineHourlyRate: selectedMach.hourly_rate,
        feedRateMmPerMin: feedRate,
        pierceTimeSeconds: selectedMach.pierce_time_seconds ?? 0.5,
        setupTimeMinutes: selectedMach.setup_time_minutes ?? 15,
        costPerBend: selectedMach.cost_per_bend ?? 2.5,
        quantity: pb.quantity,
        markupPercent,
        wasteFactor: 1.15,
      });

      const m = pb.overrides.material ?? r.materialCostPerPart;
      const c = pb.overrides.cutting  ?? r.cuttingCostPerPart;
      const b = pb.overrides.bending  ?? r.bendingCostPerPart;
      const s = pb.overrides.setup    ?? r.setupCostTotal;
      const mup = pb.overrides.markup ?? markupPercent;

      const net = m + c + b + (s / pb.quantity);
      const unit = net * (1 + mup / 100);

      return {
        ...pb,
        materialCostPerPart: m,
        cuttingCostPerPart: c,
        bendingCostPerPart: b,
        setupCostTotal: s,
        setupCostPerPart: s / pb.quantity,
        unitPrice: unit,
        totalPrice: unit * pb.quantity,
      };
    });

    setPriceBreaks(updatedBreaks);
  }, [editing, effectiveGeometry, materialId, machineId, thicknessMm, markupPercent, materials, machines]);

  // ── Edit-mode summary (based on primary break) ──
  const unitPrice = primaryBreak.unitPrice;
  const totalPrice = primaryBreak.totalPrice;
  const quantity = primaryBreak.quantity;
  
  const netCost = (primaryBreak.materialCostPerPart) + (primaryBreak.cuttingCostPerPart) + (primaryBreak.bendingCostPerPart) + (primaryBreak.setupCostPerPart);
  const grossMargin = unitPrice > 0 ? ((unitPrice - netCost) / unitPrice * 100) : null;

  // ── View-mode prices (from active part's server data) ──
  const viewNetCost = (activeQuote.material_cost ?? 0) + (activeQuote.cutting_cost ?? 0) + (activeQuote.bending_cost ?? 0) + ((activeQuote.setup_cost ?? 0) / Math.max(activeQuote.quantity ?? 1, 1));
  const viewGrossMargin = activeQuote.unit_price ? ((activeQuote.unit_price - viewNetCost) / activeQuote.unit_price * 100) : null;

  function resetFields() {
    const q = batchQuotes[activePartIndex] || quote;
    const breaks = (q.price_breaks && Array.isArray(q.price_breaks) && q.price_breaks.length > 0) ? q.price_breaks : [{
      quantity: q.quantity || 1, unitPrice: q.unit_price || 0, totalPrice: q.total_price || 0,
      materialCostPerPart: q.material_cost || 0, cuttingCostPerPart: q.cutting_cost || 0,
      bendingCostPerPart: q.bending_cost || 0,
      setupCostPerPart: (q.setup_cost || 0) / (q.quantity || 1), setupCostTotal: q.setup_cost || 0,
      overrides: { material: null, cutting: null, bending: null, setup: null, markup: null }
    }];
    setPriceBreaks(breaks);
    setMarkupPercent(q.markup_percent ?? 15);
    setThicknessMm(q.thickness_mm ?? 0);
    setPierceCount(q.pierce_count ?? 0);
    setBendCount(q.bend_count ?? 0);
    setMaterialId(q.material_id ?? "");
    setMachineId(q.machine_id ?? "");
    setCustomerId(quote.customer_id ?? null);
    setCustomerRef(quote.customer_ref ?? "");
    setExpiresAt(quote.expires_at ? quote.expires_at.slice(0, 10) : "");
    setNotes(quote.notes ?? "");
    setLayerIntents({});
    setPathIntents({});
  }

  function handleCancel() { resetFields(); setEditing(false); }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    
    const primary = priceBreaks[0];

    // Part-specific data (saved to activeQuote)
    const partData: any = {
      material_cost: primary.overrides.material ?? primary.materialCostPerPart,
      cutting_cost: primary.overrides.cutting ?? primary.cuttingCostPerPart,
      bending_cost: primary.overrides.bending ?? primary.bendingCostPerPart,
      setup_cost: primary.overrides.setup ?? primary.setupCostTotal,
      markup_percent: markupPercent,
      quantity: primary.quantity,
      unit_price: +(primary.unitPrice).toFixed(2),
      total_price: +(primary.totalPrice).toFixed(2),
      price_breaks: priceBreaks,
      thickness_mm: thicknessMm || (effectiveGeometry?.thickness ?? null),
      pierce_count: effectiveGeometry?.pierceCount ?? pierceCount,
      bend_count: effectiveGeometry?.bendCount ?? bendCount,
      material_id: materialId || null,
      machine_id: machineId || null,
      updated_at: new Date().toISOString(),
    };

    // Shared data (applied to all parts in the batch)
    const sharedData: any = {
      customer_id: customerId || null,
      customer_ref: customerRef.trim() || null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      notes: notes.trim() || null,
      ...(customerId ? { customer_name: null, customer_email: null } : {}),
    };

    // Save the active part
    const { error } = await supabase.from("quotes").update({ ...partData, ...sharedData }).eq("id", activeQuote.id);
    if (error) { alert("Failed to save: " + error.message); setSaving(false); return; }

    // Sync shared fields to rest of batch
    if (quote.group_id) {
      await supabase.from("quotes").update(sharedData)
        .eq("group_id", quote.group_id)
        .neq("id", activeQuote.id);
    }

    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  // Selected material / machine for display
  const displayMat = editing ? materials.find(m => m.id === materialId) ?? mat : mat;
  const displayMach = editing ? machines.find(m => m.id === machineId) ?? mach : mach;



  return (
    <>
      <div className="dash-page quote-detail-page" id="quote-printable">
        {/* ── Header ── */}
        <div className="dash-page-header no-print">
          <div>
            <div className="qd-breadcrumb">
              <Link href="/dashboard/quotes" className="qd-breadcrumb-link">{"\u2190"} Quotes</Link>
            </div>
            <h1 className="dash-page-title">
              {quote.quote_number && <span style={{ color: "var(--text-dim)", fontWeight: 400, marginRight: 8 }}>{quote.quote_number}</span>}
              {customer?.company_name ? String(customer.company_name) : activeQuote.filename}
            </h1>
            {createdDate && (
              <p className="dash-page-subtitle">
                {String(customer?.company_name ?? "") && <span>{activeQuote.filename} · </span>}
                {String(customer?.name ?? "") && <span>{String(customer?.name)} · </span>}
                Created {createdDate}
                {expiresDate && " \u00B7 "}
                {expiresDate && <span style={{ color: "var(--brand-primary)", fontWeight: 500 }}>Valid until {expiresDate}</span>}
              </p>
            )}
          </div>
          <div className="qd-header-actions">
            {!editing ? (
              <button onClick={() => { resetFields(); setEditing(true); }} className="btn-ghost" style={{ fontSize: 13 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit Quote
              </button>
            ) : (
              <>
                <button onClick={handleSave} disabled={saving || !customerId} className="btn-primary" style={{ fontSize: 13 }}>
                  {saving ? "Saving\u2026" : !customerId ? "Select Customer" : "Save Changes"}
                </button>
                <button onClick={handleCancel} className="btn-ghost" style={{ fontSize: 13 }}>Cancel</button>
              </>
            )}
            <PdfPreviewButton quotes={batchQuotes} profile={profile} brandColor={brandColor} customer={customer} />
            <PdfDownloadButton quotes={batchQuotes} profile={profile} brandColor={brandColor} customer={customer} />
          </div>
        </div>

        {/* ── Print header ── */}
        <div className="print-only qd-print-header">
          <div className="qd-print-brand">
            <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
              <polygon points="20,2 38,11 38,29 20,38 2,29 2,11" fill="none" stroke="#ff6600" strokeWidth="3"/>
              <polygon points="20,10 30,15 30,25 20,30 10,25 10,15" fill="none" stroke="#ff8533" strokeWidth="2"/>
              <polygon points="20,18 25,20.5 25,25.5 20,28 15,25.5 15,20.5" fill="#ff6600"/>
            </svg>
            <strong>Mechlytix</strong>
          </div>
          <div>
            <p className="qd-print-ref">Quote Reference: {quote.id.slice(0, 8).toUpperCase()}</p>
            {createdDate && <p className="qd-print-date">Date: {createdDate}</p>}
            {expiresDate && <p className="qd-print-date">Valid Until: {expiresDate}</p>}
          </div>
        </div>



        <div className={`qd-layout ${editing ? "qd-layout--editing" : ""} ${isBatch ? "qd-layout--batch" : ""}`}>
          {/* ══ Batch Parts Sidebar ══ */}
          {isBatch && (
            <div className="quoter-items-sidebar no-print">
              <div className="sidebar-header">
                <h3 className="sidebar-title">Parts</h3>
                <span className="item-count-badge">{batchQuotes.length}</span>
              </div>
              <div className="items-list">
                {batchQuotes.map((bq, idx) => (
                  <button
                    key={bq.id}
                    className={`item-tab ${activePartIndex === idx ? "active" : ""}`}
                    onClick={() => setActivePartIndex(idx)}
                  >
                    <div className="item-tab-info">
                      <span className="item-tab-name">{bq.filename}</span>
                      <span className="item-tab-meta">
                        Qty {bq.quantity || 1} · {fmt(bq.unit_price)}/ea
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ══ Left column ══ */}
          <div className="qd-left">
              {/* DXF Viewer Container */}
              {(activeDxf || activeQuote.input_type === "dxf") && (
                <div className="qd-section-card no-print" style={{ padding: 0, overflow: 'hidden', height: 500, background: 'var(--bg-secondary)', borderRadius: 12, marginBottom: 16 }}>
                  {activeDxf ? (
                    <DxfViewer
                      geometry={effectiveGeometry || activeDxf}
                      layerIntents={layerIntents}
                      pathIntents={pathIntents}
                      onPathClick={editing ? (id, currentIntent) => {
                        const next: DXFIntent = currentIntent === "cut" ? "bend" : currentIntent === "bend" ? "ignore" : "cut";
                        setPathIntents(prev => ({ ...prev, [id]: next }));
                      } : undefined}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>
                      No DXF preview available
                    </div>
                  )}
                </div>
              )}

              {/* Geometry Stats Card */}
              {effectiveGeometry && (
                <div className="geo-card" style={{ marginBottom: 16 }}>
                  <div className="geo-grid">
                    <div className="geo-item">
                      <span className="geo-label">Flat Pattern</span>
                      <span className="geo-value">{fmtMm(effectiveGeometry.boundingWidth)} × {fmtMm(effectiveGeometry.boundingHeight)}</span>
                    </div>
                    <div className="geo-item">
                      <span className="geo-label">Cut Length</span>
                      <span className="geo-value">{fmtMm(effectiveGeometry.perimeter)}</span>
                    </div>
                    <div className="geo-item">
                      <span className="geo-label">Pierces</span>
                      <span className="geo-value">{effectiveGeometry.pierceCount}</span>
                    </div>
                    <div className="geo-item">
                      <span className="geo-label">Bends</span>
                      <span className="geo-value">{effectiveGeometry.bendCount > 0 ? effectiveGeometry.bendCount : "—"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Layer toggles — only in edit mode */}
              {editing && activeDxf && activeDxf.dxfData && activeDxf.dxfData.layers.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>DXF Layers</p>
                  <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "-2px 0 4px" }}>Map layers to operations, or click lines on the drawing.</p>
                  {activeDxf!.dxfData!.layers.map(layer => {
                    const currentIntent = layerIntents[layer.name] || "cut";
                    return (
                      <div key={layer.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderRadius: 6, background: "rgba(128,128,128,0.06)" }}>
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
              )}

            {/* ── Price card ── */}
            <div className={`qd-price-card ${editing ? "qd-editing" : ""}`}>
              <div className="qd-price-header">
                <div>
                  <p className="qd-price-filename">{activeQuote.filename}</p>
                  <div className="qd-price-display">
                    <span className="qd-unit-price">{fmt(editing ? unitPrice : activeQuote.unit_price)}</span>
                    <span className="qd-per-part">/ part</span>
                  </div>
                  <p className="qd-total-line">
                    Qty {editing ? quantity : (activeQuote.quantity ?? 1)} {"\u00D7"} {fmt(editing ? unitPrice : activeQuote.unit_price)} ={" "}
                    <strong>{fmt(editing ? totalPrice : activeQuote.total_price)}</strong>
                  </p>
                </div>
                <div className="qd-badges">
                  <span className="input-type-badge">{activeQuote.input_type}</span>
                  {(editing ? grossMargin : viewGrossMargin) != null && (
                    <span className="qd-margin-badge">
                      {(editing ? grossMargin! : viewGrossMargin!).toFixed(0)}% margin
                    </span>
                  )}
                </div>
              </div>

              {/* Pricing Tiers Table */}
              <div className="qd-pricing-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 className="qd-section-title" style={{ margin: 0 }}>Pricing Tiers</h3>
                  {!editing && (
                    <div className="qd-badges">
                      <span className="input-type-badge">{activeQuote.input_type}</span>
                      {viewGrossMargin != null && (
                        <span className="qd-margin-badge">
                          {viewGrossMargin.toFixed(0)}% margin
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="quoter-tier-table-wrapper">
                  <table className="quoter-tier-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", width: 80 }}>QTY</th>
                        <th style={{ textAlign: "right" }}>MATERIAL</th>
                        <th style={{ textAlign: "right" }}>CUTTING</th>
                        <th style={{ textAlign: "right" }}>BENDING</th>
                        <th style={{ textAlign: "right" }}>SETUP</th>
                        <th style={{ textAlign: "right", width: 90 }}>MARKUP %</th>
                        <th style={{ textAlign: "left", paddingLeft: "1.5rem" }}>LEAD TIME</th>
                        <th style={{ textAlign: "right" }}>UNIT PRICE</th>
                        {editing && <th style={{ width: 40 }}></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {priceBreaks.map((pb, i) => (
                        <tr key={i} className={!editing && pb.quantity === activeQuote.quantity ? "current" : ""}>
                          <td>
                            {editing ? (
                              <input 
                                type="number" 
                                className="tier-editable-input" 
                                value={pb.quantity} 
                                onChange={(e) => updateBreakQty(i, Math.max(1, +e.target.value))} 
                                style={{ textAlign: "left", width: 60 }} 
                              />
                            ) : (
                              <span style={{ fontWeight: 600 }}>{pb.quantity}</span>
                            )}
                          </td>
                          <td className="tier-val-auto">{fmt(pb.materialCostPerPart)}</td>
                          <td className="tier-val-auto">{fmt(pb.cuttingCostPerPart)}</td>
                          <td className="tier-val-auto">{fmt(pb.bendingCostPerPart)}</td>
                          <td className="tier-val-auto">{fmt(pb.setupCostPerPart)}</td>
                          <td className="tier-input-cell">
                            {editing ? (
                              <>
                                <input 
                                  className={`tier-editable-input ${pb.overrides.markup !== null ? "overridden" : ""}`}
                                  value={pb.overrides.markup ?? markupPercent}
                                  onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    updateOverride(i, "markup", isNaN(v) ? null : v);
                                  }}
                                  style={{ textAlign: "right", paddingRight: 16 }} 
                                />
                                <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-dim)" }}>%</span>
                              </>
                            ) : (
                              <span>{pb.overrides.markup ?? markupPercent}%</span>
                            )}
                          </td>
                          <td style={{ textAlign: "left", paddingLeft: "1.5rem" }}>
                            {editing ? (
                              <input 
                                className="tier-editable-input" 
                                value={pb.leadTime ?? ""} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPriceBreaks(prev => prev.map((b, idx) => idx === i ? { ...b, leadTime: val } : b));
                                }} 
                                style={{ textAlign: "left" }} 
                              />
                            ) : (
                              <span>{pb.leadTime || quote.lead_time || "\u2014"}</span>
                            )}
                          </td>
                          <td className="tier-val-highlight">{fmt(pb.unitPrice)}</td>
                          {editing && (
                            <td>
                              {priceBreaks.length > 1 && (
                                <button className="btn-tier-remove" onClick={() => handleRemoveBreak(i)}>×</button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {editing && (
                    <div className="tier-add-row">
                      <input 
                        type="number" 
                        className="tier-add-input" 
                        placeholder="Add Qty..." 
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleAddBreak(+e.currentTarget.value);
                            e.currentTarget.value = "";
                          }
                        }}
                      />
                      <button className="btn-tier-add" onClick={(e) => {
                        const input = e.currentTarget.previousSibling as HTMLInputElement;
                        if (input.value) {
                          handleAddBreak(+input.value);
                          input.value = "";
                        }
                      }}>Add Tier</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Basic Configuration Panel (Edit mode only) */}
            {editing && (
              <div className="config-panel" style={{ marginTop: 16 }}>
                <h3 className="config-title">Basic Configuration</h3>
                <div className="config-grid">
                  <div className="form-field">
                    <label>Material</label>
                    <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.grade})</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Machine</label>
                    <select value={machineId} onChange={(e) => setMachineId(e.target.value)}>
                      {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Thickness (mm)</label>
                    <input type="number" step="0.1" value={thicknessMm} onChange={(e) => setThicknessMm(+e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>Bends</label>
                    <input type="number" value={bendCount} onChange={(e) => setBendCount(+e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>Markup (%)</label>
                    <input type="number" value={markupPercent} onChange={(e) => setMarkupPercent(+e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>


          {/* ══ Right column ══ */}
          <div className="qd-right">
            {/* Status */}
            <div className="qd-section-card no-print">
              <h3 className="qd-section-title">Status</h3>
              <QuoteStatusManager
                quoteId={quote.id}
                currentStatus={quote.status as "draft" | "sent" | "accepted" | "rejected" | "expired"}
                customerEmail={quote.customer_email}
                customerName={quote.customer_name}
              />
            </div>

            {/* Customer */}
            <div className={`qd-section-card ${editing ? "qd-editing" : ""}`}>
              <h3 className="qd-section-title">Customer</h3>
              {editing ? (
                <div className="qd-edit-fields">
                  <div className="form-field">
                    <label>Customer</label>
                    <CustomerSelector userId={userId} value={customerId} onChange={(id) => setCustomerId(id)} />
                  </div>
                  <div className="form-field">
                    <label>Reference / PO</label>
                    <input type="text" value={customerRef} onChange={e => setCustomerRef(e.target.value)} placeholder="e.g. PO-2024-0081" />
                  </div>
                  <div className="form-field">
                    <label>Expiry Date</label>
                    <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
                    <span className="field-hint">Leave blank for no expiry</span>
                  </div>
                </div>
              ) : (
              <div className="qd-detail-list">
                  {Boolean(customer?.company_name) && <div className="qd-detail-row"><span className="qd-dl-label">Company</span><span className="qd-dl-value" style={{ fontWeight: 600 }}>{String(customer!.company_name)}</span></div>}
                  <div className="qd-detail-row"><span className="qd-dl-label">Contact</span><span className="qd-dl-value">{customer?.name ? String(customer.name) : (quote.customer_name ?? "\u2014")}</span></div>
                  <div className="qd-detail-row"><span className="qd-dl-label">Email</span><span className="qd-dl-value">{(customer?.email || quote.customer_email) ? <a href={`mailto:${customer?.email ? String(customer.email) : quote.customer_email}`} className="qd-email-link">{customer?.email ? String(customer.email) : quote.customer_email}</a> : "\u2014"}</span></div>
                  <div className="qd-detail-row"><span className="qd-dl-label">Reference</span><span className="qd-dl-value">{quote.customer_ref ?? "\u2014"}</span></div>
                  <div className="qd-detail-row"><span className="qd-dl-label">Quantity</span><span className="qd-dl-value">{activeQuote.quantity ?? 1}</span></div>
                  {expiresDate && <div className="qd-detail-row"><span className="qd-dl-label">Expires</span><span className="qd-dl-value">{expiresDate}</span></div>}
                </div>
              )}
            </div>

            {/* Material & Machine */}
            <div className={`qd-section-card ${editing ? "qd-editing" : ""}`}>
              <h3 className="qd-section-title">Material & Machine</h3>
              {editing ? (
                <div className="qd-edit-fields">
                  <div className="form-field">
                    <label>Material</label>
                    <select value={materialId} onChange={e => setMaterialId(e.target.value)}>
                      <option value="">-- Select --</option>
                      {materials.map(m => <option key={m.id} value={m.id}>{m.name}{m.grade ? ` (${m.grade})` : ""}</option>)}
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Machine</label>
                    <select value={machineId} onChange={e => setMachineId(e.target.value)}>
                      <option value="">-- Select --</option>
                      {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="qd-detail-list">
                  {displayMat && (
                    <>
                      <div className="qd-detail-row"><span className="qd-dl-label">Material</span><span className="qd-dl-value"><span className="material-dot" style={{ background: displayMat.color_hex ?? "#888", display: "inline-block", marginRight: 6 }} />{displayMat.name}{displayMat.grade ? ` (${displayMat.grade})` : ""}</span></div>
                      <div className="qd-detail-row"><span className="qd-dl-label">Cost/kg</span><span className="qd-dl-value">{"\u00A3"}{displayMat.cost_per_kg?.toFixed(2) ?? "\u2014"}</span></div>
                      <div className="qd-detail-row"><span className="qd-dl-label">Density</span><span className="qd-dl-value">{displayMat.density_kg_m3?.toLocaleString()} kg/m{"\u00B3"}</span></div>
                    </>
                  )}
                  {displayMach && (
                    <>
                      <div className="qd-detail-row" style={{ marginTop: 8 }}><span className="qd-dl-label">Machine</span><span className="qd-dl-value">{displayMach.name}</span></div>
                      <div className="qd-detail-row"><span className="qd-dl-label">Rate</span><span className="qd-dl-value">{"\u00A3"}{displayMach.hourly_rate?.toFixed(0) ?? "\u2014"}/hr</span></div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className={`qd-section-card ${editing ? "qd-editing" : ""}`}>
              <h3 className="qd-section-title">Notes</h3>
              {editing ? (
                <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Material spec, delivery requirements, revision notes..."
                  className="qd-notes-textarea" />
              ) : (
                <p className="qd-notes-text">{quote.notes || "\u2014 No notes"}</p>
              )}
            </div>

            {/* Share */}
            <div className="qd-section-card no-print">
              <h3 className="qd-section-title">Share with Customer</h3>
              <QuoteShareButton quoteId={quote.id} shareToken={quote.share_token} shareEnabled={Boolean(quote.share_enabled)} />
            </div>

            {/* Attachments */}
            <QuoteAttachments quoteId={quote.id} userId={userId} initialAttachments={quote.quote_attachments || []} />

            {/* Print-only status */}
            <div className="print-only qd-print-status">
              <p>Status: <strong style={{ textTransform: "capitalize" }}>{quote.status}</strong></p>
              {quote.markup_percent != null && <p>Markup: {quote.markup_percent}%</p>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
