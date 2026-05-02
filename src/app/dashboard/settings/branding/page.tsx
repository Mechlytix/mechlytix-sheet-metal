"use client";

import { useState, useEffect, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

// ─────────────────────────────────────────────────────────
// /dashboard/settings/branding — Quote Branding
// ─────────────────────────────────────────────────────────

export default function BrandingSettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [, startTransition] = useTransition();

  const [branding, setBranding] = useState({
    brand_color: "#ff6600",
    quote_prefix: "Q-",
    next_quote_number: "1",
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: s } = await supabase.from("user_settings")
        .select("*").eq("user_id", user.id).maybeSingle();

      if (s) setBranding({
        brand_color:       s.brand_color ?? "#ff6600",
        quote_prefix:      s.quote_prefix ?? "Q-",
        next_quote_number: String(s.next_quote_number ?? 1),
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
        user_id:           userId,
        brand_color:       branding.brand_color,
        quote_prefix:      branding.quote_prefix || "Q-",
        next_quote_number: parseInt(branding.next_quote_number) || 1,
        updated_at:        new Date().toISOString(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  if (loading) return <div className="dash-page"><div className="loading-state">Loading…</div></div>;

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Quote Branding</h1>
          <p className="dash-page-subtitle">Customise the look and numbering of your PDF quotes</p>
        </div>
      </div>

      <section className="settings-card" style={{ maxWidth: 540 }}>
        {/* Brand Colour */}
        <div className="form-field">
          <label>Brand Colour</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="color"
              value={branding.brand_color}
              onChange={(e) => setBranding((d) => ({ ...d, brand_color: e.target.value }))}
              style={{ width: 40, height: 34, padding: 0, border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)", cursor: "pointer", background: "transparent" }}
            />
            <input
              type="text"
              value={branding.brand_color}
              onChange={(e) => setBranding((d) => ({ ...d, brand_color: e.target.value }))}
              placeholder="#ff6600"
              style={{ flex: 1, fontFamily: "var(--font-mono, monospace)" }}
              maxLength={7}
            />
            <div style={{ width: 60, height: 34, borderRadius: "var(--radius-md)", background: branding.brand_color, border: "1px solid var(--border-subtle)" }} />
          </div>
          <span className="field-hint">Used as the accent colour on your quote PDFs (header bar, table headers, totals).</span>
        </div>

        {/* Quote Prefix + Next Number */}
        <div className="form-row-2">
          <div className="form-field">
            <label>Quote Prefix</label>
            <input
              type="text"
              value={branding.quote_prefix}
              onChange={(e) => setBranding((d) => ({ ...d, quote_prefix: e.target.value }))}
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
              value={branding.next_quote_number}
              onChange={(e) => setBranding((d) => ({ ...d, next_quote_number: e.target.value }))}
            />
            <span className="field-hint">The next auto-assigned number</span>
          </div>
        </div>

        {/* Live preview */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)" }}>
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Next quote will be:</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: branding.brand_color, fontFamily: "var(--font-mono, monospace)" }}>
            {branding.quote_prefix}{String(parseInt(branding.next_quote_number) || 1).padStart(5, '0')}
          </span>
        </div>

        <button className="btn-primary" onClick={save}>
          {saved ? "✓ Saved" : "Save Branding"}
        </button>
      </section>
    </div>
  );
}
