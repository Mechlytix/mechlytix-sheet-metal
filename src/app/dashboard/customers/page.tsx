import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CustomerListClient } from "./CustomerListClient";

export const metadata = {
  title: "Customers | Mechlytix",
};

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch companies with their contacts nested
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, created_at")
    .order("name", { ascending: true });

  const { data: contacts } = await supabase
    .from("customers")
    .select("id, name, email, phone, company_id, created_at")
    .order("name", { ascending: true });

  // Nest contacts under their companies
  const enrichedCompanies = (companies ?? []).map((co) => ({
    ...co,
    contacts: (contacts ?? []).filter((c) => c.company_id === co.id),
  }));

  return (
    <div className="dash-page">
      {/* Page Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Customers</h1>
          <p className="dash-page-subtitle">Manage companies and their contacts.</p>
        </div>
        <Link href="/dashboard/customers/new" className="btn-primary">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Company
        </Link>
      </div>

      {/* Company list */}
      <div className="table-card">
        <CustomerListClient initialCompanies={enrichedCompanies} />
      </div>
    </div>
  );
}
