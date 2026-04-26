"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

// ─────────────────────────────────────────────────────────
// QuoteShareButton — generates a shareable link for a quote
// Allows toggling share on/off and copying the link
// ─────────────────────────────────────────────────────────

interface Props {
  quoteId: string;
  shareToken: string | null;
  shareEnabled: boolean;
}

export function QuoteShareButton({ quoteId, shareToken: initialToken, shareEnabled: initialEnabled }: Props) {
  const [token, setToken]       = useState(initialToken);
  const [enabled, setEnabled]   = useState(initialEnabled);
  const [copied, setCopied]     = useState(false);
  const [isPending, startTransition] = useTransition();

  const shareUrl = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/q/${token}`
    : null;

  async function enableShare() {
    const supabase = createClient();
    startTransition(async () => {
      // Generate token server-side via a DB-generated UUID
      const newToken = crypto.randomUUID();
      const { error } = await supabase
        .from("quotes")
        .update({ share_token: newToken, share_enabled: true })
        .eq("id", quoteId);
      if (!error) {
        setToken(newToken);
        setEnabled(true);
      }
    });
  }

  async function disableShare() {
    const supabase = createClient();
    startTransition(async () => {
      const { error } = await supabase
        .from("quotes")
        .update({ share_enabled: false })
        .eq("id", quoteId);
      if (!error) setEnabled(false);
    });
  }

  async function copyLink() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!enabled) {
    return (
      <div className="qshare-container">
        <p className="qshare-desc">
          Generate a link to share this quote with your customer — no login required.
        </p>
        <button className="btn-ghost qshare-btn" disabled={isPending} onClick={enableShare}>
          {isPending ? "Generating…" : "🔗 Generate Share Link"}
        </button>
      </div>
    );
  }

  return (
    <div className="qshare-container">
      <p className="qshare-desc qshare-active-desc">Share link is active</p>
      <div className="qshare-url-row">
        <input
          readOnly
          className="qshare-url-input"
          value={shareUrl ?? ""}
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button className={`qshare-copy-btn ${copied ? "copied" : ""}`} onClick={copyLink}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <div className="qshare-actions">
        <a
          href={shareUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost qshare-preview"
        >
          Preview ↗
        </a>
        <button className="qshare-revoke" onClick={disableShare} disabled={isPending}>
          Revoke link
        </button>
      </div>
    </div>
  );
}
