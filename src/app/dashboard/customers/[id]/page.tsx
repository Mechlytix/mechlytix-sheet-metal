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

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft:    { bg: "bg-gray-500/15",  text: "text-gray-400",  label: "Draft" },
  sent:     { bg: "bg-blue-500/15",  text: "text-blue-400",  label: "Sent" },
  accepted: { bg: "bg-green-500/15", text: "text-green-400", label: "Accepted" },
  declined: { bg: "bg-red-500/15",   text: "text-red-400",   label: "Declined" },
  expired:  { bg: "bg-yellow-500/15",text: "text-yellow-400",label: "Expired" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ─── Info row ─────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-[var(--border-subtle)] last:border-0">
      <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
      <span className="text-sm text-[var(--text-primary)]">{value}</span>
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
    .select("id, filename, status, unit_price, total_price, quantity, material_id, materials(name), created_at, input_type, thickness_mm, bend_count")
    .eq("customer_id", id)
    .order("created_at", { ascending: false });

  const totalRevenue = quotes?.filter(q => q.status === "accepted").reduce((sum, q) => sum + (q.total_price ?? 0), 0) ?? 0;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <Link
            href="/dashboard/customers"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-3"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Customers
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{customer.name}</h1>
          {customer.company_name && (
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">{customer.company_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/dashboard/customers/${id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)] transition-colors bg-[var(--bg-secondary)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </Link>
          <Link
            href={`/dashboard/quoter`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            New Quote
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: customer info */}
        <div className="lg:col-span-1 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-[var(--text-primary)]">{quotes?.length ?? 0}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">Total Quotes</div>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                £{totalRevenue.toFixed(0)}
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">Accepted Value</div>
            </div>
          </div>

          {/* Contact details */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg">
            <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Contact Details</h2>
            </div>
            <div className="px-5">
              <InfoRow label="Email" value={customer.email ? <a href={`mailto:${customer.email}`} className="hover:text-[var(--accent-primary)] transition-colors">{customer.email}</a> : null} />
              <InfoRow label="Phone" value={customer.phone} />
              <InfoRow label="Tax ID / VAT" value={customer.tax_id} />
              <InfoRow label="Added" value={customer.created_at ? new Date(customer.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : null} />
            </div>
          </div>

          {/* Addresses */}
          {(customer.billing_address || customer.shipping_address) && (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg">
              <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Addresses</h2>
              </div>
              <div className="px-5">
                <InfoRow
                  label="Billing Address"
                  value={customer.billing_address
                    ? <span className="whitespace-pre-line leading-relaxed">{customer.billing_address}</span>
                    : null}
                />
                <InfoRow
                  label="Shipping Address"
                  value={customer.shipping_address
                    ? <span className="whitespace-pre-line leading-relaxed">{customer.shipping_address}</span>
                    : null}
                />
              </div>
            </div>
          )}

          {/* Notes */}
          {customer.notes && (
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg">
              <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">Notes</h2>
              </div>
              <p className="px-5 py-4 text-sm text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">{customer.notes}</p>
            </div>
          )}
        </div>

        {/* Right column: quotes */}
        <div className="lg:col-span-2">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Quotes</h2>
              <span className="text-xs text-[var(--text-tertiary)]">{quotes?.length ?? 0} total</span>
            </div>

            {!quotes || quotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-8">
                <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-3">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-3">No quotes linked to this customer yet.</p>
                <Link
                  href="/dashboard/quoter"
                  className="text-sm font-medium text-[var(--accent-primary)] hover:underline"
                >
                  Create a quote →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <th className="px-5 py-3 text-left font-medium text-[var(--text-secondary)]">Part</th>
                      <th className="px-5 py-3 text-left font-medium text-[var(--text-secondary)]">Status</th>
                      <th className="px-5 py-3 text-left font-medium text-[var(--text-secondary)]">Unit Price</th>
                      <th className="px-5 py-3 text-left font-medium text-[var(--text-secondary)]">Qty</th>
                      <th className="px-5 py-3 text-left font-medium text-[var(--text-secondary)]">Total</th>
                      <th className="px-5 py-3 text-left font-medium text-[var(--text-secondary)]">Date</th>
                      <th className="px-5 py-3 text-right font-medium text-[var(--text-secondary)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(quotes as any[]).map((q) => (
                      <tr key={q.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-medium text-[var(--text-primary)] max-w-[180px] truncate" title={q.filename}>
                            {q.filename}
                          </div>
                          <div className="text-xs text-[var(--text-tertiary)] mt-0.5 uppercase">
                            {q.input_type}
                            {q.thickness_mm ? ` · ${q.thickness_mm}mm` : ""}
                            {q.bend_count > 0 ? ` · ${q.bend_count} bend${q.bend_count > 1 ? "s" : ""}` : ""}
                          </div>
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={q.status ?? "draft"} /></td>
                        <td className="px-5 py-3 text-[var(--text-primary)] font-medium">
                          {q.unit_price != null ? `£${Number(q.unit_price).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-5 py-3 text-[var(--text-secondary)]">{q.quantity ?? 1}</td>
                        <td className="px-5 py-3 text-[var(--text-primary)] font-medium">
                          {q.total_price != null ? `£${Number(q.total_price).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-5 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                          {q.created_at ? new Date(q.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={`/dashboard/quotes/${q.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
                          >
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
        </div>
      </div>
    </div>
  );
}
