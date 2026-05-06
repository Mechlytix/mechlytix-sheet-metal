"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_id: string | null;
  created_at: string | null;
}

interface Company {
  id: string;
  name: string;
  contacts: Contact[];
  created_at: string | null;
}

interface Props {
  initialCompanies: Company[];
}

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size < 30 ? "50%" : 8, flexShrink: 0,
      background: "rgba(255,102,0,0.12)", border: "1px solid rgba(255,102,0,0.2)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <span style={{ fontSize: size * 0.38, fontWeight: 700, color: "var(--accent-primary)" }}>
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

export function CustomerListClient({ initialCompanies }: Props) {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>(initialCompanies);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return companies;
    return companies
      .map((co) => {
        const coMatch = co.name.toLowerCase().includes(q);
        const matchingContacts = co.contacts.filter(
          (c) => c.name.toLowerCase().includes(q) || (c.email?.toLowerCase().includes(q) ?? false)
        );
        if (coMatch || matchingContacts.length > 0) {
          return { ...co, contacts: coMatch ? co.contacts : matchingContacts };
        }
        return null;
      })
      .filter(Boolean) as Company[];
  }, [companies, search]);

  async function handleDeleteContact(contactId: string, companyId: string) {
    if (!confirm("Remove this contact?")) return;
    setDeletingId(contactId);
    const supabase = createClient();
    const { error } = await supabase.from("customers").delete().eq("id", contactId);
    if (error) { alert("Failed to delete: " + error.message); }
    else {
      setCompanies((prev) =>
        prev.map((co) =>
          co.id === companyId ? { ...co, contacts: co.contacts.filter((c) => c.id !== contactId) } : co
        )
      );
    }
    setDeletingId(null);
  }

  async function handleDeleteCompany(companyId: string, name: string) {
    if (!confirm(`Delete company "${name}" and all its contacts?`)) return;
    setDeletingId(companyId);
    const supabase = createClient();
    // Contacts will have company_id set to null (SET NULL constraint), then delete company
    const { error } = await supabase.from("companies").delete().eq("id", companyId);
    if (error) { alert("Failed to delete company: " + error.message); }
    else {
      setCompanies((prev) => prev.filter((co) => co.id !== companyId));
      router.refresh();
    }
    setDeletingId(null);
  }

  if (companies.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 32px", textAlign: "center", gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,102,0,0.08)", border: "1px solid rgba(255,102,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 6px" }}>No companies yet</h3>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>Add your first company to start linking quotes to customers.</p>
        </div>
        <Link href="/dashboard/customers/new" className="btn-primary" style={{ marginTop: 4 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Add First Company
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="filter-bar" style={{ margin: 0 }}>
          <div style={{ position: "relative", flex: 1, maxWidth: 380 }}>
            <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", pointerEvents: "none" }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input type="search" placeholder="Search companies or contacts…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="search-input" style={{ paddingLeft: 34, width: "100%" }} />
          </div>
        </div>
      </div>

      {/* Company list */}
      {filtered.length === 0 ? (
        <div style={{ padding: "48px 32px", textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
          No results match &ldquo;{search}&rdquo;
        </div>
      ) : (
        <div>
          {filtered.map((co) => {
            const isExpanded = expandedIds.has(co.id) || !!search;
            return (
              <div key={co.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                {/* Company row */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: "transparent" }}>
                  <Avatar name={co.name} size={36} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{co.name}</span>
                      <span style={{ fontSize: 11, color: "var(--text-dim)", background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-subtle)", borderRadius: 10, padding: "1px 7px" }}>
                        {co.contacts.length} contact{co.contacts.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {co.created_at && (
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                        Added {new Date(co.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Link href={`/dashboard/customers/new?company=${co.id}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "rgba(255,102,0,0.06)", border: "1px solid rgba(255,102,0,0.2)", borderRadius: 6, color: "var(--accent-primary)", fontSize: 12, fontWeight: 500, textDecoration: "none" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                      Add Contact
                    </Link>
                    <button
                      onClick={() => handleDeleteCompany(co.id, co.name)}
                      disabled={deletingId === co.id}
                      className="icon-btn danger"
                      title="Delete company"
                      style={{ width: "auto", padding: "4px 10px", fontSize: 12 }}
                    >
                      {deletingId === co.id ? "…" : "Delete"}
                    </button>
                    {co.contacts.length > 0 && (
                      <button
                        onClick={() => toggleExpand(co.id)}
                        style={{ background: "transparent", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                          style={{ transition: "transform 0.15s", transform: isExpanded ? "rotate(180deg)" : "none" }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Contacts sub-rows */}
                {isExpanded && co.contacts.length > 0 && (
                  <div style={{ background: "rgba(0,0,0,0.02)" }}>
                    {co.contacts.map((contact) => (
                      <div key={contact.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 20px 9px 56px", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                        <Avatar name={contact.name} size={26} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link href={`/dashboard/customers/${contact.id}`}
                            style={{ fontSize: 13, fontWeight: 500, color: "var(--accent-primary)", textDecoration: "none" }}>
                            {contact.name}
                          </Link>
                          <div style={{ display: "flex", gap: 12, marginTop: 2, flexWrap: "wrap" }}>
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} style={{ fontSize: 11, color: "var(--text-dim)", textDecoration: "none" }}>
                                {contact.email}
                              </a>
                            )}
                            {contact.phone && (
                              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{contact.phone}</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Link href={`/dashboard/customers/${contact.id}`}
                            style={{ padding: "3px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)", borderRadius: 5, color: "var(--text-dim)", fontSize: 11, textDecoration: "none" }}>
                            View
                          </Link>
                          <Link href={`/dashboard/customers/${contact.id}/edit`}
                            style={{ padding: "3px 8px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-subtle)", borderRadius: 5, color: "var(--text-dim)", fontSize: 11, textDecoration: "none" }}>
                            Edit
                          </Link>
                          <button
                            onClick={() => handleDeleteContact(contact.id, co.id)}
                            disabled={deletingId === contact.id}
                            className="icon-btn danger"
                            style={{ width: "auto", padding: "3px 8px", fontSize: 11 }}
                          >
                            {deletingId === contact.id ? "…" : "Remove"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isExpanded && co.contacts.length === 0 && (
                  <div style={{ padding: "8px 20px 8px 56px", fontSize: 12, color: "var(--text-dim)", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
                    No contacts yet —{" "}
                    <Link href={`/dashboard/customers/new?company=${co.id}`} style={{ color: "var(--accent-primary)" }}>
                      add one
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border-subtle)", fontSize: 12, color: "var(--text-dim)" }}>
        {filtered.length} compan{filtered.length !== 1 ? "ies" : "y"}
        {search && ` matching "${search}"`}
        {" · "}
        {filtered.reduce((sum, co) => sum + co.contacts.length, 0)} total contacts
      </div>
    </div>
  );
}
