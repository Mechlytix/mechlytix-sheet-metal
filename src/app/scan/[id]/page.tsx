import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

// ─────────────────────────────────────────────────────────
// /scan/[id] — Public QR scan landing page
// No auth required — anyone with the QR code can view remnant details
// ─────────────────────────────────────────────────────────

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return {
    title: "Remnant Details — Mechlytix",
    description: "Sheet metal remnant details. Scan to verify material grade and dimensions.",
  };
}

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  reserved:  "Reserved",
  consumed:  "Consumed",
  scrapped:  "Scrapped",
};

const STATUS_COLORS: Record<string, string> = {
  available: "#4ade80",
  reserved:  "#60a5fa",
  consumed:  "#6b7280",
  scrapped:  "#f87171",
};

export default async function ScanPage({ params }: Props) {
  const supabase = await createClient();

  const { data: remnant, error } = await supabase
    .from("remnants")
    .select(`
      id, width_mm, height_mm, thickness_mm,
      location, status, notes, created_at,
      materials ( name, grade, category, color_hex, density_kg_m3, cost_per_kg, scrap_value_per_kg )
    `)
    .eq("id", params.id)
    .single();

  if (error || !remnant) notFound();

  // @ts-ignore — joined relation type from Supabase
  const mat = remnant.materials as { name: string; grade: string | null; category: string; color_hex: string | null; density_kg_m3: number; cost_per_kg: number; scrap_value_per_kg: number | null } | null;
  const status = remnant.status as string;
  const statusColor = STATUS_COLORS[status] ?? "#6b7280";

  // Weight calculation (no units.ts — this is a server component / public page)
  const volumeM3 = (remnant.width_mm * remnant.height_mm * remnant.thickness_mm) / 1e9;
  const weightKg = mat ? volumeM3 * mat.density_kg_m3 : 0;

  const addedDate = remnant.created_at
    ? new Date(remnant.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <>
      {/* Minimal standalone page — no dashboard chrome */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d0d0d; font-family: 'Inter', system-ui, sans-serif; color: #e5e5e5; min-height: 100vh; }
        .scan-page { max-width: 480px; margin: 0 auto; padding: 32px 20px; display: flex; flex-direction: column; gap: 20px; }
        .scan-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
        .scan-brand-name { font-size: 14px; font-weight: 700; letter-spacing: 0.06em; color: #999; text-transform: uppercase; }
        .scan-card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; overflow: hidden; }
        .scan-card-header { padding: 24px; background: linear-gradient(135deg, rgba(255,102,0,0.08), transparent); border-bottom: 1px solid #2a2a2a; }
        .scan-material-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .scan-mat-dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
        .scan-mat-name { font-size: 22px; font-weight: 700; color: #fff; }
        .scan-mat-grade { font-size: 14px; color: #888; }
        .scan-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
        .scan-status-dot { width: 7px; height: 7px; border-radius: 50%; }
        .scan-dims { padding: 20px 24px; border-bottom: 1px solid #2a2a2a; }
        .scan-dims-title { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; }
        .scan-dims-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .scan-dim-item { display: flex; flex-direction: column; gap: 3px; }
        .scan-dim-label { font-size: 11px; color: #666; }
        .scan-dim-value { font-size: 18px; font-weight: 700; color: #fff; }
        .scan-details { padding: 20px 24px; display: flex; flex-direction: column; gap: 12px; }
        .scan-detail-row { display: flex; justify-content: space-between; font-size: 13px; border-bottom: 1px solid #222; padding-bottom: 8px; }
        .scan-detail-label { color: #777; }
        .scan-detail-value { color: #ddd; font-weight: 500; text-align: right; }
        .scan-notes { padding: 0 24px 20px; }
        .scan-notes-text { font-size: 13px; color: #888; line-height: 1.5; background: rgba(255,255,255,0.03); border-radius: 8px; padding: 12px; border: 1px solid #222; }
        .scan-footer { text-align: center; font-size: 12px; color: #555; }
        .scan-footer a { color: #ff6600; text-decoration: none; }
        .status-consumed, .status-scrapped { opacity: 0.6; }
        @media (prefers-color-scheme: light) {
          body { background: #f5f5f5; color: #111; }
          .scan-card { background: #fff; border-color: #e0e0e0; }
          .scan-card-header { background: linear-gradient(135deg, rgba(255,102,0,0.05), transparent); border-color: #e0e0e0; }
          .scan-dims, .scan-details { border-color: #e0e0e0; }
          .scan-mat-name { color: #111; }
          .scan-dim-value { color: #111; }
          .scan-detail-row { border-color: #eee; }
          .scan-detail-value { color: #333; }
          .scan-notes-text { background: #f9f9f9; border-color: #eee; }
        }
      `}</style>

      <div className="scan-page">
        {/* Brand */}
        <div className="scan-brand">
          <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
            <polygon points="20,2 38,11 38,29 20,38 2,29 2,11" fill="none" stroke="#ff6600" strokeWidth="3"/>
            <polygon points="20,10 30,15 30,25 20,30 10,25 10,15" fill="none" stroke="#ff8533" strokeWidth="2"/>
            <polygon points="20,18 25,20.5 25,25.5 20,28 15,25.5 15,20.5" fill="#ff6600"/>
          </svg>
          <span className="scan-brand-name">Mechlytix — Remnant Scan</span>
        </div>

        {/* Main card */}
        <div className={`scan-card ${status === "consumed" || status === "scrapped" ? `status-${status}` : ""}`}>
          {/* Header */}
          <div className="scan-card-header">
            <div className="scan-material-row">
              <span className="scan-mat-dot" style={{ background: mat?.color_hex ?? "#888" }} />
              <span className="scan-mat-name">{mat?.name ?? "Unknown Material"}</span>
            </div>
            {mat?.grade && <div className="scan-mat-grade">Grade: {mat.grade}</div>}
            <br />
            <span
              className="scan-status"
              style={{ background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}
            >
              <span className="scan-status-dot" style={{ background: statusColor }} />
              {STATUS_LABELS[status] ?? status}
            </span>
          </div>

          {/* Dimensions */}
          <div className="scan-dims">
            <div className="scan-dims-title">Dimensions</div>
            <div className="scan-dims-grid">
              <div className="scan-dim-item">
                <span className="scan-dim-label">Width</span>
                <span className="scan-dim-value">{remnant.width_mm} mm</span>
              </div>
              <div className="scan-dim-item">
                <span className="scan-dim-label">Height</span>
                <span className="scan-dim-value">{remnant.height_mm} mm</span>
              </div>
              <div className="scan-dim-item">
                <span className="scan-dim-label">Thickness</span>
                <span className="scan-dim-value">{remnant.thickness_mm} mm</span>
              </div>
              <div className="scan-dim-item">
                <span className="scan-dim-label">Est. Weight</span>
                <span className="scan-dim-value">
                  {weightKg > 0 ? `${weightKg.toFixed(2)} kg` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="scan-details">
            {remnant.location && (
              <div className="scan-detail-row">
                <span className="scan-detail-label">📍 Location</span>
                <span className="scan-detail-value">{remnant.location}</span>
              </div>
            )}
            {mat?.category && (
              <div className="scan-detail-row">
                <span className="scan-detail-label">Category</span>
                <span className="scan-detail-value" style={{ textTransform: "capitalize" }}>
                  {mat.category.replace("_", " ")}
                </span>
              </div>
            )}
            {addedDate && (
              <div className="scan-detail-row">
                <span className="scan-detail-label">Logged</span>
                <span className="scan-detail-value">{addedDate}</span>
              </div>
            )}
          </div>

          {/* Notes */}
          {remnant.notes && (
            <div className="scan-notes">
              <p className="scan-notes-text">📝 {remnant.notes}</p>
            </div>
          )}
        </div>

        <div className="scan-footer">
          <p>Powered by <a href="https://mechlytix.com" target="_blank" rel="noopener noreferrer">Mechlytix</a> — Sheet Metal Quoting Software</p>
        </div>
      </div>
    </>
  );
}
