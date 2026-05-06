"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_id: string | null;
}

export interface Company {
  id: string;
  name: string;
  contacts: Contact[];
}

export interface CustomerSelection {
  companyId: string;
  companyName: string;
  contactId: string;
  contactName: string;
  contactEmail: string | null;
}

interface Props {
  userId: string | null;
  /** selected contact id (customer_id in quotes table) */
  value: string | null;
  onChange: (contactId: string | null, selection: CustomerSelection | null) => void;
}

// ── Inline Create Form ─────────────────────────────────────────────────────

interface CreateFormProps {
  userId: string;
  initialCompanyName: string;
  onCreated: (company: Company, contact: Contact) => void;
  onCancel: () => void;
}

function InlineCreateForm({ userId, initialCompanyName, onCreated, onCancel }: CreateFormProps) {
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || !contactName.trim() || !email.trim()) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();

    // 1. Create company
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .insert({ user_id: userId, name: companyName.trim() })
      .select("id, name")
      .single();

    if (companyErr || !company) {
      setError("Failed to create company: " + (companyErr?.message ?? "unknown"));
      setSaving(false);
      return;
    }

    // 2. Create contact linked to company
    const { data: contact, error: contactErr } = await supabase
      .from("customers")
      .insert({
        user_id: userId,
        company_id: company.id,
        name: contactName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
      })
      .select("id, name, email, phone, company_id")
      .single();

    if (contactErr || !contact) {
      setError("Failed to create contact: " + (contactErr?.message ?? "unknown"));
      setSaving(false);
      return;
    }

    onCreated(
      { id: company.id, name: company.name, contacts: [] },
      contact as Contact
    );
  }

  const inputCls = "w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)]";

  return (
    <form onSubmit={handleCreate} style={{ padding: "12px", borderTop: "1px solid var(--border-subtle)" }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 8 }}>
        New Company &amp; Contact
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input autoFocus type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Company name *" required className={inputCls} />
        <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)}
          placeholder="Contact name *" required className={inputCls} />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address *" required className={inputCls} />
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone (optional)" className={inputCls} />
      </div>

      {error && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 6 }}>{error}</p>}

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button type="submit" disabled={saving || !companyName.trim() || !contactName.trim() || !email.trim()}
          style={{ flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "none", background: "var(--accent-primary)", color: "white", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Creating…" : "Create & Select"}
        </button>
        <button type="button" onClick={onCancel}
          style={{ padding: "6px 12px", fontSize: 12, fontWeight: 500, borderRadius: 6, border: "1px solid var(--border-subtle)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main Selector ──────────────────────────────────────────────────────────

export function CustomerSelector({ userId, value, onChange }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CustomerSelection | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load companies + contacts
  const loadData = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();

    const [{ data: comps }, { data: contacts }] = await Promise.all([
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("customers").select("id, name, email, phone, company_id").order("name"),
    ]);

    const contactList = (contacts ?? []) as Contact[];
    const companyList: Company[] = (comps ?? []).map((co) => ({
      ...co,
      contacts: contactList.filter((c) => c.company_id === co.id),
    }));

    // Also include orphan contacts (no company_id) as standalone "companies"
    const orphans = contactList.filter((c) => !c.company_id);
    const orphanCompanies: Company[] = orphans.map((c) => ({
      id: `orphan:${c.id}`,
      name: c.name,
      contacts: [c],
    }));

    setCompanies([...companyList, ...orphanCompanies]);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Sync display when value changes externally
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    for (const co of companies) {
      const contact = co.contacts.find((c) => c.id === value);
      if (contact) {
        setSelected({
          companyId: co.id,
          companyName: co.name,
          contactId: contact.id,
          contactName: contact.name,
          contactEmail: contact.email,
        });
        return;
      }
    }
  }, [value, companies]);

  // Close on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Filter companies + contacts by search
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return companies;
    return companies
      .map((co) => {
        const companyMatches = co.name.toLowerCase().includes(q);
        const matchingContacts = co.contacts.filter(
          (c) => c.name.toLowerCase().includes(q) || (c.email?.toLowerCase().includes(q) ?? false)
        );
        if (companyMatches || matchingContacts.length > 0) {
          return { ...co, contacts: companyMatches ? co.contacts : matchingContacts };
        }
        return null;
      })
      .filter(Boolean) as Company[];
  }, [companies, search]);

  function handleSelectContact(co: Company, contact: Contact) {
    const sel: CustomerSelection = {
      companyId: co.id,
      companyName: co.name,
      contactId: contact.id,
      contactName: contact.name,
      contactEmail: contact.email,
    };
    setSelected(sel);
    onChange(contact.id, sel);
    setOpen(false);
    setSearch("");
    setShowCreate(false);
  }

  function handleClear() {
    setSelected(null);
    onChange(null, null);
  }

  function toggleCompany(coId: string, contactCount: number) {
    // If only one contact, auto-select and close
    if (contactCount === 0) return;
    setExpandedCompanyId((prev) => (prev === coId ? null : coId));
  }

  const handleCreated = useCallback((company: Company, contact: Contact) => {
    const fullContact: Contact = { ...contact, company_id: company.id };
    const newCompany: Company = { ...company, contacts: [fullContact] };
    setCompanies((prev) => [...prev, newCompany].sort((a, b) => a.name.localeCompare(b.name)));
    handleSelectContact(newCompany, fullContact);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-expand when searching
  useEffect(() => {
    if (search && filtered.length > 0) {
      setExpandedCompanyId(filtered[0].id);
    }
  }, [search, filtered]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setShowCreate(false); setSearch(""); }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 12px",
          fontSize: 13,
          borderRadius: 8,
          border: open
            ? "1px solid var(--accent-primary)"
            : "1px solid var(--border-subtle)",
          boxShadow: open ? "0 0 0 1px var(--accent-primary)" : "none",
          background: "var(--bg-primary)",
          cursor: "pointer",
          textAlign: "left",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      >
        <span style={{ overflow: "hidden", flex: 1 }}>
          {selected ? (
            <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>
                {selected.companyName}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {selected.contactName}{selected.contactEmail ? ` · ${selected.contactEmail}` : ""}
              </span>
            </span>
          ) : (
            <span style={{ color: "var(--text-dim)", fontSize: 13 }}>Select customer…</span>
          )}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); handleClear(); } }}
              style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", color: "var(--text-dim)", cursor: "pointer", fontSize: 14, lineHeight: 1 }}
            >
              ×
            </span>
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2.5" strokeLinecap="round"
            style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div style={{
          position: "absolute",
          zIndex: 200,
          marginTop: 4,
          width: "100%",
          minWidth: 280,
          borderRadius: 10,
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)",
          overflow: "hidden",
        }}>
          {/* Search */}
          <div style={{ padding: "8px 8px 6px", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ position: "relative" }}>
              <svg style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)", pointerEvents: "none" }}
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowCreate(false); }}
                placeholder="Search companies or contacts…"
                style={{
                  width: "100%", paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
                  fontSize: 12, borderRadius: 6, border: "1px solid var(--border-subtle)",
                  background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent-primary)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-subtle)")}
              />
            </div>
          </div>

          {/* Company → contact list */}
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {filtered.length === 0 && !showCreate ? (
              <div style={{ padding: "16px 12px", fontSize: 13, color: "var(--text-dim)", textAlign: "center" }}>
                {search ? `No results for "${search}"` : "No customers yet"}
              </div>
            ) : (
              filtered.map((co) => {
                const isExpanded = expandedCompanyId === co.id || !!search;
                const isSelectedCompany = selected?.companyId === co.id;

                return (
                  <div key={co.id}>
                    {/* Company row */}
                    <button
                      type="button"
                      onClick={() => toggleCompany(co.id, co.contacts.length)}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 10,
                        padding: "8px 12px", background: isSelectedCompany ? "rgba(255,102,0,0.06)" : "transparent",
                        border: "none", cursor: "pointer", textAlign: "left",
                        borderBottom: "1px solid var(--border-subtle)",
                        transition: "background 0.1s",
                      }}
                      onMouseOver={(e) => { if (!isSelectedCompany) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                      onMouseOut={(e) => { if (!isSelectedCompany) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      {/* Company avatar */}
                      <div style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                        background: isSelectedCompany ? "rgba(255,102,0,0.2)" : "rgba(255,255,255,0.06)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: isSelectedCompany ? "var(--accent-primary)" : "var(--text-secondary)" }}>
                          {co.name.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {co.name}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          {co.contacts.length} contact{co.contacts.length !== 1 ? "s" : ""}
                        </div>
                      </div>

                      {/* Chevron */}
                      {co.contacts.length > 0 && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2.5" strokeLinecap="round"
                          style={{ flexShrink: 0, transition: "transform 0.15s", transform: isExpanded ? "rotate(180deg)" : "none" }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      )}
                    </button>

                    {/* Contacts sub-list */}
                    {isExpanded && co.contacts.map((contact) => {
                      const isSelectedContact = selected?.contactId === contact.id;
                      return (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => handleSelectContact(co, contact)}
                          style={{
                            width: "100%", display: "flex", alignItems: "center", gap: 10,
                            padding: "7px 12px 7px 28px",
                            background: isSelectedContact ? "rgba(255,102,0,0.08)" : "rgba(0,0,0,0.04)",
                            border: "none", cursor: "pointer", textAlign: "left",
                            borderBottom: "1px solid rgba(255,255,255,0.03)",
                            transition: "background 0.1s",
                          }}
                          onMouseOver={(e) => { if (!isSelectedContact) (e.currentTarget as HTMLElement).style.background = "rgba(255,102,0,0.04)"; }}
                          onMouseOut={(e) => { if (!isSelectedContact) (e.currentTarget as HTMLElement).style.background = isSelectedContact ? "rgba(255,102,0,0.08)" : "rgba(0,0,0,0.04)"; }}
                        >
                          {/* Contact avatar */}
                          <div style={{
                            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                            background: isSelectedContact ? "rgba(255,102,0,0.25)" : "rgba(255,255,255,0.08)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <span style={{ fontSize: 9, fontWeight: 700, color: isSelectedContact ? "var(--accent-primary)" : "var(--text-dim)" }}>
                              {contact.name.charAt(0).toUpperCase()}
                            </span>
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: isSelectedContact ? "var(--accent-primary)" : "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {contact.name}
                            </div>
                            {contact.email && (
                              <div style={{ fontSize: 11, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {contact.email}
                              </div>
                            )}
                          </div>

                          {isSelectedContact && (
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          {/* Create new */}
          {!showCreate ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 8,
                padding: "9px 12px", fontSize: 12, fontWeight: 600,
                color: "var(--accent-primary)", background: "transparent", border: "none",
                borderTop: "1px solid var(--border-subtle)", cursor: "pointer",
                transition: "background 0.1s",
              }}
              onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,102,0,0.04)")}
              onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add new company &amp; contact…
            </button>
          ) : (
            userId && (
              <InlineCreateForm
                userId={userId}
                initialCompanyName={search}
                onCreated={handleCreated}
                onCancel={() => setShowCreate(false)}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
