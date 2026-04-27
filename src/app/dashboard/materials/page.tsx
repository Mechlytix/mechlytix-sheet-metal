"use client";

import { useState, useEffect, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { formatCostPerWeight } from "@/lib/units";
import type { Material, MaterialCategory } from "@/lib/types/database";

// ─────────────────────────────────────────────────────────
// /dashboard/materials — Material database CRUD
// ─────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  stainless:  "Stainless Steel",
  aluminum:   "Aluminium",
  mild_steel: "Mild Steel",
  copper:     "Copper",
  brass:      "Brass",
  other:      "Other",
};

const CATEGORY_COLORS: Record<MaterialCategory, string> = {
  stainless:  "#C0C8D2",
  aluminum:   "#C8CDD2",
  mild_steel: "#8B929A",
  copper:     "#B87333",
  brass:      "#C9A84C",
  other:      "#667085",
};

// ─── Add Material Modal ────────────────────────────────────

interface MaterialModalProps {
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  /** When provided, the modal runs in edit mode */
  initialValues?: Material;
}

function AddMaterialModal({ onClose, onSaved, userId, initialValues }: MaterialModalProps) {
  const isEdit = !!initialValues;
  const [form, setForm] = useState({
    name:               initialValues?.name ?? "",
    grade:              initialValues?.grade ?? "",
    category:           (initialValues?.category ?? "mild_steel") as MaterialCategory,
    density_kg_m3:      String(initialValues?.density_kg_m3 ?? ""),
    cost_per_kg:        String(initialValues?.cost_per_kg ?? ""),
    scrap_value_per_kg: String(initialValues?.scrap_value_per_kg ?? ""),
    k_factor:           String(initialValues?.k_factor ?? "0.44"),
    notes:              initialValues?.notes ?? "",
  });
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const supabase = createClient();
    startTransition(async () => {
      const payload = {
        user_id: userId,
        name: form.name,
        grade: form.grade || null,
        category: form.category,
        density_kg_m3: parseFloat(form.density_kg_m3),
        cost_per_kg: parseFloat(form.cost_per_kg),
        scrap_value_per_kg: parseFloat(form.scrap_value_per_kg) || 0,
        k_factor: parseFloat(form.k_factor) || 0.44,
        color_hex: CATEGORY_COLORS[form.category],
        notes: form.notes || null,
      };

      if (isEdit && initialValues) {
        const { error: err } = await supabase
          .from("materials")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", initialValues.id);
        if (err) { setError(err.message); return; }
      } else {
        const { error: err } = await supabase.from("materials").insert({
          ...payload,
          is_system: false,
        });
        if (err) { setError(err.message); return; }
      }
      onSaved();
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? "Edit Material" : "Add Material"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row-2">
            <div className="form-field">
              <label>Name *</label>
              <input required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="304 Stainless Steel" />
            </div>
            <div className="form-field">
              <label>Grade</label>
              <input value={form.grade} onChange={(e) => set("grade", e.target.value)} placeholder="304" />
            </div>
          </div>
          <div className="form-field">
            <label>Category *</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value as MaterialCategory)}>
              {(Object.keys(CATEGORY_LABELS) as MaterialCategory[]).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Density (kg/m³) *</label>
              <input required type="number" step="any" value={form.density_kg_m3} onChange={(e) => set("density_kg_m3", e.target.value)} placeholder="7930" />
            </div>
            <div className="form-field">
              <label>K-Factor</label>
              <input type="number" step="0.001" value={form.k_factor} onChange={(e) => set("k_factor", e.target.value)} placeholder="0.44" />
            </div>
          </div>
          <div className="form-row-2">
            <div className="form-field">
              <label>Cost (£/kg) *</label>
              <input required type="number" step="0.01" value={form.cost_per_kg} onChange={(e) => set("cost_per_kg", e.target.value)} placeholder="3.50" />
            </div>
            <div className="form-field">
              <label>Scrap Value (£/kg)</label>
              <input type="number" step="0.01" value={form.scrap_value_per_kg} onChange={(e) => set("scrap_value_per_kg", e.target.value)} placeholder="0.70" />
            </div>
          </div>
          <div className="form-field">
            <label>Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="e.g. 2B finish, food grade" />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Material"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────

export default function MaterialsPage() {
  const { units } = useDashboard();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data } = await supabase
        .from("materials")
        .select("*")
        .or(`is_system.eq.true,user_id.eq.${user.id}`)
        .order("category")
        .order("name");
      setMaterials(data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this material? Sheet sizes using it will also be removed.")) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from("materials").delete().eq("id", id);
    setDeletingId(null);
    load();
  }

  const filtered = materials.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.grade ?? "").toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" || m.category === filterCategory;
    return matchSearch && matchCat;
  });

  // Group by category
  const grouped = (Object.keys(CATEGORY_LABELS) as MaterialCategory[]).reduce<
    Record<string, Material[]>
  >((acc, cat) => {
    const items = filtered.filter((m) => m.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Materials</h1>
          <p className="dash-page-subtitle">
            System materials are read-only. Add your own with custom prices.
          </p>
        </div>
        {userId && (
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Add Material
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          className="search-input"
          placeholder="Search materials…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {(Object.keys(CATEGORY_LABELS) as MaterialCategory[]).map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-state">Loading materials…</div>
      ) : (
        <div className="materials-groups">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="material-group">
              <div className="material-group-header">
                <span
                  className="material-group-swatch"
                  style={{ background: CATEGORY_COLORS[cat as MaterialCategory] }}
                />
                <h3 className="material-group-title">
                  {CATEGORY_LABELS[cat as MaterialCategory]}
                  <span className="material-group-count">{items.length}</span>
                </h3>
              </div>
              <div className="table-card">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Grade</th>
                      <th>Density (kg/m³)</th>
                      <th>K-Factor</th>
                      <th>Cost</th>
                      <th>Scrap Value</th>
                      <th>Source</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <div className="material-name-cell">
                            <span
                              className="material-dot"
                              style={{ background: m.color_hex ?? "#888" }}
                            />
                            {m.name}
                          </div>
                        </td>
                        <td className="td-muted">{m.grade ?? "—"}</td>
                        <td>{m.density_kg_m3.toLocaleString()}</td>
                        <td>{m.k_factor ?? "—"}</td>
                        <td className="td-price">
                          {formatCostPerWeight(m.cost_per_kg, units)}
                        </td>
                        <td className="td-muted">
                          {m.scrap_value_per_kg
                            ? formatCostPerWeight(m.scrap_value_per_kg, units)
                            : "—"}
                        </td>
                        <td>
                          {m.is_system ? (
                            <span className="badge-system">System</span>
                          ) : (
                            <span className="badge-custom">Custom</span>
                          )}
                        </td>
                        <td>
                          {!m.is_system && (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                className="icon-btn"
                                onClick={() => setEditingMaterial(m)}
                                title="Edit material"
                              >
                                🖊
                              </button>
                              <button
                                className="icon-btn danger"
                                onClick={() => handleDelete(m.id)}
                                disabled={deletingId === m.id}
                                title="Delete material"
                              >
                                🗑
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="empty-state">
              <p>No materials found.</p>
            </div>
          )}
        </div>
      )}

      {(showModal || editingMaterial) && userId && (
        <AddMaterialModal
          userId={userId}
          initialValues={editingMaterial ?? undefined}
          onClose={() => { setShowModal(false); setEditingMaterial(null); }}
          onSaved={() => { setShowModal(false); setEditingMaterial(null); load(); }}
        />
      )}
    </div>
  );
}
