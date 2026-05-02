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
    if (!confirm(`Delete customer "${name}"? This will unlink them from any associated quotes.`)) return;
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 32px", textAlign: "center", gap: "16px" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,102,0,0.08)", border: "1px solid rgba(255,102,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px" }}>No customers yet</h3>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>Add your first client to start linking quotes to customers.</p>
        </div>
        <Link href="/dashboard/customers/new" className="btn-primary" style={{ marginTop: 4 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add First Customer
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Search bar */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="filter-bar" style={{ margin: 0 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
            <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="search"
              placeholder="Search by name, company or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
              style={{ paddingLeft: 34, width: "100%" }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ padding: "48px 32px", textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
          No customers match &ldquo;{search}&rdquo;
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name / Company</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Added</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/dashboard/customers/${c.id}`} style={{ color: "var(--accent-primary)", fontWeight: 500, textDecoration: "none", fontSize: 13 }}>
                      {c.name}
                    </Link>
                    {c.company_name && (
                      <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>{c.company_name}</div>
                    )}
                  </td>
                  <td className="td-muted">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} style={{ color: "var(--text-secondary)", textDecoration: "none" }} onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent-primary)")} onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}>
                        {c.email}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="td-muted">{c.phone ?? "—"}</td>
                  <td className="td-date">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                      <Link
                        href={`/dashboard/customers/${c.id}`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)", borderRadius: 6, color: "var(--text-dim)", fontSize: 12, fontWeight: 500, textDecoration: "none", transition: "all 0.15s" }}
                        onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-active)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                        onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLElement).style.color = "var(--text-dim)"; }}
                      >
                        View
                      </Link>
                      <Link
                        href={`/dashboard/customers/${c.id}/edit`}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)", borderRadius: 6, color: "var(--text-dim)", fontSize: 12, fontWeight: 500, textDecoration: "none", transition: "all 0.15s" }}
                        onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-active)"; (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                        onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-subtle)"; (e.currentTarget as HTMLElement).style.color = "var(--text-dim)"; }}
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={deletingId === c.id}
                        className="icon-btn danger"
                        title="Delete customer"
                        style={{ width: "auto", padding: "4px 10px", fontSize: 12, fontWeight: 500 }}
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

      <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--text-dim)" }}>
        {filtered.length} customer{filtered.length !== 1 ? "s" : ""}{search && ` matching "${search}"`}
      </div>
    </div>
  );
}
