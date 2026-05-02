import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("name, company_name").eq("id", id).single();
  return { title: data ? `${data.name}${data.company_name ? ` — ${data.company_name}` : ""} | Mechlytix` : "Customer | Mechlytix" };
}

// ─── Status badge ─────────────────────────────────────────

const STATUS_CLASSES: Record<string, string> = {
  draft:    "status-badge badge-neutral",
  sent:     "status-badge badge-blue",
  accepted: "status-badge badge-green",
  declined: "status-badge badge-red",
  expired:  "status-badge badge-red",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={STATUS_CLASSES[status] ?? STATUS_CLASSES.draft} style={{ textTransform: "capitalize" }}>
      {status ?? "draft"}
    </span>
  );
}

// ─── Info row ─────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{children}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!customer) notFound();

  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, filename, status, unit_price, total_price, quantity, materials(name), created_at, input_type, thickness_mm, bend_count")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const totalQuotes = quotes?.length ?? 0;
  const acceptedRevenue = quotes?.filter(q => q.status === "accepted").reduce((s, q) => s + (Number(q.total_price) || 0), 0) ?? 0;
  const activeQuotes = quotes?.filter(q => q.status === "sent").length ?? 0;

  return (
    <div className="dash-page">
      {/* Header */}
      <div className="dash-page-header">
        <div>
          <Link href="/dashboard/customers" className="btn-ghost-sm" style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 10, fontSize: 12 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Customers
          </Link>
          <h1 className="dash-page-title">{customer.name}</h1>
          {customer.company_name && <p className="dash-page-subtitle">{customer.company_name}</p>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href={`/dashboard/customers/${id}/edit`} className="btn-ghost">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Customer
          </Link>
          <Link href="/dashboard/quoter" className="btn-primary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            New Quote
          </Link>
        </div>
      </div>

      {/* Stats strip */}
      <div className="stat-strip" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="stat-card">
          <div className="stat-icon">📄</div>
          <div className="stat-body">
            <div className="stat-value">{totalQuotes}</div>
            <div className="stat-label">Total Quotes</div>
          </div>
        </div>
        <div className="stat-card stat-green">
          <div className="stat-icon">💰</div>
          <div className="stat-body">
            <div className="stat-value">£{acceptedRevenue.toFixed(0)}</div>
            <div className="stat-label">Accepted Value</div>
          </div>
        </div>
        <div className="stat-card stat-blue">
          <div className="stat-icon">📨</div>
          <div className="stat-body">
            <div className="stat-value">{activeQuotes}</div>
            <div className="stat-label">Sent / Active</div>
          </div>
        </div>
      </div>

      {/* Main body */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>

        {/* Left: profile info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Contact details */}
          <div className="settings-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contact</h2>
            </div>
            <div style={{ padding: "0 18px 8px" }}>
              {customer.email ? (
                <InfoRow label="Email">
                  <a href={`mailto:${customer.email}`} style={{ color: "var(--accent-primary)", textDecoration: "none" }}>{customer.email}</a>
                </InfoRow>
              ) : null}
              {customer.phone ? <InfoRow label="Phone">{customer.phone}</InfoRow> : null}
              {customer.tax_id ? <InfoRow label="Tax ID / VAT">{customer.tax_id}</InfoRow> : null}
              <InfoRow label="Customer Since">
                {customer.created_at ? new Date(customer.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
              </InfoRow>
            </div>
          </div>

          {/* Addresses */}
          {(customer.billing_address || customer.shipping_address) && (
            <div className="settings-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
                <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Addresses</h2>
              </div>
              <div style={{ padding: "0 18px 8px" }}>
                {customer.billing_address && (
                  <InfoRow label="Billing">
                    <span style={{ whiteSpace: "pre-line", lineHeight: 1.6 }}>{customer.billing_address}</span>
                  </InfoRow>
                )}
                {customer.shipping_address && customer.shipping_address !== customer.billing_address && (
                  <InfoRow label="Shipping">
                    <span style={{ whiteSpace: "pre-line", lineHeight: 1.6 }}>{customer.shipping_address}</span>
                  </InfoRow>
                )}
                {customer.shipping_address === customer.billing_address && customer.billing_address && (
                  <InfoRow label="Shipping">
                    <span style={{ color: "var(--text-dim)", fontStyle: "italic", fontSize: 12 }}>Same as billing</span>
                  </InfoRow>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {customer.notes && (
            <div className="settings-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
                <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes</h2>
              </div>
              <p style={{ margin: 0, padding: "14px 18px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-line" }}>{customer.notes}</p>
            </div>
          )}
        </div>

        {/* Right: quotes */}
        <div className="table-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quote History</h2>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{totalQuotes} total</span>
          </div>

          {!quotes || quotes.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 32px", textAlign: "center", gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>No quotes yet</p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>Quotes saved in the Quoter will appear here once linked to this customer.</p>
              </div>
              <Link href="/dashboard/quoter" className="btn-primary" style={{ marginTop: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Create a Quote
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Part File</th>
                    <th>Status</th>
                    <th>Unit Price</th>
                    <th>Qty</th>
                    <th>Total</th>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(quotes as any[]).map((q) => (
                    <tr key={q.id}>
                      <td>
                        <div style={{ fontWeight: 500, color: "var(--text-primary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
                          {q.filename}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, display: "flex", gap: 6 }}>
                          <span className="input-type-badge">{q.input_type}</span>
                          {q.thickness_mm ? <span>{q.thickness_mm}mm</span> : null}
                          {q.bend_count > 0 ? <span>{q.bend_count} bend{q.bend_count > 1 ? "s" : ""}</span> : null}
                        </div>
                      </td>
                      <td><StatusBadge status={q.status ?? "draft"} /></td>
                      <td className="td-price">{q.unit_price != null ? `£${Number(q.unit_price).toFixed(2)}` : "—"}</td>
                      <td className="td-muted">{q.quantity ?? 1}</td>
                      <td className="td-price">{q.total_price != null ? `£${Number(q.total_price).toFixed(2)}` : "—"}</td>
                      <td className="td-date">
                        {q.created_at ? new Date(q.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link href={`/dashboard/quotes/${q.id}`} className="btn-ghost-sm">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
