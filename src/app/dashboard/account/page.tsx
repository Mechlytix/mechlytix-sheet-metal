// ─────────────────────────────────────────────────────────
// /dashboard/account — Account page (placeholder)
// ─────────────────────────────────────────────────────────

export default function AccountPage() {
  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Account</h1>
          <p className="dash-page-subtitle">Manage your account and security settings</p>
        </div>
      </div>

      <section className="settings-card" style={{ maxWidth: 540 }}>
        <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
          Account management coming soon.
        </p>
      </section>
    </div>
  );
}
