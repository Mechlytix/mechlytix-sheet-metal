import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { CompanyDetailTabs } from "@/components/CompanyDetailTabs";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("name").eq("id", id).single();
  return { title: data ? `${data.name} | Mechlytix` : "Customer | Mechlytix" };
}

// ─── Page ─────────────────────────────────────────────────

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch Company
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!company) notFound();

  // Fetch Contacts
  const { data: contacts } = await supabase
    .from("customers")
    .select("id, name, email, phone")
    .eq("company_id", id)
    .order("name", { ascending: true });

  // Fetch Quotes
  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, filename, status, unit_price, total_price, quantity, materials(name), created_at, input_type, thickness_mm, bend_count")
    .eq("company_id", id)
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
          <h1 className="dash-page-title">{company.name}</h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href={`/dashboard/customers/${id}/edit`} className="btn-ghost">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Company
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
      <div className="stat-strip" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 24 }}>
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

      {/* Main body with tabs */}
      <CompanyDetailTabs 
        company={company} 
        contacts={contacts ?? []} 
        quotes={quotes ?? []} 
      />
    </div>
  );
}
