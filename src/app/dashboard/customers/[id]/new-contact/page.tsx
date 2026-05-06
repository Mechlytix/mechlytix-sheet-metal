"use client";

import React, { useState, use } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─────────────────────────────────────────────────────────
// /dashboard/customers/[id]/new-contact
// ─────────────────────────────────────────────────────────

interface Props { params: Promise<{ id: string }> }

export default function NewContactPage({ params }: Props) {
  const { id: companyId } = use(params);
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Contact fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { error } = await supabase
      .from("customers")
      .insert({
        user_id: user.id,
        company_id: companyId,
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
      });

    if (error) {
      alert("Failed to create contact: " + error.message);
      setSaving(false);
      return;
    }

    router.push(`/dashboard/customers/${companyId}`);
    router.refresh();
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
          Back to Company
        </button>
        <h1 className="dash-page-title">Add Contact</h1>
        <p className="dash-page-subtitle">Add a new person to this company.</p>
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
              <h2 className="settings-card-title" style={{ margin: 0 }}>Contact Details</h2>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="contact-name">
                Full Name <span style={{ color: "var(--accent-primary)" }}>*</span>
              </label>
              <input
                id="contact-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                autoFocus
              />
            </div>
            <div className="form-field">
              <label htmlFor="contact-email">Email Address</label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
              />
            </div>
            <div className="form-field">
              <label htmlFor="contact-phone">Phone Number</label>
              <input
                id="contact-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44 7700 000000"
              />
            </div>
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
            {saving ? "Adding…" : "Add Contact"}
          </button>
        </div>
      </form>
    </div>
  );
}
