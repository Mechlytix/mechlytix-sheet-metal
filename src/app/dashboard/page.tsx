import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

// ─────────────────────────────────────────────────────────
// /dashboard — Overview home page
// Stats cards + quick-action CTAs + recent quotes
// ─────────────────────────────────────────────────────────

async function getOverviewData(userId: string) {
  const supabase = await createClient();
  const [
    { count: quoteCount },
    { count: remnantCount },
    { count: materialCount },
    { data: recentQuotes },
  ] = await Promise.all([
    supabase.from("quotes").select("*", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("remnants").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("status", "available"),
    supabase.from("materials").select("*", { count: "exact", head: true }).or(`user_id.eq.${userId},is_system.eq.true`),
    supabase.from("quotes")
      .select("id, filename, input_type, unit_price, total_price, status, created_at, quantity")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  return { quoteCount: quoteCount ?? 0, remnantCount: remnantCount ?? 0, materialCount: materialCount ?? 0, recentQuotes: recentQuotes ?? [] };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "badge-neutral",
    sent: "badge-blue",
    accepted: "badge-green",
    rejected: "badge-red",
    expired: "badge-neutral",
  };
  return <span className={`status-badge ${map[status] ?? "badge-neutral"}`}>{status}</span>;
}

export default async function DashboardOverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { quoteCount, remnantCount, materialCount, recentQuotes } = await getOverviewData(user.id);

  const stats = [
    {
      label: "Total Quotes",
      value: quoteCount,
      icon: "📋",
      href: "/dashboard/quotes",
      color: "stat-blue",
    },
    {
      label: "Available Remnants",
      value: remnantCount,
      icon: "♻️",
      href: "/dashboard/scrap-rack",
      color: "stat-green",
    },
    {
      label: "Materials",
      value: materialCount,
      icon: "🧱",
      href: "/dashboard/materials",
      color: "stat-orange",
    },
  ];

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <h1 className="dash-page-title">Overview</h1>
        <Link href="/dashboard/quoter" className="btn-primary">
          ⚡ New Quote
        </Link>
      </div>

      {/* Stats strip */}
      <div className="stat-strip">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className={`stat-card ${s.color}`}>
            <span className="stat-icon">{s.icon}</span>
            <div className="stat-body">
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="overview-section">
        <h2 className="section-heading">Quick Actions</h2>
        <div className="quick-actions">
          <Link href="/dashboard/quoter" className="quick-action-card">
            <span className="qa-icon">⚡</span>
            <span className="qa-title">Instant Quote</span>
            <span className="qa-desc">Upload a STEP or DXF file to get a price</span>
          </Link>
          <Link href="/dashboard/unfolder" className="quick-action-card">
            <span className="qa-icon">🔲</span>
            <span className="qa-title">3D Unfolder</span>
            <span className="qa-desc">Unfold a STEP file and export a flat DXF</span>
          </Link>
          <Link href="/dashboard/scrap-rack" className="quick-action-card">
            <span className="qa-icon">♻️</span>
            <span className="qa-title">Log Remnant</span>
            <span className="qa-desc">Register leftover material after cutting</span>
          </Link>
          <Link href="/dashboard/materials" className="quick-action-card">
            <span className="qa-icon">🧱</span>
            <span className="qa-title">Materials</span>
            <span className="qa-desc">Manage your material database and prices</span>
          </Link>
        </div>
      </div>

      {/* Recent quotes */}
      <div className="overview-section">
        <div className="section-header-row">
          <h2 className="section-heading">Recent Quotes</h2>
          <Link href="/dashboard/quotes" className="btn-ghost-sm">View all →</Link>
        </div>

        {recentQuotes.length === 0 ? (
          <div className="empty-state">
            <p>No quotes yet.</p>
            <Link href="/dashboard/quoter" className="btn-primary">Create your first quote →</Link>
          </div>
        ) : (
          <div className="table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentQuotes.map((q) => (
                  <tr key={q.id}>
                    <td className="td-filename">
                      <Link href={`/dashboard/quotes/${q.id}`}>{q.filename}</Link>
                    </td>
                    <td><span className="input-type-badge">{q.input_type}</span></td>
                    <td>{q.quantity ?? 1}</td>
                    <td>{q.unit_price != null ? `£${q.unit_price.toFixed(2)}` : "—"}</td>
                    <td className="td-price">{q.total_price != null ? `£${q.total_price.toFixed(2)}` : "—"}</td>
                    <td><StatusBadge status={q.status ?? "draft"} /></td>
                    <td className="td-date">
                      {q.created_at ? new Date(q.created_at).toLocaleDateString("en-GB") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
