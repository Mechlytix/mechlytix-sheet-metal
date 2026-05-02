"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─────────────────────────────────────────────────────────
// /dashboard/customers/new
// ─────────────────────────────────────────────────────────

export default function NewCustomerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [sameAsBilling, setSameAsBilling] = useState(false);

  // Contact fields
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [taxId, setTaxId] = useState("");

  // Address fields
  const [billingAddress, setBillingAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error, data } = await supabase
      .from("customers")
      .insert({
        user_id: user.id,
        name: name.trim(),
        company_name: companyName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        tax_id: taxId.trim() || null,
        billing_address: billingAddress.trim() || null,
        shipping_address: sameAsBilling
          ? (billingAddress.trim() || null)
          : (shippingAddress.trim() || null),
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      alert("Failed to create customer: " + (error?.message ?? "unknown error"));
      setSaving(false);
      return;
    }

    router.push(`/dashboard/customers/${data.id}`);
  }

  return (
    <div className="dash-page" style={{ maxWidth: 780 }}>
      {/* Breadcrumb */}
      <div>
        <button
          onClick={() => router.back()}
          className="btn-ghost-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 16, fontSize: 13 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to Customers
        </button>
        <h1 className="dash-page-title">Add New Customer</h1>
        <p className="dash-page-subtitle">Create a client profile to link to quotes and invoices.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Contact Information ─────────────────── */}
        <div className="settings-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 16, borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,102,0,0.1)", border: "1px solid rgba(255,102,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.8" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div>
              <h2 className="settings-card-title" style={{ margin: 0 }}>Contact Information</h2>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-field" style={{ gridColumn: "1 / 2" }}>
              <label htmlFor="cust-name">
                Contact Name <span style={{ color: "var(--accent-primary)" }}>*</span>
              </label>
              <input
                id="cust-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                autoFocus
              />
            </div>
            <div className="form-field">
              <label htmlFor="cust-company">Company Name</label>
              <input
                id="cust-company"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Engineering Ltd"
              />
            </div>
            <div className="form-field">
              <label htmlFor="cust-email">Email Address</label>
              <input
                id="cust-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@acme.com"
              />
            </div>
            <div className="form-field">
              <label htmlFor="cust-phone">Phone Number</label>
              <input
                id="cust-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44 7700 000000"
              />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / 3" }}>
              <label htmlFor="cust-tax">Tax ID / VAT Number</label>
              <input
                id="cust-tax"
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="GB123456789"
                style={{ maxWidth: 320 }}
              />
              <span className="field-hint">Optional — used on invoices and PDF quotes</span>
            </div>
          </div>
        </div>

        {/* ── Billing Address ──────────────────────── */}
        <div className="settings-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 16, borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,102,0,0.1)", border: "1px solid rgba(255,102,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <h2 className="settings-card-title" style={{ margin: 0 }}>Billing Address</h2>
          </div>
          <div className="form-field">
            <label htmlFor="billing-addr">Billing Address</label>
            <textarea
              id="billing-addr"
              rows={3}
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              placeholder={"Line 1\nCity, Postcode\nCountry"}
            />
          </div>
        </div>

        {/* ── Shipping Address ─────────────────────── */}
        <div className="settings-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,102,0,0.1)", border: "1px solid rgba(255,102,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              </div>
              <h2 className="settings-card-title" style={{ margin: 0 }}>Shipping Address</h2>
            </div>
            {/* Same as billing toggle */}
            <label htmlFor="same-as-billing" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>Same as billing</span>
              <div style={{ position: "relative", display: "inline-block" }}>
                <input
                  id="same-as-billing"
                  type="checkbox"
                  checked={sameAsBilling}
                  onChange={(e) => setSameAsBilling(e.target.checked)}
                  style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                />
                <div style={{
                  width: 40, height: 22, borderRadius: 11,
                  background: sameAsBilling ? "var(--accent-primary)" : "rgba(255,255,255,0.1)",
                  border: `1px solid ${sameAsBilling ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                  transition: "background 0.2s, border-color 0.2s",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  padding: "0 3px",
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%", background: "white",
                    transition: "transform 0.2s",
                    transform: sameAsBilling ? "translateX(18px)" : "translateX(0)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }} />
                </div>
              </div>
            </label>
          </div>

          {sameAsBilling ? (
            <div style={{ padding: "12px 14px", borderRadius: 8, background: "rgba(255,102,0,0.08)", border: "1px solid rgba(255,102,0,0.2)", fontSize: 13, color: "var(--accent-primary)", display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Shipping address will match billing address
            </div>
          ) : (
            <div className="form-field">
              <label htmlFor="shipping-addr">Shipping Address</label>
              <textarea
                id="shipping-addr"
                rows={3}
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder={"Line 1\nCity, Postcode\nCountry"}
              />
            </div>
          )}
        </div>

        {/* ── Notes ────────────────────────────────── */}
        <div className="settings-card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 16, borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(255,102,0,0.1)", border: "1px solid rgba(255,102,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="1.8" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <h2 className="settings-card-title" style={{ margin: 0 }}>Internal Notes</h2>
          </div>
          <div className="form-field">
            <label htmlFor="cust-notes">Notes</label>
            <textarea
              id="cust-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, preferred contacts, special requirements…"
            />
          </div>
        </div>

        {/* ── Actions ───────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
          <button type="button" onClick={() => router.back()} className="btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="btn-primary"
          >
            {saving ? "Creating…" : "Create Customer"}
          </button>
        </div>
      </form>
    </div>
  );
}
