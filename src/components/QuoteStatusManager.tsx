"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────
// Quote Status Manager — client island for status transitions
// ─────────────────────────────────────────────────────────

type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

interface Action {
  label: string;
  newStatus: QuoteStatus;
  variant: "primary" | "ghost" | "danger" | "success";
  icon: string;
}

const TRANSITIONS: Record<QuoteStatus, Action[]> = {
  draft: [
    { label: "Mark as Sent", newStatus: "sent",     variant: "primary",  icon: "📤" },
    { label: "Expire",        newStatus: "expired",  variant: "ghost",    icon: "⏱" },
  ],
  sent: [
    { label: "Accepted",     newStatus: "accepted", variant: "success",  icon: "✓" },
    { label: "Rejected",     newStatus: "rejected", variant: "danger",   icon: "✕" },
    { label: "Expired",      newStatus: "expired",  variant: "ghost",    icon: "⏱" },
  ],
  accepted: [
    { label: "Re-open Draft",newStatus: "draft",    variant: "ghost",    icon: "↩" },
  ],
  rejected: [
    { label: "Re-open Draft",newStatus: "draft",    variant: "ghost",    icon: "↩" },
  ],
  expired: [
    { label: "Re-open Draft",newStatus: "draft",    variant: "ghost",    icon: "↩" },
  ],
};

export function QuoteStatusManager({
  quoteId,
  currentStatus,
  customerEmail,
  customerName,
}: {
  quoteId: string;
  currentStatus: QuoteStatus;
  customerEmail?: string | null;
  customerName?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  async function handleAction(action: Action) {
    const supabase = createClient();
    startTransition(async () => {
      // 1. Update quote status
      const { error } = await supabase
        .from("quotes")
        .update({ status: action.newStatus })
        .eq("id", quoteId);
      
      if (!error) {
        // 2. Perform remnant lifecycle automation
        if (action.newStatus === "accepted") {
          try {
            await reserveRemnantsForQuote(quoteId, supabase);
          } catch (e) {
            console.error("Failed to auto-reserve remnants:", e);
          }
        } else if (action.newStatus === "draft") {
          try {
            await releaseRemnantsForQuote(quoteId, supabase);
          } catch (e) {
            console.error("Failed to release remnants:", e);
          }
        }

        setStatus(action.newStatus);
        router.refresh();
      }
    });
  }

  async function reserveRemnantsForQuote(qId: string, client: any) {
    const { data: quote } = await client
      .from("quotes")
      .select("user_id, material_id, thickness_mm, bounding_width_mm, bounding_height_mm, quote_number")
      .eq("id", qId)
      .single();

    if (!quote || !quote.material_id || !quote.thickness_mm) return;

    const qw = parseFloat(quote.bounding_width_mm || 0);
    const qh = parseFloat(quote.bounding_height_mm || 0);
    if (qw <= 0 || qh <= 0) return;

    const { data: rems } = await client
      .from("remnants")
      .select("id, width_mm, height_mm, notes")
      .eq("user_id", quote.user_id)
      .eq("material_id", quote.material_id)
      .eq("thickness_mm", quote.thickness_mm)
      .eq("status", "available");

    if (!rems || rems.length === 0) return;

    const quoteRef = quote.quote_number || qId.substring(0, 8);

    for (const rem of rems) {
      const rw = parseFloat(rem.width_mm);
      const rh = parseFloat(rem.height_mm);

      const fitsDirect = rw >= qw && rh >= qh;
      const fitsRotated = rw >= qh && rh >= qw;

      if (fitsDirect || fitsRotated) {
        const newNotes = rem.notes
          ? `${rem.notes.trim()}\nReserved for Quote #${quoteRef}`
          : `Reserved for Quote #${quoteRef}`;

        await client
          .from("remnants")
          .update({
            status: "reserved",
            notes: newNotes,
          })
          .eq("id", rem.id);
      }
    }
  }

  async function releaseRemnantsForQuote(qId: string, client: any) {
    const { data: quote } = await client
      .from("quotes")
      .select("quote_number")
      .eq("id", qId)
      .single();

    const quoteRef = quote?.quote_number || qId.substring(0, 8);

    const { data: rems } = await client
      .from("remnants")
      .select("id, notes")
      .eq("status", "reserved");

    if (!rems || rems.length === 0) return;

    for (const rem of rems) {
      if (rem.notes && rem.notes.includes(`Reserved for Quote #${quoteRef}`)) {
        const cleanNotes = rem.notes
          .replace(`Reserved for Quote #${quoteRef}`, "")
          .replace(/\n\n+/g, "\n")
          .trim();

        await client
          .from("remnants")
          .update({
            status: "available",
            notes: cleanNotes || null,
          })
          .eq("id", rem.id);
      }
    }
  }

  const actions = TRANSITIONS[status] ?? [];
  const statusConfig: Record<QuoteStatus, { label: string; cls: string }> = {
    draft:    { label: "Draft",    cls: "badge-neutral" },
    sent:     { label: "Sent",     cls: "badge-blue" },
    accepted: { label: "Accepted", cls: "badge-green" },
    rejected: { label: "Rejected", cls: "badge-red" },
    expired:  { label: "Expired",  cls: "badge-neutral" },
  };

  return (
    <div className="qd-status-manager">
      <div className="qd-status-row">
        <span className="qd-status-label">Status</span>
        <span className={`status-badge ${statusConfig[status].cls}`}>
          {statusConfig[status].label}
        </span>
      </div>

      {actions.length > 0 && (
        <div className="qd-actions">
          {actions.map((action) => (
            <button
              key={action.newStatus}
              className={`qd-action-btn ${action.variant}`}
              disabled={isPending}
              onClick={() => handleAction(action)}
            >
              {action.icon} {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Quick note for sent status */}
      {status === "draft" && customerEmail && (
        <div className="qd-send-hint">
          <p>
            Customer: <strong>{customerName ?? customerEmail}</strong><br />
            <a href={`mailto:${customerEmail}`} className="qd-email-link">
              {customerEmail}
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
