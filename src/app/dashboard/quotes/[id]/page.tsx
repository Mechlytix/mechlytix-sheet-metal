import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { QuoteStatusManager } from "@/components/QuoteStatusManager";
import { QuoteShareButton } from "@/components/QuoteShareButton";
import type { Metadata } from "next";

// ─────────────────────────────────────────────────────────
// /dashboard/quotes/[id] — Quote Detail View
// Server rendered. Client island handles status transitions.
// ─────────────────────────────────────────────────────────

interface Props { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Quote — Mechlytix` };
}

function fmt(n: number | null | undefined, prefix = "£", dp = 2) {
  if (n == null) return "—";
  return `${prefix}${n.toFixed(dp)}`;
}
function fmtMm(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n.toFixed(1)} mm`;
}

export default async function QuoteDetailPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(`
      *,
      materials ( name, grade, category, color_hex, cost_per_kg, density_kg_m3 ),
      machine_profiles:machine_id ( name, machine_type, hourly_rate, power_kw )
    `)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error || !quote) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mat  = (quote as any).materials;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mach = (quote as any).machine_profiles;

  const createdDate = quote.created_at
    ? new Date(quote.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const expiresDate = quote.expires_at
    ? new Date(quote.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  // Derive gross margin %
  const netCost = (quote.material_cost ?? 0) + (quote.cutting_cost ?? 0) + (quote.bending_cost ?? 0) + ((quote.setup_cost ?? 0) / Math.max(quote.quantity ?? 1, 1));
  const grossMargin = quote.unit_price ? ((quote.unit_price - netCost) / quote.unit_price * 100) : null;

  return (
    <>
      {/* Print styles — scoped via @media print in globals.css */}
      <div className="dash-page quote-detail-page" id="quote-printable">
        {/* ── Header ── */}
        <div className="dash-page-header no-print">
          <div>
            <div className="qd-breadcrumb">
              <Link href="/dashboard/quotes" className="qd-breadcrumb-link">← Quotes</Link>
            </div>
            <h1 className="dash-page-title">{quote.filename}</h1>
            {createdDate && (
              <p className="dash-page-subtitle">Created {createdDate}</p>
            )}
          </div>
          <div className="qd-header-actions">
            <button className="btn-ghost" onClick={() => {}} id="print-btn"
              suppressHydrationWarning
            >
              {/* Rendered as client-safe print button via inline script */}
              <span>🖨</span> Print / PDF
            </button>
            <script
              dangerouslySetInnerHTML={{ __html: `document.getElementById('print-btn').onclick = () => window.print();` }}
            />
          </div>
        </div>

        {/* ── Print header (only visible when printing) ── */}
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
            <p className="qd-print-ref">Quote Reference: {params.id.slice(0, 8).toUpperCase()}</p>
            {createdDate && <p className="qd-print-date">Date: {createdDate}</p>}
          </div>
        </div>

        <div className="qd-layout">
          {/* ── Left column ── */}
          <div className="qd-left">
            {/* Price summary */}
            <div className="qd-price-card">
              <div className="qd-price-header">
                <div>
                  <p className="qd-price-filename">{quote.filename}</p>
                  <div className="qd-price-display">
                    <span className="qd-unit-price">{fmt(quote.unit_price)}</span>
                    <span className="qd-per-part">/ part</span>
                  </div>
                  <p className="qd-total-line">
                    Qty {quote.quantity ?? 1} × {fmt(quote.unit_price)} = {" "}
                    <strong>{fmt(quote.total_price)}</strong>
                  </p>
                </div>
                <div className="qd-badges">
                  <span className="input-type-badge">{quote.input_type}</span>
                  {grossMargin != null && (
                    <span className="qd-margin-badge">
                      {grossMargin.toFixed(0)}% margin
                    </span>
                  )}
                </div>
              </div>

              {/* Cost breakdown */}
              <div className="qd-breakdown">
                <h3 className="qd-section-title">Cost Breakdown</h3>
                {[
                  { label: "Material",        value: quote.material_cost, note: quote.thickness_mm != null ? `${quote.thickness_mm}mm` : null },
                  { label: "Cutting",         value: quote.cutting_cost,  note: null },
                  { label: "Bending",         value: quote.bending_cost,  note: quote.bend_count != null && quote.bend_count > 0 ? `${quote.bend_count} bends` : null },
                  { label: "Setup (total)",   value: quote.setup_cost,    note: null },
                ].map((row) => row.value != null && row.value > 0 ? (
                  <div key={row.label} className="breakdown-row">
                    <span className="breakdown-label">{row.label}</span>
                    {row.note && <span className="breakdown-note">{row.note}</span>}
                    <span className="breakdown-value">{fmt(row.value)}</span>
                  </div>
                ) : null)}
                <div className="breakdown-row net">
                  <span className="breakdown-label">Net cost (per part)</span>
                  <span className="breakdown-value">{fmt(netCost)}</span>
                </div>
                <div className="breakdown-row markup">
                  <span className="breakdown-label">Markup ({quote.markup_percent ?? "—"}%)</span>
                  <span className="breakdown-value">
                    +{quote.unit_price != null ? fmt(quote.unit_price - netCost) : "—"}
                  </span>
                </div>
                <div className="breakdown-row total-row">
                  <span className="breakdown-label">Unit Price</span>
                  <span className="breakdown-value highlight">{fmt(quote.unit_price)}</span>
                </div>
              </div>
            </div>

            {/* Geometry */}
            <div className="qd-section-card">
              <h3 className="qd-section-title">Part Geometry</h3>
              <div className="qd-detail-grid">
                <div className="qd-detail-item">
                  <span className="qd-detail-label">Flat Pattern</span>
                  <span className="qd-detail-value">
                    {quote.bounding_width_mm != null && quote.bounding_height_mm != null
                      ? `${fmtMm(quote.bounding_width_mm)} × ${fmtMm(quote.bounding_height_mm)}`
                      : "—"}
                  </span>
                </div>
                <div className="qd-detail-item">
                  <span className="qd-detail-label">Thickness</span>
                  <span className="qd-detail-value">{fmtMm(quote.thickness_mm)}</span>
                </div>
                <div className="qd-detail-item">
                  <span className="qd-detail-label">Cut Length</span>
                  <span className="qd-detail-value">{fmtMm(quote.perimeter_mm)}</span>
                </div>
                <div className="qd-detail-item">
                  <span className="qd-detail-label">Part Area</span>
                  <span className="qd-detail-value">
                    {quote.part_area_mm2 != null
                      ? `${(quote.part_area_mm2 / 100).toFixed(0)} cm²`
                      : "—"}
                  </span>
                </div>
                <div className="qd-detail-item">
                  <span className="qd-detail-label">Pierces</span>
                  <span className="qd-detail-value">{quote.pierce_count ?? 0}</span>
                </div>
                <div className="qd-detail-item">
                  <span className="qd-detail-label">Bends</span>
                  <span className="qd-detail-value">{quote.bend_count ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="qd-right">
            {/* Status manager */}
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
            <div className="qd-section-card">
              <h3 className="qd-section-title">Customer</h3>
              <div className="qd-detail-list">
                <div className="qd-detail-row">
                  <span className="qd-dl-label">Name</span>
                  <span className="qd-dl-value">{quote.customer_name ?? "—"}</span>
                </div>
                <div className="qd-detail-row">
                  <span className="qd-dl-label">Email</span>
                  <span className="qd-dl-value">
                    {quote.customer_email
                      ? <a href={`mailto:${quote.customer_email}`} className="qd-email-link">{quote.customer_email}</a>
                      : "—"}
                  </span>
                </div>
                <div className="qd-detail-row">
                  <span className="qd-dl-label">Reference</span>
                  <span className="qd-dl-value">{quote.customer_ref ?? "—"}</span>
                </div>
                <div className="qd-detail-row">
                  <span className="qd-dl-label">Quantity</span>
                  <span className="qd-dl-value">{quote.quantity ?? 1}</span>
                </div>
                {expiresDate && (
                  <div className="qd-detail-row">
                    <span className="qd-dl-label">Expires</span>
                    <span className="qd-dl-value">{expiresDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Material + Machine */}
            <div className="qd-section-card">
              <h3 className="qd-section-title">Material & Machine</h3>
              <div className="qd-detail-list">
                {mat && (
                  <>
                    <div className="qd-detail-row">
                      <span className="qd-dl-label">Material</span>
                      <span className="qd-dl-value">
                        <span className="material-dot" style={{ background: mat.color_hex ?? "#888", display: "inline-block", marginRight: 6 }} />
                        {mat.name}{mat.grade ? ` (${mat.grade})` : ""}
                      </span>
                    </div>
                    <div className="qd-detail-row">
                      <span className="qd-dl-label">Cost/kg</span>
                      <span className="qd-dl-value">£{mat.cost_per_kg?.toFixed(2) ?? "—"}</span>
                    </div>
                    <div className="qd-detail-row">
                      <span className="qd-dl-label">Density</span>
                      <span className="qd-dl-value">{mat.density_kg_m3?.toLocaleString()} kg/m³</span>
                    </div>
                  </>
                )}
                {mach && (
                  <>
                    <div className="qd-detail-row" style={{ marginTop: 8 }}>
                      <span className="qd-dl-label">Machine</span>
                      <span className="qd-dl-value">{mach.name}</span>
                    </div>
                    <div className="qd-detail-row">
                      <span className="qd-dl-label">Rate</span>
                      <span className="qd-dl-value">£{mach.hourly_rate?.toFixed(0) ?? "—"}/hr</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Notes */}
            {quote.notes && (
              <div className="qd-section-card">
                <h3 className="qd-section-title">Notes</h3>
                <p className="qd-notes-text">{quote.notes}</p>
              </div>
            )}

            {/* Share Link */}
            <div className="qd-section-card no-print">
              <h3 className="qd-section-title">Share with Customer</h3>
              <QuoteShareButton
                quoteId={quote.id}
                shareToken={(quote as Record<string, unknown>).share_token as string | null}
                shareEnabled={Boolean((quote as Record<string, unknown>).share_enabled)}
              />
            </div>

            {/* Print-only status */}
            <div className="print-only qd-print-status">
              <p>Status: <strong style={{ textTransform: "capitalize" }}>{quote.status}</strong></p>
              {quote.markup_percent != null && (
                <p>Markup: {quote.markup_percent}%</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
