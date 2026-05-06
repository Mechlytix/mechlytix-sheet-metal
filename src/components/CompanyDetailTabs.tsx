"use client";

import React, { useState } from "react";
import Link from "next/link";

function StatusBadge({ status }: { status: string }) {
  const STATUS_CLASSES: Record<string, string> = {
    draft: "status-badge badge-neutral",
    sent: "status-badge badge-blue",
    accepted: "status-badge badge-green",
    declined: "status-badge badge-red",
    expired: "status-badge badge-red",
  };
  return (
    <span className={STATUS_CLASSES[status] ?? STATUS_CLASSES.draft} style={{ textTransform: "capitalize" }}>
      {status ?? "draft"}
    </span>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{children}</span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function CompanyDetailTabs({ company, contacts, quotes }: { company: any, contacts: any[], quotes: any[] }) {
  const [activeTab, setActiveTab] = useState<"info" | "contacts" | "quotes">("info");

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 24, borderBottom: "1px solid var(--border-subtle)", marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab("info")}
          style={{
            padding: "0 4px 12px",
            background: "none",
            border: "none",
            borderBottom: `2px solid ${activeTab === "info" ? "var(--accent-primary)" : "transparent"}`,
            color: activeTab === "info" ? "var(--accent-primary)" : "var(--text-dim)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          Company Info
        </button>
        <button
          onClick={() => setActiveTab("contacts")}
          style={{
            padding: "0 4px 12px",
            background: "none",
            border: "none",
            borderBottom: `2px solid ${activeTab === "contacts" ? "var(--accent-primary)" : "transparent"}`,
            color: activeTab === "contacts" ? "var(--accent-primary)" : "var(--text-dim)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          Contacts ({contacts.length})
        </button>
        <button
          onClick={() => setActiveTab("quotes")}
          style={{
            padding: "0 4px 12px",
            background: "none",
            border: "none",
            borderBottom: `2px solid ${activeTab === "quotes" ? "var(--accent-primary)" : "transparent"}`,
            color: activeTab === "quotes" ? "var(--accent-primary)" : "var(--text-dim)",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          Quote History ({quotes.length})
        </button>
      </div>

      {/* Info Tab */}
      {activeTab === "info" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
          
          <div className="settings-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Company Details</h2>
            </div>
            <div style={{ padding: "0 18px 8px" }}>
              <InfoRow label="Company Name">{company.name}</InfoRow>
              {company.tax_id ? <InfoRow label="Tax ID / VAT">{company.tax_id}</InfoRow> : null}
              <InfoRow label="Customer Since">
                {company.created_at ? new Date(company.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
              </InfoRow>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {(company.billing_address || company.shipping_address) ? (
              <div className="settings-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Addresses</h2>
                </div>
                <div style={{ padding: "0 18px 8px" }}>
                  {company.billing_address && (
                    <InfoRow label="Billing">
                      <span style={{ whiteSpace: "pre-line", lineHeight: 1.6 }}>{company.billing_address}</span>
                    </InfoRow>
                  )}
                  {company.shipping_address && company.shipping_address !== company.billing_address && (
                    <InfoRow label="Shipping">
                      <span style={{ whiteSpace: "pre-line", lineHeight: 1.6 }}>{company.shipping_address}</span>
                    </InfoRow>
                  )}
                  {company.shipping_address === company.billing_address && company.billing_address && (
                    <InfoRow label="Shipping">
                      <span style={{ color: "var(--text-dim)", fontStyle: "italic", fontSize: 12 }}>Same as billing</span>
                    </InfoRow>
                  )}
                </div>
              </div>
            ) : (
               <div className="settings-card" style={{ padding: 20, textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
                 No addresses provided.
               </div>
            )}

            {company.notes && (
              <div className="settings-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Notes</h2>
                </div>
                <p style={{ margin: 0, padding: "14px 18px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-line" }}>{company.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contacts Tab */}
      {activeTab === "contacts" && (
        <div className="table-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Associated Contacts</h2>
            <Link href={`/dashboard/customers/${company.id}/new-contact`} className="btn-primary" style={{ fontSize: 12, padding: "4px 12px" }}>
              + Add Contact
            </Link>
          </div>

          {contacts.length === 0 ? (
            <div style={{ padding: "48px 32px", textAlign: "center", color: "var(--text-dim)", fontSize: 13 }}>
              No contacts associated with this company yet.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>{c.name}</td>
                    <td className="td-muted">{c.email || "—"}</td>
                    <td className="td-muted">{c.phone || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Quotes Tab */}
      {activeTab === "quotes" && (
        <div className="table-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Quote History</h2>
            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{quotes.length} total</span>
          </div>

          {quotes.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 32px", textAlign: "center", gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>No quotes yet</p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)" }}>Quotes saved in the Quoter will appear here once linked to this company.</p>
              </div>
              <Link href="/dashboard/quoter" className="btn-primary" style={{ marginTop: 4 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Create a Quote
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Part File</th>
                    <th>Status</th>
                    <th>Unit Price</th>
                    <th>Qty</th>
                    <th>Total</th>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.map((q) => (
                    <tr key={q.id}>
                      <td>
                        <div style={{ fontWeight: 500, color: "var(--text-primary)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
                          {q.filename}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, display: "flex", gap: 6 }}>
                          <span className="input-type-badge">{q.input_type}</span>
                          {q.thickness_mm ? <span>{q.thickness_mm}mm</span> : null}
                          {q.bend_count > 0 ? <span>{q.bend_count} bend{q.bend_count > 1 ? "s" : ""}</span> : null}
                        </div>
                      </td>
                      <td><StatusBadge status={q.status ?? "draft"} /></td>
                      <td className="td-price">{q.unit_price != null ? `£${Number(q.unit_price).toFixed(2)}` : "—"}</td>
                      <td className="td-muted">{q.quantity ?? 1}</td>
                      <td className="td-price">{q.total_price != null ? `£${Number(q.total_price).toFixed(2)}` : "—"}</td>
                      <td className="td-date">
                        {q.created_at ? new Date(q.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link href={`/dashboard/quotes/${q.id}`} className="btn-ghost-sm">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
