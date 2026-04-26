"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { QRCodeCanvas, buildScanUrl } from "@/components/QRCodeCanvas";
import { calcRemnantWeight, calcRemnantScrapValue, calcRemnantMaterialValue } from "@/lib/remnants";
import { formatLength, formatWeight, formatCurrency } from "@/lib/units";
import type { Material } from "@/lib/types/database";

// ─────────────────────────────────────────────────────────
// /dashboard/scrap-rack — Digital Remnant / Offcut Manager
// ─────────────────────────────────────────────────────────

type RemnantStatus = "available" | "reserved" | "consumed" | "scrapped";

interface Remnant {
  id: string;
  user_id: string;
  material_id: string | null;
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
  location: string | null;
  qr_code_data: string | null;
  status: RemnantStatus;
  notes: string | null;
  created_at: string;
  materials?: { name: string; color_hex: string | null; density_kg_m3: number; scrap_value_per_kg: number | null; cost_per_kg: number } | null;
}

const STATUS_CONFIG: Record<RemnantStatus, { label: string; cls: string }> = {
  available: { label: "Available",  cls: "badge-green" },
  reserved:  { label: "Reserved",   cls: "badge-blue" },
  consumed:  { label: "Consumed",   cls: "badge-neutral" },
  scrapped:  { label: "Scrapped",   cls: "badge-red" },
};

// ─── Add Remnant Modal ────────────────────────────────────

interface AddRemnantModalProps {
  materials: Material[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

function AddRemnantModal({ materials, userId, onClose, onSaved }: AddRemnantModalProps) {
  const [form, setForm] = useState({
    material_id: materials[0]?.id ?? "",
    width_mm: "",
    height_mm: "",
    thickness_mm: "",
    location: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const supabase = createClient();

    // Insert first to get the UUID, then update qr_code_data
    startTransition(async () => {
      const { data, error: err } = await supabase.from("remnants").insert({
        user_id:      userId,
        material_id:  form.material_id || null,
        width_mm:     parseFloat(form.width_mm),
        height_mm:    parseFloat(form.height_mm),
        thickness_mm: parseFloat(form.thickness_mm),
        location:     form.location || null,
        notes:        form.notes || null,
        status:       "available",
      }).select("id").single();

      if (err || !data) { setError(err?.message ?? "Insert failed"); return; }

      // Set QR data to the public scan URL
      const scanUrl = buildScanUrl(data.id);
      await supabase.from("remnants").update({ qr_code_data: scanUrl }).eq("id", data.id);

      onSaved();
    });
  }

  const selectedMat = materials.find((m) => m.id === form.material_id);
  const w = parseFloat(form.width_mm) || 0;
  const h = parseFloat(form.height_mm) || 0;
  const t = parseFloat(form.thickness_mm) || 0;
  const dims = { width_mm: w, height_mm: h, thickness_mm: t };

  const previewWeight = selectedMat && w && h && t
    ? calcRemnantWeight(dims, selectedMat) : 0;
  const previewValue = selectedMat && w && h && t
    ? calcRemnantMaterialValue(dims, selectedMat) : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Log Remnant</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-field">
            <label>Material *</label>
            <select value={form.material_id} onChange={(e) => set("material_id", e.target.value)}>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>{m.name}{m.grade ? ` (${m.grade})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Thickness (mm) *</label>
            <input required type="number" step="0.1" min="0.1" value={form.thickness_mm} onChange={(e) => set("thickness_mm", e.target.value)} placeholder="2.0" />
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Width (mm) *</label>
              <input required type="number" step="1" min="1" value={form.width_mm} onChange={(e) => set("width_mm", e.target.value)} placeholder="400" />
            </div>
            <div className="form-field">
              <label>Height (mm) *</label>
              <input required type="number" step="1" min="1" value={form.height_mm} onChange={(e) => set("height_mm", e.target.value)} placeholder="300" />
            </div>
          </div>
          <div className="form-field">
            <label>Rack Location</label>
            <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Rack A, Shelf 2" />
          </div>
          <div className="form-field">
            <label>Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. left from job #1042, minor scratch on edge" />
          </div>

          {/* Live preview */}
          {previewWeight > 0 && (
            <div className="remnant-preview">
              <div className="rp-row">
                <span>Est. weight</span>
                <span>{previewWeight.toFixed(3)} kg</span>
              </div>
              <div className="rp-row">
                <span>Material value</span>
                <span>£{previewValue.toFixed(2)}</span>
              </div>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? "Saving…" : "Log Remnant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── QR Label Modal ────────────────────────────────────────

function QRLabelModal({ remnant, onClose }: { remnant: Remnant; onClose: () => void }) {
  const mat = remnant.materials;
  const scanUrl = remnant.qr_code_data ?? buildScanUrl(remnant.id);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="qr-label-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>QR Label</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" onClick={handlePrint}>🖨 Print</button>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Printable label */}
        <div className="qr-label-card" id="printable-label">
          <div className="qr-label-qr">
            <QRCodeCanvas value={scanUrl} size={160} />
          </div>
          <div className="qr-label-info">
            <div className="qr-label-title">
              {mat && (
                <span className="qr-mat-dot" style={{ background: mat.color_hex ?? "#888" }} />
              )}
              <strong>{mat?.name ?? "Material"}</strong>
            </div>
            <div className="qr-label-dims">
              {remnant.width_mm} × {remnant.height_mm} × {remnant.thickness_mm} mm
            </div>
            {remnant.location && (
              <div className="qr-label-location">📍 {remnant.location}</div>
            )}
            <div className="qr-label-status">
              <span className={`status-badge ${STATUS_CONFIG[remnant.status].cls}`}>
                {STATUS_CONFIG[remnant.status].label}
              </span>
            </div>
            <div className="qr-label-url">{scanUrl}</div>
          </div>
        </div>

        <p className="qr-hint">
          Anyone with a smartphone can scan this QR code to view remnant details — no app required.
        </p>
      </div>
    </div>
  );
}

// ─── Status Update Dropdown ───────────────────────────────

function StatusSelect({ remnant, onUpdated }: { remnant: Remnant; onUpdated: () => void }) {
  const [updating, setUpdating] = useState(false);

  async function handleChange(newStatus: string) {
    setUpdating(true);
    const supabase = createClient();
    await supabase.from("remnants").update({ status: newStatus }).eq("id", remnant.id);
    setUpdating(false);
    onUpdated();
  }

  return (
    <select
      className="status-select"
      value={remnant.status}
      disabled={updating}
      onChange={(e) => handleChange(e.target.value)}
    >
      {(Object.keys(STATUS_CONFIG) as RemnantStatus[]).map((s) => (
        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
      ))}
    </select>
  );
}

// ─── Main Page ─────────────────────────────────────────────

export default function ScrapRackPage() {
  const { units } = useDashboard();
  const u = units as "metric" | "imperial";
  const [remnants, setRemnants] = useState<Remnant[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [qrRemnant, setQrRemnant] = useState<Remnant | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("available");
  const [filterMaterial, setFilterMaterial] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Summary stats
  const available = remnants.filter((r) => r.status === "available");
  const totalScrapValue = available.reduce((sum, r) => {
    if (!r.materials) return sum;
    return sum + calcRemnantScrapValue(
      { width_mm: r.width_mm, height_mm: r.height_mm, thickness_mm: r.thickness_mm },
      r.materials
    );
  }, 0);
  const totalMatValue = available.reduce((sum, r) => {
    if (!r.materials) return sum;
    return sum + calcRemnantMaterialValue(
      { width_mm: r.width_mm, height_mm: r.height_mm, thickness_mm: r.thickness_mm },
      r.materials
    );
  }, 0);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [{ data: rem }, { data: mats }] = await Promise.all([
      supabase.from("remnants")
        .select("*, materials(name, color_hex, density_kg_m3, scrap_value_per_kg, cost_per_kg)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("materials")
        .select("*")
        .or(`is_system.eq.true,user_id.eq.${user.id}`)
        .order("name"),
    ]);

    setRemnants((rem as Remnant[]) ?? []);
    setMaterials(mats ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this remnant record?")) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from("remnants").delete().eq("id", id);
    setDeletingId(null);
    load();
  }

  const filtered = remnants.filter((r) => {
    const matchStatus = filterStatus === "all" || r.status === filterStatus;
    const matchMat = filterMaterial === "all" || r.material_id === filterMaterial;
    return matchStatus && matchMat;
  });

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Digital Scrap Rack</h1>
          <p className="dash-page-subtitle">Track offcuts. Scan QR on the shop floor. Recover profit.</p>
        </div>
        {userId && materials.length > 0 && (
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Log Remnant
          </button>
        )}
      </div>

      {/* Summary strip */}
      <div className="stat-strip">
        <div className="stat-card stat-green">
          <span className="stat-icon">♻️</span>
          <div className="stat-body">
            <span className="stat-value">{available.length}</span>
            <span className="stat-label">Available Pieces</span>
          </div>
        </div>
        <div className="stat-card stat-orange">
          <span className="stat-icon">💰</span>
          <div className="stat-body">
            <span className="stat-value">£{totalMatValue.toFixed(0)}</span>
            <span className="stat-label">Material Value Available</span>
          </div>
        </div>
        <div className="stat-card stat-blue">
          <span className="stat-icon">🏷</span>
          <div className="stat-body">
            <span className="stat-value">£{totalScrapValue.toFixed(0)}</span>
            <span className="stat-label">Scrap Value (at scrap rate)</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_CONFIG) as RemnantStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
          ))}
        </select>
        <select className="filter-select" value={filterMaterial} onChange={(e) => setFilterMaterial(e.target.value)}>
          <option value="all">All materials</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-state">Loading scrap rack…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {remnants.length === 0 ? (
            <>
              <p>No remnants logged yet.</p>
              <p style={{ fontSize: 12, color: "var(--text-dim)", maxWidth: 360, lineHeight: 1.5 }}>
                After each cutting job, log the offcuts here. The quoter will check this rack before pricing a new sheet.
              </p>
              {userId && materials.length > 0 && (
                <button className="btn-primary" onClick={() => setShowModal(true)}>Log your first remnant →</button>
              )}
            </>
          ) : (
            <p>No remnants match the current filters.</p>
          )}
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Thickness</th>
                <th>Dimensions</th>
                <th>Weight</th>
                <th>Mat. Value</th>
                <th>Location</th>
                <th>Status</th>
                <th>QR</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const mat = r.materials;
                const dims = { width_mm: r.width_mm, height_mm: r.height_mm, thickness_mm: r.thickness_mm };
                const weight = mat ? calcRemnantWeight(dims, mat) : 0;
                const value  = mat ? calcRemnantMaterialValue(dims, mat) : 0;

                return (
                  <tr key={r.id}>
                    <td>
                      <div className="material-name-cell">
                        <span className="material-dot" style={{ background: mat?.color_hex ?? "#888" }} />
                        {mat?.name ?? "—"}
                      </div>
                    </td>
                    <td className="td-muted">{formatLength(r.thickness_mm, u, 1)}</td>
                    <td>
                      <span className="remnant-dims">
                        {formatLength(r.width_mm, u, 0)} × {formatLength(r.height_mm, u, 0)}
                      </span>
                    </td>
                    <td className="td-muted">{weight > 0 ? formatWeight(weight, u, 2) : "—"}</td>
                    <td className="td-price">{value > 0 ? formatCurrency(value) : "—"}</td>
                    <td className="td-muted">{r.location ?? "—"}</td>
                    <td>
                      <StatusSelect remnant={r} onUpdated={load} />
                    </td>
                    <td>
                      <button
                        className="qr-btn"
                        onClick={() => setQrRemnant(r)}
                        title="View / Print QR label"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/>
                          <rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                          <path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                          <path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/>
                          <path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>
                        </svg>
                      </button>
                    </td>
                    <td className="td-date">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString("en-GB") : "—"}
                    </td>
                    <td>
                      <button
                        className="icon-btn danger"
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId === r.id}
                        title="Delete"
                      >🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Why use it */}
      {remnants.length === 0 && (
        <div className="scrap-why-card">
          <h3>Why track offcuts?</h3>
          <div className="scrap-why-grid">
            <div className="scrap-why-item">
              <span className="sw-icon">💸</span>
              <strong>Recover profit</strong>
              <p>A 1,200 × 800mm offcut of 3mm 304 stainless is worth ~£45. Track it, reuse it.</p>
            </div>
            <div className="scrap-why-item">
              <span className="sw-icon">⚡</span>
              <strong>Faster quotes</strong>
              <p>The quoter will check your rack first — if a remnant fits, no full sheet needed.</p>
            </div>
            <div className="scrap-why-item">
              <span className="sw-icon">📱</span>
              <strong>Shop floor scanning</strong>
              <p>Print QR labels, scan any piece with a phone to instantly verify material grade.</p>
            </div>
            <div className="scrap-why-item">
              <span className="sw-icon">♻️</span>
              <strong>Reduce waste</strong>
              <p>Know what you have before ordering more. Typical shops carry £2k–£8k in untracked offcuts.</p>
            </div>
          </div>
        </div>
      )}

      {showModal && userId && materials.length > 0 && (
        <AddRemnantModal
          materials={materials}
          userId={userId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}

      {qrRemnant && (
        <QRLabelModal remnant={qrRemnant} onClose={() => setQrRemnant(null)} />
      )}
    </div>
  );
}
