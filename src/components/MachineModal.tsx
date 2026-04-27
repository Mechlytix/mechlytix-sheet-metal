"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MachineProfile, MachineType } from "@/lib/types/database";

// ─────────────────────────────────────────────────────────
// MachineModal — Add / Edit machine profile
// Includes inline feed-rate table editor
// ─────────────────────────────────────────────────────────

const MATERIAL_CATEGORIES = [
  { value: "mild_steel", label: "Mild Steel" },
  { value: "stainless",  label: "Stainless Steel" },
  { value: "aluminum",   label: "Aluminium" },
  { value: "copper",     label: "Copper" },
  { value: "brass",      label: "Brass" },
  { value: "other",      label: "Other" },
] as const;

const MACHINE_TYPES: { value: MachineType; label: string }[] = [
  { value: "laser",    label: "Fiber Laser" },
  { value: "plasma",   label: "Plasma" },
  { value: "waterjet", label: "Waterjet" },
  { value: "punch",    label: "Punch" },
];

type FeedRateRow = { id: number; category: string; thickness: string; feedRate: string };

function parseFeedRateRows(json: unknown): FeedRateRow[] {
  if (!json || typeof json !== "object") return [];
  const rows: FeedRateRow[] = [];
  let id = 0;
  for (const [cat, thickMap] of Object.entries(json as Record<string, unknown>)) {
    if (!thickMap || typeof thickMap !== "object") continue;
    for (const [thick, rate] of Object.entries(thickMap as Record<string, unknown>)) {
      rows.push({ id: id++, category: cat, thickness: thick, feedRate: String(rate) });
    }
  }
  return rows;
}

function serializeFeedRateRows(rows: FeedRateRow[]): Record<string, Record<string, number>> | null {
  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    const cat = r.category.trim();
    const thick = r.thickness.trim();
    const rate = parseFloat(r.feedRate);
    if (!cat || !thick || isNaN(rate) || rate <= 0) continue;
    if (!out[cat]) out[cat] = {};
    out[cat][thick] = rate;
  }
  return Object.keys(out).length > 0 ? out : null;
}

interface MachineModalProps {
  userId: string;
  existing?: MachineProfile | null;
  onClose: () => void;
  onSaved: () => void;
}

export function MachineModal({ userId, existing, onClose, onSaved }: MachineModalProps) {
  const isEdit = !!existing;

  const [form, setForm] = useState({
    name:                  existing?.name ?? "4kW Fiber Laser",
    machine_type:          existing?.machine_type ?? "laser",
    power_kw:              String(existing?.power_kw ?? 4),
    hourly_rate:           String(existing?.hourly_rate ?? 85),
    pierce_time_seconds:   String(existing?.pierce_time_seconds ?? 0.5),
    setup_time_minutes:    String(existing?.setup_time_minutes ?? 15),
    cost_per_bend:         String(existing?.cost_per_bend ?? 2.50),
    is_default:            existing?.is_default ?? false,
  });

  const [feedRows, setFeedRows] = useState<FeedRateRow[]>(
    parseFeedRateRows(existing?.feed_rates)
  );
  const [showFeedRates, setShowFeedRates] = useState(feedRows.length > 0);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const setF = (k: string, v: string | boolean) =>
    setForm((p) => ({ ...p, [k]: v }));

  // ── Feed rate row helpers ──────────────────────────────
  let nextId = feedRows.length + 100;

  function addFeedRow() {
    setFeedRows((r) => [
      ...r,
      { id: nextId++, category: "mild_steel", thickness: "", feedRate: "" },
    ]);
  }

  function updateFeedRow(id: number, field: keyof FeedRateRow, value: string) {
    setFeedRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  function removeFeedRow(id: number) {
    setFeedRows((rows) => rows.filter((r) => r.id !== id));
  }

  // ── Save ──────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const supabase = createClient();

    startTransition(async () => {
      const customFeedRates = showFeedRates ? serializeFeedRateRows(feedRows) : null;
      const payload = {
        user_id:              userId,
        name:                 form.name,
        machine_type:         form.machine_type as MachineType,
        power_kw:             parseFloat(form.power_kw) || null,
        hourly_rate:          parseFloat(form.hourly_rate) || 85,
        pierce_time_seconds:  parseFloat(form.pierce_time_seconds) || 0.5,
        setup_time_minutes:   parseFloat(form.setup_time_minutes) || 15,
        cost_per_bend:        parseFloat(form.cost_per_bend) || 2.5,
        is_default:           form.is_default,
        feed_rates:           customFeedRates,
        updated_at:           new Date().toISOString(),
      };

      // If marking as default, clear others first
      if (form.is_default) {
        await supabase
          .from("machine_profiles")
          .update({ is_default: false })
          .eq("user_id", userId);
      }

      if (isEdit && existing) {
        const { error: err } = await supabase
          .from("machine_profiles")
          .update(payload)
          .eq("id", existing.id);
        if (err) { setError(err.message); return; }
      } else {
        const { error: err } = await supabase
          .from("machine_profiles")
          .insert(payload);
        if (err) { setError(err.message); return; }
      }

      onSaved();
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{isEdit ? "Edit Machine" : "Add Machine"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSave} className="modal-form">
          {/* Name + Type */}
          <div className="form-row-2">
            <div className="form-field">
              <label>Machine Name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setF("name", e.target.value)}
                placeholder="4kW Fiber Laser"
              />
            </div>
            <div className="form-field">
              <label>Type</label>
              <select value={form.machine_type} onChange={(e) => setF("machine_type", e.target.value)}>
                {MACHINE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Power + Rate */}
          <div className="form-row-2">
            <div className="form-field">
              <label>Power (kW)</label>
              <input
                type="number" step="0.5" min="0"
                value={form.power_kw}
                onChange={(e) => setF("power_kw", e.target.value)}
                placeholder="4"
              />
            </div>
            <div className="form-field">
              <label>Machine Rate (£/hr)</label>
              <input
                type="number" step="1" min="0"
                value={form.hourly_rate}
                onChange={(e) => setF("hourly_rate", e.target.value)}
              />
            </div>
          </div>

          {/* Timing */}
          <div className="form-row-3">
            <div className="form-field">
              <label>Pierce Time (s)</label>
              <input
                type="number" step="0.1" min="0"
                value={form.pierce_time_seconds}
                onChange={(e) => setF("pierce_time_seconds", e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Setup (min)</label>
              <input
                type="number" step="1" min="0"
                value={form.setup_time_minutes}
                onChange={(e) => setF("setup_time_minutes", e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Cost / Bend (£)</label>
              <input
                type="number" step="0.10" min="0"
                value={form.cost_per_bend}
                onChange={(e) => setF("cost_per_bend", e.target.value)}
              />
            </div>
          </div>

          {/* Default toggle */}
          <label className="machine-default-toggle">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setF("is_default", e.target.checked)}
            />
            <span>Set as default machine for new quotes</span>
          </label>

          {/* ── Feed Rate Table ────────────────────────── */}
          <div className="feedrate-section">
            <button
              type="button"
              className="feedrate-toggle"
              onClick={() => setShowFeedRates(!showFeedRates)}
            >
              <span className="feedrate-toggle-arrow">{showFeedRates ? "▾" : "▸"}</span>
              Custom Feed Rates
              {feedRows.length > 0 && !showFeedRates && (
                <span className="feedrate-count-badge">{feedRows.length} rows</span>
              )}
              {!showFeedRates && (
                <span className="feedrate-hint">Uses built-in 4kW tables if not set</span>
              )}
            </button>

            {showFeedRates && (
              <div className="feedrate-body">
                <p className="feedrate-desc">
                  Override cut speeds (mm/min) per material and thickness. Leave blank to use built-in defaults for that combination.
                </p>
                {feedRows.length > 0 && (
                  <div className="feedrate-table">
                    <div className="feedrate-row feedrate-row-header">
                      <span>Material</span>
                      <span>Thickness (mm)</span>
                      <span>Feed Rate (mm/min)</span>
                      <span></span>
                    </div>
                    {feedRows.map((row) => (
                      <div key={row.id} className="feedrate-row">
                        <select
                          value={row.category}
                          onChange={(e) => updateFeedRow(row.id, "category", e.target.value)}
                          className="feedrate-select"
                        >
                          {MATERIAL_CATEGORIES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                        <input
                          type="number" step="0.1" min="0.1" placeholder="2.0"
                          value={row.thickness}
                          onChange={(e) => updateFeedRow(row.id, "thickness", e.target.value)}
                          className="feedrate-input"
                        />
                        <input
                          type="number" step="50" min="1" placeholder="5500"
                          value={row.feedRate}
                          onChange={(e) => updateFeedRow(row.id, "feedRate", e.target.value)}
                          className="feedrate-input"
                        />
                        <button
                          type="button"
                          className="feedrate-delete"
                          onClick={() => removeFeedRow(row.id)}
                          title="Remove row"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" className="feedrate-add-btn" onClick={addFeedRow}>
                  + Add row
                </button>
              </div>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Machine"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
