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

  // Fetch customers
  const { data: customers } = await supabase
    .from("customers")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Customers</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage your client roster and track their quotes.
          </p>
        </div>
        <Link 
          href="/dashboard/customers/new" 
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium rounded-md transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Customer
        </Link>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] rounded-lg overflow-hidden shadow-sm">
        <CustomerListClient initialCustomers={customers || []} />
      </div>
    </div>
  );
}
