"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Customer {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
}

interface Props {
  userId: string | null;
  value: string | null;            // selected customer_id
  onChange: (customerId: string | null, customer: Customer | null) => void;
}

// ─── Inline Create Form ───────────────────────────────────

interface CreateFormProps {
  userId: string;
  initialName: string;
  onCreated: (customer: Customer) => void;
  onCancel: () => void;
}

function InlineCreateForm({ userId, initialName, onCreated, onCancel }: CreateFormProps) {
  const [name, setName] = useState(initialName);
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("customers")
      .insert({
        user_id: userId,
        name: name.trim(),
        company_name: company.trim() || null,
        email: email.trim() || null,
      })
      .select("id, name, company_name, email")
      .single();

    if (error || !data) {
      alert("Failed to create customer: " + (error?.message ?? "unknown"));
      setSaving(false);
      return;
    }
    onCreated(data as Customer);
  }

  return (
    <form onSubmit={handleCreate} className="p-3 border-t border-[var(--border-subtle)] space-y-2">
      <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">New Customer</p>
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Contact name *"
        required
        className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
      />
      <input
        type="text"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder="Company name"
        className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        className="w-full px-3 py-2 text-sm rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
      />
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 py-1.5 text-xs font-medium rounded-md bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create & Select"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Main Selector ────────────────────────────────────────

export function CustomerSelector({ userId, value, onChange }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load customers once userId is available
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    supabase
      .from("customers")
      .select("id, name, company_name, email")
      .order("name")
      .then(({ data }) => setCustomers(data ?? []));
  }, [userId]);

  // Sync selected display when value changes externally
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    const found = customers.find((c) => c.id === value);
    if (found) setSelected(found);
  }, [value, customers]);

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

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.company_name?.toLowerCase().includes(q) ?? false) ||
      (c.email?.toLowerCase().includes(q) ?? false)
    );
  });

  function handleSelect(customer: Customer) {
    setSelected(customer);
    onChange(customer.id, customer);
    setOpen(false);
    setSearch("");
    setShowCreate(false);
  }

  function handleClear() {
    setSelected(null);
    onChange(null, null);
  }

  const handleCreated = useCallback((customer: Customer) => {
    setCustomers((prev) => [...prev, customer].sort((a, b) => a.name.localeCompare(b.name)));
    handleSelect(customer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(!open); setShowCreate(false); setSearch(""); }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md border transition-all text-left ${
          open
            ? "border-[var(--accent-primary)] shadow-[0_0_0_1px_var(--accent-primary)] bg-[var(--bg-primary)]"
            : "border-[var(--border-subtle)] bg-[var(--bg-primary)] hover:border-[var(--text-tertiary)]"
        }`}
      >
        <span className={selected ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]"}>
          {selected ? (
            <span>
              {selected.name}
              {selected.company_name && (
                <span className="text-[var(--text-tertiary)] ml-1.5">— {selected.company_name}</span>
              )}
            </span>
          ) : "Select customer…"}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); handleClear(); } }}
              className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              ×
            </span>
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`text-[var(--text-tertiary)] transition-transform ${open ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-xl overflow-hidden pb-1">
          {/* Search */}
          <div className="p-2 border-b border-[var(--border-subtle)]">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowCreate(false); }}
                placeholder="Search customers…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && !showCreate ? (
              <div className="px-3 py-3 text-sm text-[var(--text-tertiary)] text-center">
                {search ? `No customers match "${search}"` : "No customers yet"}
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelect(c)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-tertiary)] transition-colors ${
                    selected?.id === c.id ? "bg-[var(--accent-primary)]/10" : ""
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-[var(--accent-primary)]">{c.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">{c.name}</div>
                    {(c.company_name || c.email) && (
                      <div className="text-xs text-[var(--text-tertiary)] truncate">
                        {c.company_name ?? c.email}
                      </div>
                    )}
                  </div>
                  {selected?.id === c.id && (
                    <svg className="ml-auto shrink-0 text-[var(--accent-primary)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Create new */}
          {!showCreate ? (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)] transition-colors border-t border-[var(--border-subtle)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Create new customer…
            </button>
          ) : (
            userId && (
              <InlineCreateForm
                userId={userId}
                initialName={search}
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
