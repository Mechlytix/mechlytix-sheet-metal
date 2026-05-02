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

  // Fetch customers + quote count per customer
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name, company_name, email, phone, billing_address, created_at")
    .order("name", { ascending: true });

  return (
    <div className="dash-page">
      {/* Page Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Customers</h1>
          <p className="dash-page-subtitle">Manage your client roster and track their quotes.</p>
        </div>
        <Link href="/dashboard/customers/new" className="btn-primary">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Customer
        </Link>
      </div>

      {/* Customer Table */}
      <div className="table-card">
        <CustomerListClient initialCustomers={customers || []} />
      </div>
    </div>
  );
}
