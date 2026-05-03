"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CustomerSelector } from "@/components/CustomerSelector";

// ─────────────────────────────────────────────────────────
// QuoteEditPanel — Inline editable cards
// Renders Customer + Notes cards. In view mode, displays
// static values. In edit mode, fields become inputs.
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
  // Display-only values from server
  customerName?: string | null;
  customerEmail?: string | null;
  expiresDate?: string | null;
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
  customerName,
  customerEmail,
  expiresDate,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable state
  const [customerId, setCustomerId] = useState<string | null>(initialCustomerId);
  const [customerRef, setCustomerRef] = useState(initialCustomerRef ?? "");
  const [quantity, setQuantity] = useState(initialQuantity);
  const [markup, setMarkup] = useState(initialMarkup);
  const [notes, setNotes] = useState(initialNotes);
  const [expiresAt, setExpiresAt] = useState(
    initialExpiresAt ? initialExpiresAt.slice(0, 10) : ""
  );

  // Reset state when entering edit mode
  useEffect(() => {
    if (editing) {
      setCustomerId(initialCustomerId);
      setCustomerRef(initialCustomerRef ?? "");
      setQuantity(initialQuantity);
      setMarkup(initialMarkup);
      setNotes(initialNotes);
      setExpiresAt(initialExpiresAt ? initialExpiresAt.slice(0, 10) : "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("quotes")
      .update({
        customer_id:    customerId || null,
        customer_ref:   customerRef.trim() || null,
        quantity:       Math.max(1, quantity),
        markup_percent: markup,
        notes:          notes.trim() || null,
        expires_at:     expiresAt ? new Date(expiresAt).toISOString() : null,
        updated_at:     new Date().toISOString(),
      })
      .eq("id", quoteId);

    if (error) {
      alert("Failed to save: " + error.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <>
      {/* ── Customer Card ── */}
      <div className={`qd-section-card ${editing ? "qd-editing" : ""}`}>
        <div className="qd-card-header">
          <h3 className="qd-section-title">Customer</h3>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="qd-edit-trigger"
              title="Edit quote details"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="qd-edit-fields">
            <div className="form-field">
              <label>Customer</label>
              <CustomerSelector
                userId={userId}
                value={customerId}
                onChange={(id) => setCustomerId(id)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="qe-ref">Reference / PO Number</label>
              <input
                id="qe-ref"
                type="text"
                value={customerRef}
                onChange={(e) => setCustomerRef(e.target.value)}
                placeholder="e.g. PO-2024-0081"
              />
            </div>
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
          </div>
        ) : (
          <div className="qd-detail-list">
            <div className="qd-detail-row">
              <span className="qd-dl-label">Name</span>
              <span className="qd-dl-value">{customerName ?? "\u2014"}</span>
            </div>
            <div className="qd-detail-row">
              <span className="qd-dl-label">Email</span>
              <span className="qd-dl-value">
                {customerEmail
                  ? <a href={`mailto:${customerEmail}`} className="qd-email-link">{customerEmail}</a>
                  : "\u2014"}
              </span>
            </div>
            <div className="qd-detail-row">
              <span className="qd-dl-label">Reference</span>
              <span className="qd-dl-value">{initialCustomerRef ?? "\u2014"}</span>
            </div>
            <div className="qd-detail-row">
              <span className="qd-dl-label">Quantity</span>
              <span className="qd-dl-value">{initialQuantity}</span>
            </div>
            {expiresDate && (
              <div className="qd-detail-row">
                <span className="qd-dl-label">Expires</span>
                <span className="qd-dl-value">{expiresDate}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Notes Card ── */}
      <div className={`qd-section-card ${editing ? "qd-editing" : ""}`}>
        <h3 className="qd-section-title">Notes</h3>
        {editing ? (
          <div className="qd-edit-fields">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Material spec, delivery requirements, revision notes..."
              className="qd-notes-textarea"
            />
          </div>
        ) : (
          <p className="qd-notes-text">{initialNotes || "\u2014 No notes"}</p>
        )}
      </div>

      {/* ── Save / Cancel bar ── */}
      {editing && (
        <div className="qd-edit-actions">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? "Saving\u2026" : "Save Changes"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="btn-ghost"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
