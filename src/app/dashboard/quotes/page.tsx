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
          <p className="dash-page-subtitle">{quotes?.length ?? 0} quotes total</p>
        </div>
        <Link href="/dashboard/quoter" className="btn-primary">⚡ New Quote</Link>
      </div>

      {!quotes || quotes.length === 0 ? (
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
                <th>Material</th>
                <th>Thickness</th>
                <th>Bends</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id}>
                  <td className="td-filename">
                    <Link href={`/dashboard/quotes/${q.id}`}>{q.filename}</Link>
                    {q.quote_number && <span style={{ fontSize: 10, color: "var(--text-dim)", marginLeft: 6 }}>{q.quote_number}</span>}
                  </td>
                  <td><span className="input-type-badge">{q.input_type}</span></td>
                  <td className="td-muted">
                    {/* @ts-expect-error — joined relation */}
                    {q.materials ? q.materials.name : "—"}
                  </td>
                  <td className="td-muted">
                    {q.thickness_mm != null ? `${q.thickness_mm}mm` : "—"}
                  </td>
                  <td className="td-muted">{q.bend_count ?? "—"}</td>
                  <td>{q.quantity ?? 1}</td>
                  <td>{q.unit_price != null ? `£${q.unit_price.toFixed(2)}` : "—"}</td>
                  <td className="td-price">{q.total_price != null ? `£${q.total_price.toFixed(2)}` : "—"}</td>
                  <td className="td-muted">{q.customer_name ?? "—"}</td>
                  <td><StatusBadge status={q.status ?? "draft"} /></td>
                  <td className="td-date">
                    {q.created_at ? new Date(q.created_at).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td>
                    <Link href={`/dashboard/quotes/${q.id}`} className="btn-secondary" style={{ padding: "4px 8px", fontSize: "11px" }}>
                      View
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
