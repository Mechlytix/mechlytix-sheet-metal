"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MachineProfile } from "@/lib/types/database";

// ─────────────────────────────────────────────────────────
// /dashboard/settings — Account + Machine Configuration
// ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [profile, setProfile] = useState({ full_name: "", company: "" });
  const [machine, setMachine] = useState<Partial<MachineProfile>>({
    name: "4kW Fiber Laser",
    machine_type: "laser",
    power_kw: 4,
    hourly_rate: 85,
    pierce_time_seconds: 0.5,
    setup_time_minutes: 15,
    cost_per_bend: 2.50,
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [machineId, setMachineId] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [machineSaved, setMachineSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [{ data: p }, { data: m }] = await Promise.all([
        supabase.from("profiles").select("full_name, company").eq("id", user.id).single(),
        supabase.from("machine_profiles")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at")
          .limit(1)
          .maybeSingle(),
      ]);

      if (p) setProfile({ full_name: p.full_name ?? "", company: p.company ?? "" });
      if (m) { setMachine(m); setMachineId(m.id); }
      setLoading(false);
    }
    load();
  }, []);

  async function saveProfile() {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("profiles")
      .update({ full_name: profile.full_name, company: profile.company })
      .eq("id", userId);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  async function saveMachine() {
    if (!userId) return;
    const supabase = createClient();
    const payload = {
      user_id: userId,
      name: machine.name ?? "My Laser",
      machine_type: machine.machine_type ?? "laser",
      power_kw: machine.power_kw ?? null,
      hourly_rate: machine.hourly_rate ?? 85,
      pierce_time_seconds: machine.pierce_time_seconds ?? 0.5,
      setup_time_minutes: machine.setup_time_minutes ?? 15,
      cost_per_bend: machine.cost_per_bend ?? 2.50,
      is_default: true,
    };
    if (machineId) {
      await supabase.from("machine_profiles").update(payload).eq("id", machineId);
    } else {
      const { data } = await supabase.from("machine_profiles").insert(payload).select("id").single();
      if (data) setMachineId(data.id);
    }
    setMachineSaved(true);
    setTimeout(() => setMachineSaved(false), 2000);
  }

  const setM = (k: string, v: string | number) =>
    setMachine((p) => ({ ...p, [k]: v }));

  if (loading) return <div className="dash-page"><div className="loading-state">Loading settings…</div></div>;

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <h1 className="dash-page-title">Settings</h1>
      </div>

      <div className="settings-grid">
        {/* ── Profile ── */}
        <section className="settings-card">
          <h2 className="settings-card-title">Profile</h2>
          <div className="form-field">
            <label>Full Name</label>
            <input
              value={profile.full_name}
              onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
              placeholder="Jane Smith"
            />
          </div>
          <div className="form-field">
            <label>Company</label>
            <input
              value={profile.company}
              onChange={(e) => setProfile((p) => ({ ...p, company: e.target.value }))}
              placeholder="Acme Fabrication Ltd"
            />
          </div>
          <button className="btn-primary" onClick={saveProfile}>
            {profileSaved ? "✓ Saved" : "Save Profile"}
          </button>
        </section>

        {/* ── Machine Profile ── */}
        <section className="settings-card">
          <h2 className="settings-card-title">Machine Profile</h2>
          <p className="settings-card-desc">
            These values are used in the pricing engine for cut-time and cost calculations.
          </p>

          <div className="form-row-2">
            <div className="form-field">
              <label>Machine Name</label>
              <input value={machine.name ?? ""} onChange={(e) => setM("name", e.target.value)} placeholder="4kW Fiber Laser" />
            </div>
            <div className="form-field">
              <label>Type</label>
              <select value={machine.machine_type ?? "laser"} onChange={(e) => setM("machine_type", e.target.value)}>
                <option value="laser">Fiber Laser</option>
                <option value="plasma">Plasma</option>
                <option value="waterjet">Waterjet</option>
                <option value="punch">Punch</option>
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-field">
              <label>Power (kW)</label>
              <input type="number" step="0.5" value={machine.power_kw ?? ""} onChange={(e) => setM("power_kw", parseFloat(e.target.value))} placeholder="4" />
            </div>
            <div className="form-field">
              <label>Machine Rate (£/hr)</label>
              <input type="number" step="1" value={machine.hourly_rate ?? 85} onChange={(e) => setM("hourly_rate", parseFloat(e.target.value))} />
            </div>
          </div>

          <div className="form-row-3">
            <div className="form-field">
              <label>Pierce Time (s)</label>
              <input type="number" step="0.1" value={machine.pierce_time_seconds ?? 0.5} onChange={(e) => setM("pierce_time_seconds", parseFloat(e.target.value))} />
            </div>
            <div className="form-field">
              <label>Setup Time (min)</label>
              <input type="number" step="1" value={machine.setup_time_minutes ?? 15} onChange={(e) => setM("setup_time_minutes", parseFloat(e.target.value))} />
            </div>
            <div className="form-field">
              <label>Cost / Bend (£)</label>
              <input type="number" step="0.10" value={machine.cost_per_bend ?? 2.50} onChange={(e) => setM("cost_per_bend", parseFloat(e.target.value))} />
            </div>
          </div>

          <div className="settings-info-box">
            <strong>Feed Rates</strong>
            <p>Detailed feed rates by material and thickness will be configurable in a future update. The quoter currently uses sensible defaults based on your machine type and power.</p>
          </div>

          <button className="btn-primary" onClick={saveMachine}>
            {machineSaved ? "✓ Saved" : "Save Machine"}
          </button>
        </section>

        {/* ── Pricing Defaults ── */}
        <section className="settings-card">
          <h2 className="settings-card-title">Quoting Defaults</h2>
          <p className="settings-card-desc">Default values applied to new quotes. Can be overridden per-quote.</p>
          <div className="form-row-2">
            <div className="form-field">
              <label>Default Markup (%)</label>
              <input type="number" defaultValue={15} placeholder="15" />
            </div>
            <div className="form-field">
              <label>Quote Expiry (days)</label>
              <input type="number" defaultValue={30} placeholder="30" />
            </div>
          </div>
          <div className="form-field">
            <label>Default Currency</label>
            <select defaultValue="GBP">
              <option value="GBP">GBP — British Pound (£)</option>
              <option value="EUR">EUR — Euro (€)</option>
              <option value="USD">USD — US Dollar ($)</option>
            </select>
          </div>
          <div className="settings-info-box">
            <p>Quoting default persistence coming in a future update.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
