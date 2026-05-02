"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { MachineModal } from "@/components/MachineModal";
import { useDashboard } from "@/lib/dashboard-context";
import type { MachineProfile, Currency } from "@/lib/types/database";

// ─────────────────────────────────────────────────────────
// /dashboard/settings — Account + Machine + Branding
// ─────────────────────────────────────────────────────────

const MACHINE_TYPE_LABELS: Record<string, string> = {
  laser: "Fiber Laser",
  plasma: "Plasma",
  waterjet: "Waterjet",
  punch: "Punch",
};

export default function SettingsPage() {
  const { setCurrency } = useDashboard();

  // ── State ──────────────────────────────────────────────
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile
  const [profile, setProfile] = useState({
    full_name: "", company: "", phone: "", website: "",
    address_line1: "", address_line2: "", logo_url: "",
  });
  const [profileSaved, setProfileSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Machines
  const [machines, setMachines] = useState<MachineProfile[]>([]);
  const [machineModal, setMachineModal] = useState<{
    open: boolean;
    machine: MachineProfile | null;
  }>({ open: false, machine: null });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Quoting Defaults
  const [defaults, setDefaults] = useState({
    default_markup_percent: "15",
    quote_expiry_days: "30",
    currency: "GBP" as Currency,
    brand_color: "#ff6600",
    quote_prefix: "Q-",
    next_quote_number: "1",
  });
  const [defaultsSaved, setDefaultsSaved] = useState(false);
  const [, startDefaultsTransition] = useTransition();
  const [, startProfileTransition] = useTransition();

  // ── Load ──────────────────────────────────────────────
  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const [{ data: p }, { data: ms }, { data: s }] = await Promise.all([
      supabase.from("profiles")
        .select("full_name, company, phone, website, address_line1, address_line2, logo_url")
        .eq("id", user.id).single(),
      supabase.from("machine_profiles")
        .select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("user_settings")
        .select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    if (p) setProfile({
      full_name:    p.full_name    ?? "",
      company:      p.company      ?? "",
      phone:        p.phone        ?? "",
      website:      p.website      ?? "",
      address_line1: p.address_line1 ?? "",
      address_line2: p.address_line2 ?? "",
      logo_url:     p.logo_url     ?? "",
    });
    if (ms) setMachines(ms);
    if (s) setDefaults({
      default_markup_percent: String(s.default_markup_percent),
      quote_expiry_days:      String(s.quote_expiry_days),
      currency:               (s.currency as Currency) ?? "GBP",
      brand_color:            s.brand_color ?? "#ff6600",
      quote_prefix:           s.quote_prefix ?? "Q-",
      next_quote_number:      String(s.next_quote_number ?? 1),
    });

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // ── Save Profile ──────────────────────────────────────
  async function saveProfile() {
    if (!userId) return;
    startProfileTransition(async () => {
      const supabase = createClient();
      await supabase.from("profiles").update({
        full_name:    profile.full_name,
        company:      profile.company,
        phone:        profile.phone || null,
        website:      profile.website || null,
        address_line1: profile.address_line1 || null,
        address_line2: profile.address_line2 || null,
      }).eq("id", userId);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    });
  }

  // ── Logo Upload ──────────────────────────────────────
  async function handleLogoUpload(file: File) {
    if (!userId) return;
    setLogoUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${userId}/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);

      await supabase.from("profiles").update({ logo_url: publicUrl }).eq("id", userId);
      setProfile((p) => ({ ...p, logo_url: publicUrl }));
    } catch (err) {
      console.error("Logo upload failed:", err);
    }
    setLogoUploading(false);
  }

  async function removeLogo() {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("profiles").update({ logo_url: null }).eq("id", userId);
    setProfile((p) => ({ ...p, logo_url: "" }));
  }

  // ── Save Quoting Defaults ──────────────────────────────
  async function saveDefaults() {
    if (!userId) return;
    startDefaultsTransition(async () => {
      const supabase = createClient();
      await supabase.from("user_settings").upsert({
        user_id:               userId,
        default_markup_percent: parseFloat(defaults.default_markup_percent) || 15,
        quote_expiry_days:     parseInt(defaults.quote_expiry_days) || 30,
        currency:              defaults.currency,
        brand_color:           defaults.brand_color,
        quote_prefix:          defaults.quote_prefix || "Q-",
        next_quote_number:     parseInt(defaults.next_quote_number) || 1,
        updated_at:            new Date().toISOString(),
      });
      setCurrency(defaults.currency);
      setDefaultsSaved(true);
      setTimeout(() => setDefaultsSaved(false), 2000);
    });
  }

  // ── Machine delete ──────────────────────────────────────
  async function deleteMachine(id: string) {
    if (!confirm("Delete this machine profile?")) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from("machine_profiles").delete().eq("id", id);
    setDeletingId(null);
    load();
  }

  // ── Set default machine ──────────────────────────────────
  async function setDefaultMachine(id: string) {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("machine_profiles").update({ is_default: false }).eq("user_id", userId);
    await supabase.from("machine_profiles").update({ is_default: true }).eq("id", id);
    load();
  }

  if (loading) return <div className="dash-page"><div className="loading-state">Loading settings…</div></div>;

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <h1 className="dash-page-title">Settings</h1>
      </div>

      <div className="settings-grid">

        {/* ── Profile ── */}
        <section className="settings-card">
          <h2 className="settings-card-title">Company Profile</h2>

          {/* Logo */}
          <div className="logo-upload-row">
            <div className="logo-preview" onClick={() => logoInputRef.current?.click()}>
              {profile.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.logo_url} alt="Company logo" />
              ) : (
                <span className="logo-placeholder">
                  {logoUploading ? "⏳" : "🏭"}
                </span>
              )}
            </div>
            <div className="logo-upload-info">
              <p className="logo-upload-label">Company Logo</p>
              <p className="logo-upload-hint">PNG, JPG or SVG. Shown on share pages and print headers.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: 12, padding: "5px 12px" }}
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                >
                  {logoUploading ? "Uploading…" : profile.logo_url ? "Change" : "Upload"}
                </button>
                {profile.logo_url && (
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ fontSize: 12, padding: "5px 12px", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
                    onClick={removeLogo}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleLogoUpload(file);
              }}
            />
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Full Name</label>
              <input
                value={profile.full_name}
                onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="Jane Smith"
              />
            </div>
            <div className="form-field">
              <label>Company Name</label>
              <input
                value={profile.company}
                onChange={(e) => setProfile((p) => ({ ...p, company: e.target.value }))}
                placeholder="Acme Fabrication Ltd"
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Phone</label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+44 1234 567890"
              />
            </div>
            <div className="form-field">
              <label>Website</label>
              <input
                type="url"
                value={profile.website}
                onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
                placeholder="https://acmefab.co.uk"
              />
            </div>
          </div>

          <div className="form-field">
            <label>Address Line 1</label>
            <input
              value={profile.address_line1}
              onChange={(e) => setProfile((p) => ({ ...p, address_line1: e.target.value }))}
              placeholder="Unit 4, Industrial Estate"
            />
          </div>
          <div className="form-field">
            <label>Address Line 2</label>
            <input
              value={profile.address_line2}
              onChange={(e) => setProfile((p) => ({ ...p, address_line2: e.target.value }))}
              placeholder="Birmingham, B1 1AA"
            />
          </div>

          <button className="btn-primary" onClick={saveProfile}>
            {profileSaved ? "✓ Saved" : "Save Profile"}
          </button>
        </section>

        {/* ── Quoting Defaults ── */}
        <section className="settings-card">
          <h2 className="settings-card-title">Quoting Defaults</h2>
          <p className="settings-card-desc">Applied to all new quotes. Can be overridden per-quote.</p>

          <div className="form-row-2">
            <div className="form-field">
              <label>Default Markup (%)</label>
              <input
                type="number" step="0.5" min="0"
                value={defaults.default_markup_percent}
                onChange={(e) => setDefaults((d) => ({ ...d, default_markup_percent: e.target.value }))}
              />
            </div>
            <div className="form-field">
              <label>Quote Expiry (days)</label>
              <input
                type="number" step="1" min="1"
                value={defaults.quote_expiry_days}
                onChange={(e) => setDefaults((d) => ({ ...d, quote_expiry_days: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-field">
            <label>Currency</label>
            <select
              value={defaults.currency}
              onChange={(e) => setDefaults((d) => ({ ...d, currency: e.target.value as Currency }))}
            >
              <option value="GBP">GBP — British Pound (£)</option>
              <option value="EUR">EUR — Euro (€)</option>
              <option value="USD">USD — US Dollar ($)</option>
            </select>
          </div>

          <button className="btn-primary" onClick={saveDefaults}>
            {defaultsSaved ? "✓ Saved" : "Save Defaults"}
          </button>
        </section>

        {/* ── Quote Branding ── */}
        <section className="settings-card">
          <h2 className="settings-card-title">Quote Branding</h2>
          <p className="settings-card-desc">Customise the look and numbering of your PDF quotes.</p>

          {/* Brand Colour */}
          <div className="form-field">
            <label>Brand Colour</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="color"
                value={defaults.brand_color}
                onChange={(e) => setDefaults((d) => ({ ...d, brand_color: e.target.value }))}
                style={{ width: 40, height: 34, padding: 0, border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", cursor: "pointer", background: "transparent" }}
              />
              <input
                type="text"
                value={defaults.brand_color}
                onChange={(e) => setDefaults((d) => ({ ...d, brand_color: e.target.value }))}
                placeholder="#ff6600"
                style={{ flex: 1, fontFamily: "var(--font-mono, monospace)" }}
                maxLength={7}
              />
              <div style={{ width: 60, height: 34, borderRadius: "var(--radius-md)", background: defaults.brand_color, border: "1px solid var(--border-subtle)" }} />
            </div>
            <span className="field-hint">Used as the accent colour on your quote PDFs (header bar, table headers, totals).</span>
          </div>

          {/* Quote Prefix + Next Number */}
          <div className="form-row-2">
            <div className="form-field">
              <label>Quote Prefix</label>
              <input
                type="text"
                value={defaults.quote_prefix}
                onChange={(e) => setDefaults((d) => ({ ...d, quote_prefix: e.target.value }))}
                placeholder="Q-"
                maxLength={10}
              />
              <span className="field-hint">e.g. Q-, QTE-, INV-</span>
            </div>
            <div className="form-field">
              <label>Next Quote Number</label>
              <input
                type="number"
                min="1"
                value={defaults.next_quote_number}
                onChange={(e) => setDefaults((d) => ({ ...d, next_quote_number: e.target.value }))}
              />
              <span className="field-hint">The next auto-assigned number</span>
            </div>
          </div>

          {/* Live preview */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
            <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Next quote will be:</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: defaults.brand_color, fontFamily: "var(--font-mono, monospace)" }}>
              {defaults.quote_prefix}{String(parseInt(defaults.next_quote_number) || 1).padStart(5, '0')}
            </span>
          </div>

          <button className="btn-primary" onClick={saveDefaults} style={{ marginTop: 4 }}>
            {defaultsSaved ? "✓ Saved" : "Save Branding"}
          </button>
        </section>

        {/* ── Machines ── */}
        <section className="settings-card" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 className="settings-card-title">Machine Profiles</h2>
              <p className="settings-card-desc" style={{ marginTop: 4 }}>
                Each machine has its own hourly rate, timing parameters, and optional custom feed rates.
              </p>
            </div>
            <button
              className="btn-primary"
              onClick={() => setMachineModal({ open: true, machine: null })}
            >
              + Add Machine
            </button>
          </div>

          {machines.length === 0 ? (
            <div className="empty-state" style={{ padding: "32px 0" }}>
              <p>No machines configured yet.</p>
              <button
                className="btn-ghost"
                onClick={() => setMachineModal({ open: true, machine: null })}
              >
                Add your first machine
              </button>
            </div>
          ) : (
            <div className="table-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Power</th>
                    <th>Rate (£/hr)</th>
                    <th>Pierce (s)</th>
                    <th>Setup (min)</th>
                    <th>Bend Cost</th>
                    <th>Feed Rates</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {machines.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {m.is_default && (
                            <span
                              title="Default machine"
                              style={{ color: "var(--accent-primary)", fontSize: 14 }}
                            >★</span>
                          )}
                          <span style={{ fontWeight: 600 }}>{m.name}</span>
                        </div>
                      </td>
                      <td className="td-muted">{MACHINE_TYPE_LABELS[m.machine_type ?? "laser"] ?? m.machine_type}</td>
                      <td className="td-muted">{m.power_kw ? `${m.power_kw}kW` : "—"}</td>
                      <td>£{m.hourly_rate}/hr</td>
                      <td className="td-muted">{m.pierce_time_seconds}s</td>
                      <td className="td-muted">{m.setup_time_minutes}min</td>
                      <td className="td-muted">£{m.cost_per_bend}</td>
                      <td>
                        {m.feed_rates && typeof m.feed_rates === "object" && Object.keys(m.feed_rates).length > 0 ? (
                          <span className="badge-custom">Custom</span>
                        ) : (
                          <span className="badge-system">Default</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          {!m.is_default && (
                            <button
                              className="icon-btn"
                              title="Set as default"
                              onClick={() => setDefaultMachine(m.id)}
                            >★</button>
                          )}
                          <button
                            className="icon-btn"
                            title="Edit machine"
                            onClick={() => setMachineModal({ open: true, machine: m })}
                          >🖊</button>
                          <button
                            className="icon-btn danger"
                            title="Delete machine"
                            onClick={() => deleteMachine(m.id)}
                            disabled={deletingId === m.id}
                          >🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>

      {/* Machine Modal */}
      {machineModal.open && userId && (
        <MachineModal
          userId={userId}
          existing={machineModal.machine}
          onClose={() => setMachineModal({ open: false, machine: null })}
          onSaved={() => { setMachineModal({ open: false, machine: null }); load(); }}
        />
      )}
    </div>
  );
}
