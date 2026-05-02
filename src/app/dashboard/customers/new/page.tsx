"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ─── Field helper ─────────────────────────────────────────

function Field({
  label,
  id,
  required,
  children,
  hint,
}: {
  label: string;
  id: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)]">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <span className="text-xs text-[var(--text-tertiary)]">{hint}</span>}
    </div>
  );
}

function Input({ id, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  return (
    <input
      id={id}
      {...props}
      className="px-3 py-2 text-sm rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-shadow"
    />
  );
}

function Textarea({ id, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string }) {
  return (
    <textarea
      id={id}
      {...props}
      className="px-3 py-2 text-sm rounded-md bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent transition-shadow resize-none"
    />
  );
}

// ─── Address Block ────────────────────────────────────────

interface AddressBlockProps {
  prefix: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function AddressBlock({ prefix, label, value, onChange }: AddressBlockProps) {
  return (
    <Field label={label} id={`${prefix}_address`}>
      <Textarea
        id={`${prefix}_address`}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Street, City, Postcode, Country`}
      />
    </Field>
  );
}

// ─── Section heading ──────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="pb-4 border-b border-[var(--border-subtle)]">
      <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
      {description && <p className="text-sm text-[var(--text-secondary)] mt-0.5">{description}</p>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────

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
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-4"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to Customers
        </button>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Add New Customer</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Create a customer profile to link to quotes.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Contact Information */}
        <section className="space-y-5">
          <SectionHeader title="Contact Information" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Contact Name" id="name" required>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                autoFocus
              />
            </Field>
            <Field label="Company Name" id="company_name">
              <Input
                id="company_name"
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Engineering Ltd"
              />
            </Field>
            <Field label="Email Address" id="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@acme.com"
              />
            </Field>
            <Field label="Phone Number" id="phone">
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44 7700 000000"
              />
            </Field>
            <Field label="Tax ID / VAT Number" id="tax_id" hint="Optional — for invoice and PDF generation">
              <Input
                id="tax_id"
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder="GB123456789"
              />
            </Field>
          </div>
        </section>

        {/* Billing Address */}
        <section className="space-y-5">
          <SectionHeader title="Billing Address" />
          <AddressBlock
            prefix="billing"
            label="Billing Address"
            value={billingAddress}
            onChange={setBillingAddress}
          />
        </section>

        {/* Shipping Address */}
        <section className="space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">Shipping Address</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">Where parts should be delivered</p>
            </div>
            {/* Same as billing toggle */}
            <label htmlFor="same_as_billing" className="flex items-center gap-2 cursor-pointer select-none group">
              <div className="relative">
                <input
                  id="same_as_billing"
                  type="checkbox"
                  className="sr-only"
                  checked={sameAsBilling}
                  onChange={(e) => setSameAsBilling(e.target.checked)}
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${sameAsBilling ? "bg-[var(--accent-primary)]" : "bg-[var(--border-subtle)]"}`} />
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${sameAsBilling ? "translate-x-5" : "translate-x-1"}`} />
              </div>
              <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                Same as billing
              </span>
            </label>
          </div>

          {sameAsBilling ? (
            <div className="px-4 py-3 rounded-md bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-sm text-[var(--accent-primary)]">
              ✓ Shipping address will match billing address
            </div>
          ) : (
            <AddressBlock
              prefix="shipping"
              label="Shipping Address"
              value={shippingAddress}
              onChange={setShippingAddress}
            />
          )}
        </section>

        {/* Notes */}
        <section className="space-y-5">
          <SectionHeader title="Notes" description="Any additional information about this customer" />
          <Field label="Internal Notes" id="notes">
            <Textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Payment terms, preferred contacts, special requirements…"
            />
          </Field>
        </section>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-tertiary)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="px-5 py-2 text-sm font-medium rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Creating…" : "Create Customer"}
          </button>
        </div>
      </form>
    </div>
  );
}
