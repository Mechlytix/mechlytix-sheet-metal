"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Customer {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  created_at: string | null;
}

interface Props {
  initialCustomers: Customer[];
}

export function CustomerListClient({ initialCustomers }: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company_name?.toLowerCase().includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false)
    );
  }, [customers, search]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete customer "${name}"? This will remove the customer link from any associated quotes.`)) return;
    setDeletingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) {
      alert("Failed to delete customer: " + error.message);
    } else {
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    }
    setDeletingId(null);
  }

  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">No customers yet</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-6">Add your first client to start linking quotes to customers.</p>
        <Link
          href="/dashboard/customers/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-sm font-medium rounded-md transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add First Customer
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Search bar */}
      <div className="p-4 border-b border-[var(--border-subtle)]">
        <div className="relative max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder="Search customers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-md text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--text-secondary)]">
          No customers match &ldquo;{search}&rdquo;
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="px-5 py-3 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">Name</th>
                <th className="px-5 py-3 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">Company</th>
                <th className="px-5 py-3 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">Email</th>
                <th className="px-5 py-3 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">Phone</th>
                <th className="px-5 py-3 text-left font-medium text-[var(--text-secondary)] whitespace-nowrap">Added</th>
                <th className="px-5 py-3 text-right font-medium text-[var(--text-secondary)] whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-[var(--bg-tertiary)] transition-colors group"
                >
                  <td className="px-5 py-3 font-medium text-[var(--text-primary)]">
                    <Link href={`/dashboard/customers/${c.id}`} className="hover:text-[var(--accent-primary)] transition-colors">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-[var(--text-secondary)]">{c.company_name ?? "—"}</td>
                  <td className="px-5 py-3 text-[var(--text-secondary)]">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="hover:text-[var(--accent-primary)] transition-colors">{c.email}</a>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3 text-[var(--text-secondary)]">{c.phone ?? "—"}</td>
                  <td className="px-5 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/dashboard/customers/${c.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
                      >
                        View
                      </Link>
                      <Link
                        href={`/dashboard/customers/${c.id}/edit`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={deletingId === c.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md border border-transparent text-red-400 hover:bg-red-500/10 hover:border-red-500/30 transition-colors disabled:opacity-50"
                      >
                        {deletingId === c.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-5 py-3 border-t border-[var(--border-subtle)] text-xs text-[var(--text-tertiary)]">
        {filtered.length} customer{filtered.length !== 1 ? "s" : ""}
        {search && ` matching "${search}"`}
      </div>
    </div>
  );
}
