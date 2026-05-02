"use client";

import { useState, useEffect, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import type { Currency } from "@/lib/types/database";

// ─────────────────────────────────────────────────────────
// /dashboard/settings/quoting — Quoting Defaults
// ─────────────────────────────────────────────────────────

export default function QuotingSettingsPage() {
  const { setCurrency } = useDashboard();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  const [defaults, setDefaults] = useState({
    default_markup_percent: "15",
    quote_expiry_days: "30",
    currency: "GBP" as Currency,
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: s } = await supabase.from("user_settings")
        .select("*").eq("user_id", user.id).maybeSingle();

      if (s) setDefaults({
        default_markup_percent: String(s.default_markup_percent),
        quote_expiry_days:      String(s.quote_expiry_days),
        currency:               (s.currency as Currency) ?? "GBP",
      });
      setLoading(false);
    }
    load();
  }, []);

  async function save() {
    if (!userId) return;
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("user_settings").upsert({
        user_id:               userId,
        default_markup_percent: parseFloat(defaults.default_markup_percent) || 15,
        quote_expiry_days:     parseInt(defaults.quote_expiry_days) || 30,
        currency:              defaults.currency,
        updated_at:            new Date().toISOString(),
      });
      setCurrency(defaults.currency);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  if (loading) return <div className="dash-page"><div className="loading-state">Loading…</div></div>;

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Quoting Defaults</h1>
          <p className="dash-page-subtitle">Applied to all new quotes. Can be overridden per-quote.</p>
        </div>
      </div>

      <section className="settings-card" style={{ maxWidth: 540 }}>
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

        <button className="btn-primary" onClick={save}>
          {saved ? "✓ Saved" : "Save Defaults"}
        </button>
      </section>
    </div>
  );
}
