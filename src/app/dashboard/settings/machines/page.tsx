"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { MachineModal } from "@/components/MachineModal";
import type { MachineProfile } from "@/lib/types/database";

const MACHINE_TYPE_LABELS: Record<string, string> = {
  laser: "Fiber Laser", plasma: "Plasma", waterjet: "Waterjet", punch: "Punch",
};

export default function MachinesSettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [machines, setMachines] = useState<MachineProfile[]>([]);
  const [machineModal, setMachineModal] = useState<{ open: boolean; machine: MachineProfile | null }>({ open: false, machine: null });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data: ms } = await supabase.from("machine_profiles").select("*").eq("user_id", user.id).order("created_at");
    if (ms) setMachines(ms);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function deleteMachine(id: string) {
    if (!confirm("Delete this machine profile?")) return;
    setDeletingId(id);
    const supabase = createClient();
    await supabase.from("machine_profiles").delete().eq("id", id);
    setDeletingId(null);
    load();
  }

  async function setDefaultMachine(id: string) {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("machine_profiles").update({ is_default: false }).eq("user_id", userId);
    await supabase.from("machine_profiles").update({ is_default: true }).eq("id", id);
    load();
  }

  if (loading) return <div className="dash-page"><div className="loading-state">Loading…</div></div>;

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Machine Profiles</h1>
          <p className="dash-page-subtitle">Each machine has its own hourly rate, timing parameters, and optional custom feed rates</p>
        </div>
        <button className="btn-primary" onClick={() => setMachineModal({ open: true, machine: null })}>+ Add Machine</button>
      </div>

      {machines.length === 0 ? (
        <div className="empty-state" style={{ padding: "32px 0" }}>
          <p>No machines configured yet.</p>
          <button className="btn-ghost" onClick={() => setMachineModal({ open: true, machine: null })}>Add your first machine</button>
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Type</th><th>Power</th><th>Rate (£/hr)</th>
                <th>Pierce (s)</th><th>Setup (min)</th><th>Bend Cost</th><th>Feed Rates</th><th></th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {m.is_default && <span title="Default machine" style={{ color: "var(--accent-primary)", fontSize: 14 }}>★</span>}
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
                    {m.feed_rates && typeof m.feed_rates === "object" && Object.keys(m.feed_rates).length > 0
                      ? <span className="badge-custom">Custom</span>
                      : <span className="badge-system">Default</span>}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {!m.is_default && <button className="icon-btn" title="Set as default" onClick={() => setDefaultMachine(m.id)}>★</button>}
                      <button className="icon-btn" title="Edit machine" onClick={() => setMachineModal({ open: true, machine: m })}>🖊</button>
                      <button className="icon-btn danger" title="Delete machine" onClick={() => deleteMachine(m.id)} disabled={deletingId === m.id}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
