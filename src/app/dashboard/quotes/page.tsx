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
      status, customer_name, created_at, quote_number, group_id,
      materials(name, category),
      customers(name, company_name)
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  // Group quotes by quote_number for batch display
  interface GroupedQuote {
    id: string;
    quote_number: string | null;
    filename: string;
    input_type: string;
    total_price: number;
    status: string;
    created_at: string;
    customer_display: string;
    customer_sub: string;
    material_display: string;
    childCount: number;
    partQty: number;
    isBatch: boolean;
  }

  const grouped: GroupedQuote[] = [];

  for (const q of (quotes || [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cust = (q as any).customers;
    const companyName = cust?.company_name || "";
    const contactName = cust?.name || q.customer_name || "";
    const customerDisplay = companyName || contactName || "—";
    const customerSub = companyName && contactName ? contactName : "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mat = (q as any).materials;
    const materialDisplay = mat?.name || "—";

    const existing = grouped.find(
      item => item.quote_number === q.quote_number && q.quote_number != null
    );

    if (existing) {
      existing.isBatch = true;
      existing.childCount += 1;
      existing.total_price = (existing.total_price || 0) + (q.total_price || 0);
      existing.partQty += (q.quantity || 1);
      if (existing.material_display !== materialDisplay) {
        existing.material_display = "Mixed";
      }
    } else {
      grouped.push({
        id: q.id,
        quote_number: q.quote_number,
        filename: q.filename,
        input_type: q.input_type,
        total_price: q.total_price || 0,
        status: q.status || "draft",
        created_at: q.created_at || "",
        customer_display: customerDisplay,
        customer_sub: customerSub,
        material_display: materialDisplay,
        childCount: 1,
        partQty: q.quantity || 1,
        isBatch: false,
      });
    }
  }

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
          <p className="dash-page-subtitle">
            {quotes?.length ?? 0} line items across {grouped.length} quotations
          </p>
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
          <table className="data-table quotes-table">
            <colgroup>
              <col style={{ width: 90 }} />
              <col />
              <col style={{ width: 160 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 100 }} />
            </colgroup>
            <thead>
              <tr>
                <th>Quote</th>
                <th>Description</th>
                <th>Customer</th>
                <th className="th-right">Parts</th>
                <th className="th-right">Total (ex. VAT)</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((q) => (
                <tr key={q.id} className={`quote-row-link ${q.isBatch ? "quote-row-batch" : ""}`}>
                  <td colSpan={7} style={{ padding: 0 }}>
                    <Link href={`/dashboard/quotes/${q.id}`} className="quote-row-inner quote-row-7col">
                      {/* Quote # */}
                      <span className="td-quote-number">{q.quote_number || "—"}</span>

                      {/* Description: filename + material + batch badge */}
                      <span className="td-description">
                        <span className="td-filename-text">{q.filename}</span>
                        <span className="td-description-meta">
                          <span className="input-type-badge">{q.input_type}</span>
                          {q.material_display !== "—" && (
                            <span className="td-material-tag">{q.material_display}</span>
                          )}
                          {q.isBatch && (
                            <span className="td-batch-badge">{q.childCount} parts</span>
                          )}
                        </span>
                      </span>

                      {/* Customer */}
                      <span className="td-customer">
                        <span className="td-customer-company">{q.customer_display}</span>
                        {q.customer_sub && (
                          <span className="td-customer-contact">{q.customer_sub}</span>
                        )}
                      </span>

                      {/* Parts qty */}
                      <span className="td-right">{q.partQty}</span>

                      {/* Total */}
                      <span className="td-price td-right">
                        {q.total_price > 0 ? `£${q.total_price.toFixed(2)}` : "—"}
                      </span>

                      {/* Status */}
                      <span><StatusBadge status={q.status} /></span>

                      {/* Date */}
                      <span className="td-date">
                        {q.created_at ? new Date(q.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
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
