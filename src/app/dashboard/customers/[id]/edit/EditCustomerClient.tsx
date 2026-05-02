"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Customer {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  notes: string | null;
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

function Field({ label, id, children, hint }: { label: string; id: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)]">{label}</label>
      {children}
      {hint && <span className="text-xs text-[var(--text-tertiary)]">{hint}</span>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="pb-4 border-b border-[var(--border-subtle)]">
      <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
    </div>
  );
}

export function EditCustomerClient({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(customer.name);
  const [companyName, setCompanyName] = useState(customer.company_name ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [taxId, setTaxId] = useState(customer.tax_id ?? "");
  const [billingAddress, setBillingAddress] = useState(customer.billing_address ?? "");
  const [shippingAddress, setShippingAddress] = useState(customer.shipping_address ?? "");
  const [sameAsBilling, setSameAsBilling] = useState(
    !!customer.billing_address && customer.billing_address === customer.shipping_address
  );
  const [notes, setNotes] = useState(customer.notes ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("customers")
      .update({
        name: name.trim(),
        company_name: companyName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        tax_id: taxId.trim() || null,
        billing_address: billingAddress.trim() || null,
        shipping_address: sameAsBilling ? (billingAddress.trim() || null) : (shippingAddress.trim() || null),
        notes: notes.trim() || null,
      })
      .eq("id", customer.id);

    if (error) {
      alert("Failed to update customer: " + error.message);
      setSaving(false);
      return;
    }

    router.push(`/dashboard/customers/${customer.id}`);
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-4"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back
        </button>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Edit Customer</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{customer.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section className="space-y-5">
          <SectionHeader title="Contact Information" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Contact Name" id="name">
              <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Company Name" id="company_name">
              <Input id="company_name" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </Field>
            <Field label="Email" id="email">
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Phone" id="phone">
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Tax ID / VAT Number" id="tax_id">
              <Input id="tax_id" type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="space-y-5">
          <SectionHeader title="Billing Address" />
          <Field label="Billing Address" id="billing_address">
            <Textarea id="billing_address" rows={3} value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} placeholder="Street, City, Postcode, Country" />
          </Field>
        </section>

        <section className="space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Shipping Address</h2>
            <label htmlFor="same_as_billing" className="flex items-center gap-2 cursor-pointer select-none">
              <div className="relative">
                <input id="same_as_billing" type="checkbox" className="sr-only" checked={sameAsBilling} onChange={(e) => setSameAsBilling(e.target.checked)} />
                <div className={`w-10 h-6 rounded-full transition-colors ${sameAsBilling ? "bg-[var(--accent-primary)]" : "bg-[var(--border-subtle)]"}`} />
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${sameAsBilling ? "translate-x-5" : "translate-x-1"}`} />
              </div>
              <span className="text-sm text-[var(--text-secondary)]">Same as billing</span>
            </label>
          </div>
          {sameAsBilling ? (
            <div className="px-4 py-3 rounded-md bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-sm text-[var(--accent-primary)]">
              ✓ Shipping address will match billing address
            </div>
          ) : (
            <Field label="Shipping Address" id="shipping_address">
              <Textarea id="shipping_address" rows={3} value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="Street, City, Postcode, Country" />
            </Field>
          )}
        </section>

        <section className="space-y-5">
          <SectionHeader title="Notes" />
          <Field label="Internal Notes" id="notes">
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </section>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium rounded-md border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="px-5 py-2 text-sm font-medium rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
