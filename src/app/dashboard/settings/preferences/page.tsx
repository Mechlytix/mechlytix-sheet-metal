"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useDashboard } from "@/lib/dashboard-context";

// ─────────────────────────────────────────────────────────
// /dashboard/settings/preferences — Units + Appearance
// ─────────────────────────────────────────────────────────

export default function PreferencesPage() {
  const { units, setUnits } = useDashboard();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted && (theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches));

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Preferences</h1>
          <p className="dash-page-subtitle">Display settings and measurement units</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 540 }}>
        {/* ── Units ── */}
        <section className="settings-card">
          <h2 className="settings-card-title">Measurement Units</h2>
          <p className="settings-card-desc">Choose between metric and imperial units for all measurements across the dashboard.</p>

          <div className="pref-option-group">
            <button
              className={`pref-option ${units === "metric" ? "active" : ""}`}
              onClick={() => setUnits("metric")}
            >
              <div className="pref-option-icon">mm</div>
              <div className="pref-option-info">
                <span className="pref-option-label">Metric</span>
                <span className="pref-option-desc">Millimetres, kilograms</span>
              </div>
            </button>
            <button
              className={`pref-option ${units === "imperial" ? "active" : ""}`}
              onClick={() => setUnits("imperial")}
            >
              <div className="pref-option-icon">in</div>
              <div className="pref-option-info">
                <span className="pref-option-label">Imperial</span>
                <span className="pref-option-desc">Inches, pounds</span>
              </div>
            </button>
          </div>
        </section>

        {/* ── Appearance ── */}
        <section className="settings-card">
          <h2 className="settings-card-title">Appearance</h2>
          <p className="settings-card-desc">Choose your preferred colour scheme.</p>

          {mounted && (
            <div className="pref-option-group">
              <button
                className={`pref-option ${!isDark ? "active" : ""}`}
                onClick={() => setTheme("light")}
              >
                <div className="pref-option-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
                    <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
                    <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                </div>
                <div className="pref-option-info">
                  <span className="pref-option-label">Light</span>
                  <span className="pref-option-desc">Clean, bright interface</span>
                </div>
              </button>
              <button
                className={`pref-option ${isDark ? "active" : ""}`}
                onClick={() => setTheme("dark")}
              >
                <div className="pref-option-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                </div>
                <div className="pref-option-info">
                  <span className="pref-option-label">Dark</span>
                  <span className="pref-option-desc">Easy on the eyes</span>
                </div>
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
