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
import type { PricingGeometry, DXFIntent } from "@/lib/pricing/types";

/* ─────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────── */

interface Material {
  id: string; name: string; grade: string | null; category: string;
  color_hex: string | null; cost_per_kg: number; density_kg_m3: number;
}

interface Machine {
  id: string; name: string; machine_type: string | null;
  hourly_rate: number; power_kw: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>;

interface Props {
  quote: Quote;
  mat: Material | null;
  mach: Machine | null;
  customer: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  brandColor: string;
  userId: string;
  createdDate: string | null;
  expiresDate: string | null;
  dxfPreview: PricingGeometry | null;
  materials: Material[];
  machines: Machine[];
}

/* ─────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────── */

function fmt(n: number | null | undefined, prefix = "\u00A3", dp = 2) {
  if (n == null) return "\u2014";
  return `${prefix}${n.toFixed(dp)}`;
}
function fmtMm(n: number | null | undefined) {
  if (n == null) return "\u2014";
  return `${n.toFixed(1)} mm`;
}

/* ─────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────── */

export function QuoteDetailClient({
  quote, mat, mach, customer, profile, brandColor,
  userId, createdDate, expiresDate, dxfPreview,
  materials, machines,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Editable fields ──
  const [materialCost, setMaterialCost] = useState(quote.material_cost ?? 0);
  const [cuttingCost, setCuttingCost] = useState(quote.cutting_cost ?? 0);
  const [bendingCost, setBendingCost] = useState(quote.bending_cost ?? 0);
  const [setupCost, setSetupCost] = useState(quote.setup_cost ?? 0);
  const [markupPercent, setMarkupPercent] = useState(quote.markup_percent ?? 15);
  const [quantity, setQuantity] = useState(quote.quantity ?? 1);
  const [thicknessMm, setThicknessMm] = useState(quote.thickness_mm ?? 0);
  const [pierceCount, setPierceCount] = useState(quote.pierce_count ?? 0);
  const [bendCount, setBendCount] = useState(quote.bend_count ?? 0);
  const [materialId, setMaterialId] = useState(quote.material_id ?? "");
  const [machineId, setMachineId] = useState(quote.machine_id ?? "");
  const [customerId, setCustomerId] = useState<string | null>(quote.customer_id ?? null);
  const [customerRef, setCustomerRef] = useState(quote.customer_ref ?? "");
  const [expiresAt, setExpiresAt] = useState(quote.expires_at ? quote.expires_at.slice(0, 10) : "");
  const [notes, setNotes] = useState(quote.notes ?? "");

  // ── DXF layer/path intents ──
  const [layerIntents, setLayerIntents] = useState<Record<string, DXFIntent>>({});
  const [pathIntents, setPathIntents] = useState<Record<string, DXFIntent>>({});

  // ── Derived prices ──
  const netCost = useMemo(() =>
    materialCost + cuttingCost + bendingCost + (setupCost / Math.max(quantity, 1)),
    [materialCost, cuttingCost, bendingCost, setupCost, quantity]
  );
  const unitPrice = useMemo(() => netCost * (1 + markupPercent / 100), [netCost, markupPercent]);
  const totalPrice = useMemo(() => unitPrice * quantity, [unitPrice, quantity]);
  const grossMargin = unitPrice > 0 ? ((unitPrice - netCost) / unitPrice * 100) : null;

  // ── View-mode prices (from server data) ──
  const viewNetCost = (quote.material_cost ?? 0) + (quote.cutting_cost ?? 0) + (quote.bending_cost ?? 0) + ((quote.setup_cost ?? 0) / Math.max(quote.quantity ?? 1, 1));
  const viewGrossMargin = quote.unit_price ? ((quote.unit_price - viewNetCost) / quote.unit_price * 100) : null;

  function resetFields() {
    setMaterialCost(quote.material_cost ?? 0);
    setCuttingCost(quote.cutting_cost ?? 0);
    setBendingCost(quote.bending_cost ?? 0);
    setSetupCost(quote.setup_cost ?? 0);
    setMarkupPercent(quote.markup_percent ?? 15);
    setQuantity(quote.quantity ?? 1);
    setThicknessMm(quote.thickness_mm ?? 0);
    setPierceCount(quote.pierce_count ?? 0);
    setBendCount(quote.bend_count ?? 0);
    setMaterialId(quote.material_id ?? "");
    setMachineId(quote.machine_id ?? "");
    setCustomerId(quote.customer_id ?? null);
    setCustomerRef(quote.customer_ref ?? "");
    setExpiresAt(quote.expires_at ? quote.expires_at.slice(0, 10) : "");
    setNotes(quote.notes ?? "");
  }

  function handleCancel() { resetFields(); setEditing(false); }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("quotes").update({
      material_cost: materialCost, cutting_cost: cuttingCost,
      bending_cost: bendingCost, setup_cost: setupCost,
      markup_percent: markupPercent, quantity: Math.max(1, quantity),
      unit_price: +unitPrice.toFixed(2), total_price: +totalPrice.toFixed(2),
      thickness_mm: thicknessMm || null,
      pierce_count: pierceCount, bend_count: bendCount,
      material_id: materialId || null, machine_id: machineId || null,
      customer_id: customerId || null,
      customer_ref: customerRef.trim() || null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", quote.id);

    if (error) { alert("Failed to save: " + error.message); setSaving(false); return; }
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  // Selected material / machine for display in view mode during edit
  const displayMat = editing ? materials.find(m => m.id === materialId) ?? mat : mat;
  const displayMach = editing ? machines.find(m => m.id === machineId) ?? mach : mach;

  /* ── Small input helper ── */
  function NumInput({ value, onChange, prefix, step = 0.01, min = 0 }: {
    value: number; onChange: (v: number) => void; prefix?: string; step?: number; min?: number;
  }) {
    return (
      <div className="qd-inline-input-wrap">
        {prefix && <span className="qd-inline-prefix">{prefix}</span>}
        <input type="number" className="qd-inline-input"
          value={Math.round(value * 100) / 100}
          step={step} min={min}
          onChange={e => onChange(+(parseFloat(e.target.value) || 0).toFixed(2))} />
      </div>
    );
  }

  return (
    <>
      <div className="dash-page quote-detail-page" id="quote-printable">
        {/* ── Header ── */}
        <div className="dash-page-header no-print">
          <div>
            <div className="qd-breadcrumb">
              <Link href="/dashboard/quotes" className="qd-breadcrumb-link">{"\u2190"} Quotes</Link>
            </div>
            <h1 className="dash-page-title">{quote.filename}</h1>
            {createdDate && (
              <p className="dash-page-subtitle">
                {quote.quote_number && <strong>{quote.quote_number}</strong>}
                {quote.quote_number && " \u00B7 "}
                Created {createdDate}
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
                <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ fontSize: 13 }}>
                  {saving ? "Saving\u2026" : "Save Changes"}
                </button>
                <button onClick={handleCancel} className="btn-ghost" style={{ fontSize: 13 }}>Cancel</button>
              </>
            )}
            <PdfPreviewButton quote={quote} profile={profile} mat={mat} mach={mach} brandColor={brandColor} customer={customer} />
            <PdfDownloadButton quote={quote} profile={profile} mat={mat} mach={mach} brandColor={brandColor} customer={customer} />
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
          </div>
        </div>

        {/* ── DXF Preview (full width, above grid) ── */}
        {dxfPreview && (
          <div className="qd-section-card no-print">
            <h3 className="qd-section-title">Interactive Preview</h3>
            <div style={{ height: 450, width: "100%" }}>
              <DxfViewer
                geometry={dxfPreview}
                layerIntents={layerIntents}
                pathIntents={pathIntents}
                onPathClick={editing ? (id, currentIntent) => {
                  const next: DXFIntent = currentIntent === "cut" ? "bend" : currentIntent === "bend" ? "ignore" : "cut";
                  setPathIntents(prev => ({ ...prev, [id]: next }));
                } : undefined}
              />
            </div>

            {/* Layer toggles — only in edit mode */}
            {editing && dxfPreview.dxfData && dxfPreview.dxfData.layers.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>DXF Layers</p>
                <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "-2px 0 4px" }}>Map layers to operations, or click lines on the drawing.</p>
                {dxfPreview.dxfData.layers.map(layer => {
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
          </div>
        )}

        <div className={`qd-layout ${editing ? "qd-layout--editing" : ""}`}>
          {/* ══ Left column ══ */}
          <div className="qd-left">
            {/* ── Price card ── */}
            <div className={`qd-price-card ${editing ? "qd-editing" : ""}`}>
              <div className="qd-price-header">
                <div>
                  <p className="qd-price-filename">{quote.filename}</p>
                  <div className="qd-price-display">
                    <span className="qd-unit-price">{fmt(editing ? unitPrice : quote.unit_price)}</span>
                    <span className="qd-per-part">/ part</span>
                  </div>
                  <p className="qd-total-line">
                    Qty {editing ? quantity : (quote.quantity ?? 1)} {"\u00D7"} {fmt(editing ? unitPrice : quote.unit_price)} ={" "}
                    <strong>{fmt(editing ? totalPrice : quote.total_price)}</strong>
                  </p>
                </div>
                <div className="qd-badges">
                  <span className="input-type-badge">{quote.input_type}</span>
                  {(editing ? grossMargin : viewGrossMargin) != null && (
                    <span className="qd-margin-badge">
                      {(editing ? grossMargin! : viewGrossMargin!).toFixed(0)}% margin
                    </span>
                  )}
                </div>
              </div>

              {/* Cost breakdown */}
              <div className="qd-breakdown">
                <h3 className="qd-section-title">Cost Breakdown</h3>
                {editing ? (
                  <>
                    <div className="breakdown-row"><span className="breakdown-label">Material</span><NumInput value={materialCost} onChange={setMaterialCost} prefix={"\u00A3"} /></div>
                    <div className="breakdown-row"><span className="breakdown-label">Cutting</span><NumInput value={cuttingCost} onChange={setCuttingCost} prefix={"\u00A3"} /></div>
                    <div className="breakdown-row"><span className="breakdown-label">Bending</span><NumInput value={bendingCost} onChange={setBendingCost} prefix={"\u00A3"} /></div>
                    <div className="breakdown-row"><span className="breakdown-label">Setup (total)</span><NumInput value={setupCost} onChange={setSetupCost} prefix={"\u00A3"} /></div>
                    <div className="breakdown-row net">
                      <span className="breakdown-label">Net cost (per part)</span>
                      <span className="breakdown-value">{fmt(netCost)}</span>
                    </div>
                    <div className="breakdown-row markup">
                      <span className="breakdown-label">Markup</span>
                      <NumInput value={markupPercent} onChange={setMarkupPercent} prefix="%" step={1} />
                    </div>
                    <div className="breakdown-row">
                      <span className="breakdown-label">Quantity</span>
                      <NumInput value={quantity} onChange={v => setQuantity(Math.max(1, Math.round(v)))} step={1} min={1} />
                    </div>
                    <div className="breakdown-row total-row">
                      <span className="breakdown-label">Unit Price</span>
                      <span className="breakdown-value highlight">{fmt(unitPrice)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    {[
                      { label: "Material", value: quote.material_cost, note: quote.thickness_mm != null ? `${quote.thickness_mm}mm` : null },
                      { label: "Cutting", value: quote.cutting_cost, note: null },
                      { label: "Bending", value: quote.bending_cost, note: quote.bend_count != null && quote.bend_count > 0 ? `${quote.bend_count} bends` : null },
                      { label: "Setup (total)", value: quote.setup_cost, note: null },
                    ].map(row => row.value != null && row.value > 0 ? (
                      <div key={row.label} className="breakdown-row">
                        <span className="breakdown-label">{row.label}</span>
                        {row.note && <span className="breakdown-note">{row.note}</span>}
                        <span className="breakdown-value">{fmt(row.value)}</span>
                      </div>
                    ) : null)}
                    <div className="breakdown-row net">
                      <span className="breakdown-label">Net cost (per part)</span>
                      <span className="breakdown-value">{fmt(viewNetCost)}</span>
                    </div>
                    <div className="breakdown-row markup">
                      <span className="breakdown-label">Markup ({quote.markup_percent ?? "\u2014"}%)</span>
                      <span className="breakdown-value">+{quote.unit_price != null ? fmt(quote.unit_price - viewNetCost) : "\u2014"}</span>
                    </div>
                    <div className="breakdown-row total-row">
                      <span className="breakdown-label">Unit Price</span>
                      <span className="breakdown-value highlight">{fmt(quote.unit_price)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Geometry ── */}
            <div className={`qd-section-card ${editing ? "qd-editing" : ""}`}>
              <h3 className="qd-section-title">Part Geometry</h3>
              <div className="qd-detail-grid">
                <div className="qd-detail-item">
                  <span className="qd-detail-label">Flat Pattern</span>
                  <span className="qd-detail-value">
                    {quote.bounding_width_mm != null && quote.bounding_height_mm != null
                      ? `${fmtMm(quote.bounding_width_mm)} \u00D7 ${fmtMm(quote.bounding_height_mm)}`
                      : "\u2014"}
                  </span>
                </div>
                <div className="qd-detail-item">
                  <span className="qd-detail-label">Thickness</span>
                  {editing ? <NumInput value={thicknessMm} onChange={setThicknessMm} step={0.1} /> : <span className="qd-detail-value">{fmtMm(quote.thickness_mm)}</span>}
                </div>
                <div className="qd-detail-item">
                  <span className="qd-detail-label">Cut Length</span>
                  <span className="qd-detail-value">{fmtMm(quote.perimeter_mm)}</span>
                </div>
                <div className="qd-detail-item">
                  <span className="qd-detail-label">Part Area</span>
                  <span className="qd-detail-value">
                    {quote.part_area_mm2 != null ? `${(quote.part_area_mm2 / 100).toFixed(0)} cm\u00B2` : "\u2014"}
                  </span>
                </div>
                <div className="qd-detail-item">
                  <span className="qd-detail-label">Pierces</span>
                  {editing ? <NumInput value={pierceCount} onChange={v => setPierceCount(Math.max(0, Math.round(v)))} step={1} /> : <span className="qd-detail-value">{quote.pierce_count ?? 0}</span>}
                </div>
                <div className="qd-detail-item">
                  <span className="qd-detail-label">Bends</span>
                  {editing ? <NumInput value={bendCount} onChange={v => setBendCount(Math.max(0, Math.round(v)))} step={1} /> : <span className="qd-detail-value">{quote.bend_count ?? 0}</span>}
                </div>
              </div>
            </div>
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
                  <div className="qd-detail-row"><span className="qd-dl-label">Name</span><span className="qd-dl-value">{quote.customer_name ?? "\u2014"}</span></div>
                  <div className="qd-detail-row"><span className="qd-dl-label">Email</span><span className="qd-dl-value">{quote.customer_email ? <a href={`mailto:${quote.customer_email}`} className="qd-email-link">{quote.customer_email}</a> : "\u2014"}</span></div>
                  <div className="qd-detail-row"><span className="qd-dl-label">Reference</span><span className="qd-dl-value">{quote.customer_ref ?? "\u2014"}</span></div>
                  <div className="qd-detail-row"><span className="qd-dl-label">Quantity</span><span className="qd-dl-value">{quote.quantity ?? 1}</span></div>
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
