"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CustomerSelector } from "@/components/CustomerSelector";

// ─────────────────────────────────────────────────────────
// QuoteEditPanel
// Inline edit panel for the right-column of the quote detail.
// Editable fields: customer, quantity, markup %, notes,
//                  customer_ref, expires_at
// ─────────────────────────────────────────────────────────

interface Props {
  quoteId: string;
  userId: string;
  initialCustomerId: string | null;
  initialCustomerRef: string | null;
  initialQuantity: number;
  initialMarkup: number;
  initialNotes: string;
  initialExpiresAt: string | null;
}

export function QuoteEditPanel({
  quoteId,
  userId,
  initialCustomerId,
  initialCustomerRef,
  initialQuantity,
  initialMarkup,
  initialNotes,
  initialExpiresAt,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable state
  const [customerId, setCustomerId] = useState<string | null>(initialCustomerId);
  const [customerRef, setCustomerRef] = useState(initialCustomerRef ?? "");
  const [quantity, setQuantity] = useState(initialQuantity);
  const [markup, setMarkup] = useState(initialMarkup);
  const [notes, setNotes] = useState(initialNotes);
  const [expiresAt, setExpiresAt] = useState(
    initialExpiresAt ? initialExpiresAt.slice(0, 10) : "" // yyyy-mm-dd
  );

  // Reset when opening
  useEffect(() => {
    if (open) {
      setCustomerId(initialCustomerId);
      setCustomerRef(initialCustomerRef ?? "");
      setQuantity(initialQuantity);
      setMarkup(initialMarkup);
      setNotes(initialNotes);
      setExpiresAt(initialExpiresAt ? initialExpiresAt.slice(0, 10) : "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("quotes")
      .update({
        customer_id:   customerId || null,
        customer_ref:  customerRef.trim() || null,
        quantity:      Math.max(1, quantity),
        markup_percent: markup,
        notes:         notes.trim() || null,
        expires_at:    expiresAt ? new Date(expiresAt).toISOString() : null,
        updated_at:    new Date().toISOString(),
      })
      .eq("id", quoteId);

    if (error) {
      alert("Failed to save: " + error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost"
        style={{ fontSize: 13 }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Edit Quote
      </button>
    );
  }

  return (
    <div
      className="qd-section-card"
      style={{
        border: "1px solid var(--border-active)",
        boxShadow: "0 0 20px rgba(255,102,0,0.08)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 className="qd-section-title" style={{ margin: 0 }}>Edit Quote</h3>
        <button
          onClick={() => setOpen(false)}
          className="icon-btn"
          title="Cancel"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Customer selector */}
        <div className="form-field">
          <label>Customer</label>
          <CustomerSelector
            userId={userId}
            value={customerId}
            onChange={(id) => setCustomerId(id)}
          />
        </div>

        {/* Customer reference */}
        <div className="form-field">
          <label htmlFor="qe-ref">Customer Reference / PO Number</label>
          <input
            id="qe-ref"
            type="text"
            value={customerRef}
            onChange={(e) => setCustomerRef(e.target.value)}
            placeholder="e.g. PO-2024-0081"
          />
        </div>

        {/* Quantity + Markup in a row */}
        <div className="form-row-2">
          <div className="form-field">
            <label htmlFor="qe-qty">Quantity</label>
            <input
              id="qe-qty"
              type="number"
              min={1}
              max={10000}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div className="form-field">
            <label htmlFor="qe-markup">Markup (%)</label>
            <input
              id="qe-markup"
              type="number"
              min={0}
              max={200}
              step={1}
              value={markup}
              onChange={(e) => setMarkup(Math.max(0, parseFloat(e.target.value) || 0))}
            />
          </div>
        </div>

        {/* Expiry date */}
        <div className="form-field">
          <label htmlFor="qe-expires">Expiry Date</label>
          <input
            id="qe-expires"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
          <span className="field-hint">Leave blank for no expiry</span>
        </div>

        {/* Notes */}
        <div className="form-field">
          <label htmlFor="qe-notes">Notes</label>
          <textarea
            id="qe-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Material spec, delivery requirements, revision notes…"
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ flex: 1 }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="btn-ghost"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
