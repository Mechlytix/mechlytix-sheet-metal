import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// ─────────────────────────────────────────────────────────
// /q/[token] — Public customer-facing quote share page
// No auth. Token must match a quote with share_enabled=true.
// ─────────────────────────────────────────────────────────

interface Props { params: { token: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: "Your Quote — Mechlytix",
    description: "Your sheet metal fabrication quote, powered by Mechlytix.",
    robots: { index: false }, // don't index share links
  };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:    { label: "Draft",    color: "#6b7280" },
  sent:     { label: "Sent",     color: "#60a5fa" },
  accepted: { label: "Accepted", color: "#4ade80" },
  rejected: { label: "Rejected", color: "#f87171" },
  expired:  { label: "Expired",  color: "#9ca3af" },
};

function row(label: string, value: string | null | undefined) {
  if (!value) return null;
  return { label, value };
}

export default async function QuoteSharePage({ params }: Props) {
  const supabase = await createClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(`
      id, filename, input_type, status, user_id,
      bounding_width_mm, bounding_height_mm, thickness_mm,
      perimeter_mm, pierce_count, bend_count, part_area_mm2,
      quantity, unit_price, total_price, markup_percent,
      customer_name, customer_email, customer_ref, notes, expires_at, created_at,
      materials ( name, grade, category, color_hex ),
      machine_profiles:machine_id ( name )
    `)
    .eq("share_token", params.token)
    .eq("share_enabled", true)
    .single();

  if (error || !quote) notFound();

  // Load the shop's branding profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shopUserId = (quote as any).user_id as string | null;
  const { data: shopProfile } = shopUserId
    ? await supabase
        .from("profiles")
        .select("company, logo_url, phone, website, address_line1, address_line2")
        .eq("id", shopUserId)
        .single()
    : { data: null };

  const shopName    = shopProfile?.company ?? "Mechlytix";
  const shopLogoUrl = shopProfile?.logo_url;
  const shopPhone   = shopProfile?.phone;
  const shopWebsite = shopProfile?.website;
  const shopAddr1   = shopProfile?.address_line1;
  const shopAddr2   = shopProfile?.address_line2;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mat  = (quote as any).materials  as { name: string; grade: string | null; category: string; color_hex: string | null } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mach = (quote as any).machine_profiles as { name: string } | null;

  const status = STATUS_LABELS[quote.status ?? "draft"] ?? STATUS_LABELS.draft;

  const dateCreated = quote.created_at
    ? new Date(quote.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const dateExpires = quote.expires_at
    ? new Date(quote.expires_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const isExpired = quote.expires_at ? new Date(quote.expires_at) < new Date() : false;

  const details = [
    row("Customer Name",   quote.customer_name),
    row("Reference",       quote.customer_ref),
    row("Material",        mat ? `${mat.name}${mat.grade ? ` (${mat.grade})` : ""}` : null),
    row("Thickness",       quote.thickness_mm != null ? `${quote.thickness_mm} mm` : null),
    row("Flat Pattern",    quote.bounding_width_mm && quote.bounding_height_mm
      ? `${quote.bounding_width_mm} × ${quote.bounding_height_mm} mm` : null),
    row("Cut Length",      quote.perimeter_mm != null ? `${quote.perimeter_mm} mm` : null),
    row("Bends",           quote.bend_count != null && quote.bend_count > 0 ? String(quote.bend_count) : null),
    row("Pierces",         quote.pierce_count != null && quote.pierce_count > 0 ? String(quote.pierce_count) : null),
    row("Machine",         mach?.name ?? null),
    row("Quoted",          dateCreated),
    row("Valid Until",     dateExpires),
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #0d0d0d;
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: #e5e5e5;
          min-height: 100vh;
          padding-bottom: 60px;
        }
        /* Brand header */
        .qs-header {
          padding: 20px 24px;
          border-bottom: 1px solid #1e1e1e;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .qs-brand-name {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: #fff;
        }
        .qs-brand-tag {
          font-size: 12px;
          color: #666;
          margin-left: 4px;
        }
        /* Page */
        .qs-page { max-width: 640px; margin: 0 auto; padding: 32px 20px; display: flex; flex-direction: column; gap: 20px; }
        /* Price hero */
        .qs-hero {
          background: linear-gradient(135deg, #1a1a1a, #141414);
          border: 1px solid #2a2a2a;
          border-radius: 16px;
          padding: 32px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .qs-hero::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, #ff6600, transparent);
        }
        .qs-hero-file { font-size: 13px; color: #666; margin-bottom: 12px; }
        .qs-price-row { display: flex; align-items: baseline; justify-content: center; gap: 8px; margin-bottom: 8px; }
        .qs-unit-price { font-size: 56px; font-weight: 800; color: #fff; line-height: 1; letter-spacing: -0.03em; }
        .qs-per-part { font-size: 18px; color: #666; }
        .qs-total { font-size: 15px; color: #999; margin-top: 4px; }
        .qs-qty { font-weight: 600; color: #ddd; }
        .qs-status-row { display: flex; justify-content: center; margin-top: 16px; }
        .qs-status {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;
        }
        .qs-status-dot { width: 7px; height: 7px; border-radius: 50%; }
        .qs-expired-banner {
          background: rgba(248, 113, 113, 0.06);
          border: 1px solid rgba(248, 113, 113, 0.2);
          border-radius: 10px;
          padding: 12px 16px;
          text-align: center;
          font-size: 13px;
          color: #f87171;
        }
        /* Card */
        .qs-card {
          background: #141414;
          border: 1px solid #222;
          border-radius: 14px;
          overflow: hidden;
        }
        .qs-card-title {
          font-size: 11px;
          font-weight: 700;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 16px 20px 0;
          margin-bottom: 12px;
        }
        .qs-detail-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 20px;
          border-bottom: 1px solid #1e1e1e;
          font-size: 13px;
        }
        .qs-detail-row:last-child { border-bottom: none; }
        .qs-detail-label { color: #666; }
        .qs-detail-value { color: #ccc; font-weight: 500; text-align: right; max-width: 60%; }
        .qs-notes {
          padding: 16px 20px;
          font-size: 13px;
          color: #888;
          line-height: 1.6;
          font-style: italic;
        }
        /* CTA */
        .qs-cta {
          background: rgba(255, 102, 0, 0.06);
          border: 1px solid rgba(255, 102, 0, 0.15);
          border-radius: 14px;
          padding: 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
        }
        .qs-cta h3 { font-size: 16px; font-weight: 700; color: #fff; }
        .qs-cta p { font-size: 13px; color: #888; line-height: 1.5; max-width: 380px; }
        .qs-cta-btn {
          display: inline-block;
          background: #ff6600;
          color: white;
          padding: 12px 28px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          transition: background 0.15s;
        }
        .qs-cta-btn:hover { background: #e55a00; }
        /* Footer */
        .qs-footer {
          text-align: center;
          font-size: 12px;
          color: #444;
          padding-top: 8px;
        }
        .qs-footer a { color: #ff6600; text-decoration: none; }
        /* Mat dot */
        .qs-mat-dot {
          display: inline-block;
          width: 10px; height: 10px;
          border-radius: 50%;
          margin-right: 6px;
          vertical-align: middle;
          flex-shrink: 0;
        }
        @media (prefers-color-scheme: light) {
          body { background: #f0f0f0; color: #111; }
          .qs-hero { background: #fff; border-color: #e0e0e0; }
          .qs-card { background: #fff; border-color: #e0e0e0; }
          .qs-detail-row { border-color: #f0f0f0; }
          .qs-detail-label { color: #888; }
          .qs-detail-value { color: #333; }
          .qs-unit-price { color: #111; }
          .qs-header { border-color: #e0e0e0; background: #fff; }
          .qs-total, .qs-qty { color: #444; }
        }
        @media (max-width: 480px) {
          .qs-unit-price { font-size: 42px; }
        }
      `}</style>

      {/* Brand header */}
      <div className="qs-header">
        {shopLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shopLogoUrl} alt={shopName} style={{ height: 32, width: "auto", objectFit: "contain" }} />
        ) : (
          <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
            <polygon points="20,2 38,11 38,29 20,38 2,29 2,11" fill="none" stroke="#ff6600" strokeWidth="3"/>
            <polygon points="20,10 30,15 30,25 20,30 10,25 10,15" fill="none" stroke="#ff8533" strokeWidth="2"/>
            <polygon points="20,18 25,20.5 25,25.5 20,28 15,25.5 15,20.5" fill="#ff6600"/>
          </svg>
        )}
        <div style={{ flex: 1 }}>
          <span className="qs-brand-name">{shopName}</span>
          {(shopAddr1 || shopAddr2) && (
            <span className="qs-brand-tag" style={{ display: "block", marginTop: 1 }}>
              {[shopAddr1, shopAddr2].filter(Boolean).join(", ")}
            </span>
          )}
        </div>
        {(shopPhone || shopWebsite) && (
          <div style={{ textAlign: "right", fontSize: 12, color: "#666" }}>
            {shopPhone && <div>{shopPhone}</div>}
            {shopWebsite && (
              <a href={shopWebsite} target="_blank" rel="noopener noreferrer"
                style={{ color: "#ff6600", textDecoration: "none" }}
              >{shopWebsite.replace(/^https?:\/\//, "")}</a>
            )}
          </div>
        )}
      </div>

      <div className="qs-page">
        {/* Expired warning */}
        {isExpired && (
          <div className="qs-expired-banner">
            ⚠ This quote has expired. Please contact us for an updated price.
          </div>
        )}

        {/* Price hero */}
        <div className="qs-hero">
          <p className="qs-hero-file">{quote.filename}</p>
          <div className="qs-price-row">
            <span className="qs-unit-price">
              £{(quote.unit_price ?? 0).toFixed(2)}
            </span>
            <span className="qs-per-part">/ part</span>
          </div>
          <p className="qs-total">
            <span className="qs-qty">Qty {quote.quantity ?? 1}</span>
            {" "}× £{(quote.unit_price ?? 0).toFixed(2)} ={" "}
            <strong>£{(quote.total_price ?? 0).toFixed(2)}</strong>
          </p>
          <div className="qs-status-row">
            <span
              className="qs-status"
              style={{
                background: `${status.color}1a`,
                color: status.color,
                border: `1px solid ${status.color}33`,
              }}
            >
              <span className="qs-status-dot" style={{ background: status.color }} />
              {status.label}
            </span>
          </div>
        </div>

        {/* Details */}
        {details.length > 0 && (
          <div className="qs-card">
            <p className="qs-card-title">Quote Details</p>
            {details.map(({ label, value }) => (
              <div key={label} className="qs-detail-row">
                <span className="qs-detail-label">{label}</span>
                <span className="qs-detail-value">
                  {label === "Material" && mat?.color_hex && (
                    <span className="qs-mat-dot" style={{ background: mat.color_hex }} />
                  )}
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {quote.notes && (
          <div className="qs-card">
            <p className="qs-card-title">Notes</p>
            <p className="qs-notes">{quote.notes}</p>
          </div>
        )}

        {/* CTA */}
        {!isExpired && quote.status !== "rejected" && (
          <div className="qs-cta">
            <h3>Ready to proceed?</h3>
            <p>
              Get in touch to confirm your order or request changes to this quote.
              Reference: <strong>{params.token.slice(0, 8).toUpperCase()}</strong>
            </p>
            {quote.customer_email ? (
              <a href={`mailto:${quote.customer_email}`} className="qs-cta-btn">
                Contact Us
              </a>
            ) : shopPhone ? (
              <a href={`tel:${shopPhone}`} className="qs-cta-btn">
                Call {shopPhone}
              </a>
            ) : shopWebsite ? (
              <a href={shopWebsite} target="_blank" rel="noopener noreferrer" className="qs-cta-btn">
                Visit {shopName}
              </a>
            ) : (
              <a href="https://mechlytix.com/contact" target="_blank" rel="noopener noreferrer" className="qs-cta-btn">
                Contact Us
              </a>
            )}
          </div>
        )}

        <div className="qs-footer">
          <p>
            Quote generated by{" "}
            <a href="https://mechlytix.com" target="_blank" rel="noopener noreferrer">Mechlytix</a>
            {" "}— Instant Sheet Metal Pricing
          </p>
        </div>
      </div>
    </>
  );
}
