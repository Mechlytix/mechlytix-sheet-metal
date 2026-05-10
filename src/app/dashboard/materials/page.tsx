"use client";

import { useState, useEffect, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { formatCostPerWeight } from "@/lib/units";
import type { Material, MaterialCategory, SheetSize } from "@/lib/types/database";

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

// ─── Sheet Size Modal ──────────────────────────────────────

interface SheetSizeModalProps {
  onClose: () => void;
  onSaved: () => void;
  userId: string;
  materials: Material[];
  initialValues?: SheetSize | null;
}

function SheetSizeModal({ onClose, onSaved, userId, materials, initialValues }: SheetSizeModalProps) {
  const isEdit = !!initialValues;
  const [form, setForm] = useState({
    material_id:    initialValues?.material_id ?? (materials[0]?.id ?? ""),
    width_mm:       String(initialValues?.width_mm ?? ""),
    height_mm:      String(initialValues?.height_mm ?? ""),
    thickness_mm:   String(initialValues?.thickness_mm ?? ""),
    cost_per_sheet: String(initialValues?.cost_per_sheet ?? ""),
    quantity:       String(initialValues?.quantity ?? "0"),
    supplier:       initialValues?.supplier ?? "",
    in_stock:       initialValues?.in_stock ?? true,
  });
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const supabase = createClient();

    startTransition(async () => {
      const payload = {
        user_id:        userId,
        material_id:    form.material_id,
        width_mm:       parseFloat(form.width_mm),
        height_mm:      parseFloat(form.height_mm),
        thickness_mm:   parseFloat(form.thickness_mm),
        cost_per_sheet: parseFloat(form.cost_per_sheet) || null,
        quantity:       parseInt(form.quantity) || 0,
        supplier:       form.supplier || null,
        in_stock:       form.in_stock,
      };

      if (isEdit && initialValues) {
        const { error: err } = await supabase
          .from("sheet_sizes")
          .update(payload)
          .eq("id", initialValues.id);
        if (err) { setError(err.message); return; }
      } else {
        const { error: err } = await supabase
          .from("sheet_sizes")
          .insert(payload);
        if (err) { setError(err.message); return; }
      }

      onSaved();
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? "Edit Sheet Size" : "Add Sheet Size"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-field">
            <label>Material *</label>
            <select value={form.material_id} onChange={(e) => set("material_id", e.target.value)}>
              {materials.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.grade ?? m.category})</option>
              ))}
            </select>
          </div>

          <div className="form-row-3">
            <div className="form-field">
              <label>Width (mm) *</label>
              <input required type="number" step="0.1" value={form.width_mm} onChange={(e) => set("width_mm", e.target.value)} placeholder="2500" />
            </div>
            <div className="form-field">
              <label>Height (mm) *</label>
              <input required type="number" step="0.1" value={form.height_mm} onChange={(e) => set("height_mm", e.target.value)} placeholder="1250" />
            </div>
            <div className="form-field">
              <label>Thickness (mm) *</label>
              <input required type="number" step="0.1" value={form.thickness_mm} onChange={(e) => set("thickness_mm", e.target.value)} placeholder="2.0" />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Cost per Sheet (£)</label>
              <input type="number" step="0.01" value={form.cost_per_sheet} onChange={(e) => set("cost_per_sheet", e.target.value)} placeholder="45.00" />
            </div>
            <div className="form-field">
              <label>Qty in Stock</label>
              <input type="number" step="1" min="0" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
            </div>
          </div>

          <div className="form-field">
            <label>Supplier</label>
            <input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="e.g. Kloeckner Metals" />
          </div>

          <label className="machine-default-toggle">
            <input type="checkbox" checked={form.in_stock} onChange={(e) => set("in_stock", e.target.checked)} />
            <span>In stock</span>
          </label>

          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Sheet Size"}
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

  // Sheet sizes state
  const [sheetSizes, setSheetSizes] = useState<SheetSize[]>([]);
  const [showSheetModal, setShowSheetModal] = useState(false);
  const [editingSheet, setEditingSheet] = useState<SheetSize | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const [{ data: matsData }, { data: sheetsData }] = await Promise.all([
        supabase.from("materials").select("*").or(`is_system.eq.true,user_id.eq.${user.id}`).order("category").order("name"),
        supabase.from("sheet_sizes").select("*").or(`is_system.eq.true,user_id.eq.${user.id}`).order("width_mm"),
      ]);
      setMaterials(matsData ?? []);
      setSheetSizes(sheetsData ?? []);
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

      {/* ── Sheet Sizes Section ── */}
      <div className="sheet-sizes-section">
        <div className="sheet-sizes-header">
          <div>
            <h2>Sheet Sizes</h2>
            <p>Define available sheet sizes for nesting and material costing</p>
          </div>
          {userId && (
            <button className="btn-primary" onClick={() => setShowSheetModal(true)}>
              + Add Sheet Size
            </button>
          )}
        </div>

        {sheetSizes.length === 0 ? (
          <div className="sheet-size-empty">
            No sheet sizes defined yet. Add sheet sizes to enable part nesting.
          </div>
        ) : (
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Width</th>
                  <th>Height</th>
                  <th>Thickness</th>
                  <th>Cost / Sheet</th>
                  <th>Stock</th>
                  <th>Qty</th>
                  <th>Supplier</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sheetSizes.map(s => {
                  const mat = materials.find(m => m.id === s.material_id);
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="material-name-cell">
                          <span className="material-dot" style={{ background: mat?.color_hex ?? "#888" }} />
                          {mat?.name ?? "Unknown"}
                        </div>
                      </td>
                      <td>{s.width_mm}mm</td>
                      <td>{s.height_mm}mm</td>
                      <td>{s.thickness_mm}mm</td>
                      <td className="td-price">{s.cost_per_sheet ? `£${s.cost_per_sheet}` : "—"}</td>
                      <td>
                        <span className={`badge-stock ${s.in_stock ? "in-stock" : "out-of-stock"}`}>
                          {s.in_stock ? "In Stock" : "Out"}
                        </span>
                      </td>
                      <td>{s.quantity ?? 0}</td>
                      <td className="td-muted">{s.supplier ?? "—"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="icon-btn" onClick={() => setEditingSheet(s)} title="Edit">🖊</button>
                          <button className="icon-btn danger" onClick={async () => {
                            if (!confirm("Delete this sheet size?")) return;
                            const supabase = createClient();
                            await supabase.from("sheet_sizes").delete().eq("id", s.id);
                            load();
                          }} title="Delete">🗑</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(showModal || editingMaterial) && userId && (
        <AddMaterialModal
          userId={userId}
          initialValues={editingMaterial ?? undefined}
          onClose={() => { setShowModal(false); setEditingMaterial(null); }}
          onSaved={() => { setShowModal(false); setEditingMaterial(null); load(); }}
        />
      )}

      {(showSheetModal || editingSheet) && userId && (
        <SheetSizeModal
          userId={userId}
          materials={materials}
          initialValues={editingSheet}
          onClose={() => { setShowSheetModal(false); setEditingSheet(null); }}
          onSaved={() => { setShowSheetModal(false); setEditingSheet(null); load(); }}
        />
      )}
    </div>
  );
}
