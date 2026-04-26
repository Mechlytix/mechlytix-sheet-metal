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
      const { error } = await supabase
        .from("quotes")
        .update({ status: action.newStatus })
        .eq("id", quoteId);
      if (!error) {
        setStatus(action.newStatus);
        router.refresh();
      }
    });
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
