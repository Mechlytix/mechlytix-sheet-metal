import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

// /dashboard/quotes — Quote history table (server rendered)

export default async function QuotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: quotes } = await supabase
    .from("quotes")
    .select(`
      id, filename, input_type, quantity, unit_price, total_price,
      status, customer_name, thickness_mm, bend_count, created_at,
      quote_number,
      materials(name, category)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  // Group quotes by quote_number (or id if missing)
  const grouped = (quotes || []).reduce((acc: any[], q) => {
    const existing = acc.find(item => item.quote_number === q.quote_number && q.quote_number != null);
    if (existing) {
      existing.isBatch = true;
      existing.childCount = (existing.childCount || 1) + 1;
      existing.total_price = (existing.total_price || 0) + (q.total_price || 0);
      existing.quantity = (existing.quantity || 0) + (q.quantity || 0);
      // Keep track of materials/thickness to see if they match
      if (existing.thickness_mm !== q.thickness_mm) existing.thickness_mm = "Mixed";
      if (existing.bend_count !== q.bend_count) existing.bend_count = "Mixed";
      return acc;
    }
    acc.push({ ...q, isBatch: false, childCount: 1 });
    return acc;
  }, []);

  function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
      draft: "badge-neutral", sent: "badge-blue",
      accepted: "badge-green", rejected: "badge-red", expired: "badge-neutral",
    };
    return <span className={`status-badge ${map[status] ?? "badge-neutral"}`}>{status}</span>;
  }

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Quotes</h1>
          <p className="dash-page-subtitle">{quotes?.length ?? 0} items across {grouped.length} quotations</p>
        </div>
        <div className="dash-page-actions">
          <Link href="/dashboard/quoter" className="btn-primary">⚡ New Quote</Link>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="empty-state">
          <p>No quotes yet.</p>
          <Link href="/dashboard/quoter" className="btn-primary">Create your first quote →</Link>
        </div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Main File / Batch</th>
                <th>Type</th>
                <th>Material</th>
                <th>Thickness</th>
                <th>Bends</th>
                <th>Parts</th>
                <th>Total (ex. VAT)</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((q) => (
                <tr key={q.id} className="quote-row-link">
                  <td colSpan={11} style={{ padding: 0 }}>
                    <Link href={`/dashboard/quotes/${q.id}`} className="quote-row-inner">
                      <span className="td-quote-number">{q.quote_number || "—"}</span>
                      <span className="td-filename">
                        {q.isBatch ? (
                          <span className="batch-label">
                            <span className="batch-icon">📦</span> 
                            {q.filename} <span className="batch-count">+{q.childCount - 1} more</span>
                          </span>
                        ) : (
                          q.filename
                        )}
                      </span>
                      <span><span className="input-type-badge">{q.input_type}</span></span>
                      <span className="td-muted">
                        {q.materials ? q.materials.name : "—"}
                      </span>
                      <span className="td-muted">
                        {q.thickness_mm === "Mixed" ? "Mixed" : (q.thickness_mm != null ? `${q.thickness_mm}mm` : "—")}
                      </span>
                      <span className="td-muted">
                        {q.bend_count === "Mixed" ? "Mixed" : (q.bend_count ?? "—")}
                      </span>
                      <span>{q.quantity ?? 1}</span>
                      <span className="td-price">{q.total_price != null ? `£${q.total_price.toFixed(2)}` : "—"}</span>
                      <span className="td-muted">{q.customer_name ?? "—"}</span>
                      <span><StatusBadge status={q.status ?? "draft"} /></span>
                      <span className="td-date">
                        {q.created_at ? new Date(q.created_at).toLocaleDateString("en-GB") : "—"}
                      </span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
