"use client";

import { useState } from "react";
import Link from "next/link";
import ScrollReveal from "@/components/marketing/ScrollReveal";

// ─────────────────────────────────────────────────────────
// Pricing Page — Tier cards + waitlist + FAQ
// ─────────────────────────────────────────────────────────

const TIERS = [
  {
    name: "Free",
    price: "£0",
    period: "forever",
    desc: "Perfect for trying things out",
    features: [
      "5 quotes per month",
      "STEP & DXF import",
      "3D visualization",
      "1 material preset",
      "Community support",
    ],
    cta: "Get Started",
    href: "/login",
    highlight: false,
  },
  {
    name: "Pro",
    price: "£29",
    period: "/month",
    desc: "For active fabrication shops",
    features: [
      "Unlimited quotes",
      "Full material library",
      "Scrap rack tracker",
      "Machine profiles",
      "PDF quote exports",
      "Priority support",
    ],
    cta: "Join Waitlist",
    href: "#waitlist",
    highlight: true,
    badge: "Coming Soon",
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    desc: "For multi-site operations",
    features: [
      "Everything in Pro",
      "API access",
      "SSO / SAML",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    href: "/contact",
    highlight: false,
  },
];

const FAQ = [
  {
    q: "Is there really a free tier?",
    a: "Yes. The Free plan lets you upload files, visualise parts in 3D, and generate up to 5 quotes per month — no credit card required.",
  },
  {
    q: "When will Pro be available?",
    a: "We're currently in early access. Join the waitlist and you'll be the first to know when Pro launches, plus get a founding member discount.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Absolutely. There are no long-term contracts. Cancel your Pro subscription at any time and you'll retain access until the end of your billing period.",
  },
  {
    q: "Do you process files on your servers?",
    a: "No. All geometry processing happens in your browser using OpenCASCADE compiled to WebAssembly. Your files never leave your machine.",
  },
  {
    q: "What file formats do you support?",
    a: "We currently support STEP (.stp, .step) and DXF (.dxf) files. IGES and native CAD formats are on the roadmap.",
  },
  {
    q: "Is my data secure?",
    a: "All data is stored in Supabase with Row Level Security. Your quotes, materials, and files are only accessible to your account.",
  },
];

export default function PricingClient() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaitlistError("");
    try {
      const res = await fetch("/pricing/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail }),
      });
      if (!res.ok) throw new Error("failed");
      setWaitlistSubmitted(true);
    } catch {
      setWaitlistError("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="mkt-page">
      {/* Hero */}
      <section className="mkt-page-hero">
        <ScrollReveal className="mkt-section-header">
          <span className="mkt-section-tag">Pricing</span>
          <h1 className="mkt-h1" style={{ fontSize: "clamp(32px, 5vw, 52px)" }}>
            Simple, Transparent
            <br />
            <span className="mkt-h1-accent">Pricing</span>
          </h1>
          <p className="mkt-section-sub" style={{ maxWidth: 520 }}>
            Start free. Upgrade when you&apos;re ready. No surprises.
          </p>
        </ScrollReveal>
      </section>

      {/* Tier Cards */}
      <section className="mkt-pricing-grid-wrap">
        <div className="mkt-pricing-grid">
          {TIERS.map((t, i) => (
            <ScrollReveal key={t.name} delay={i * 0.1} className={`mkt-tier-card${t.highlight ? " mkt-tier-card--highlight" : ""}`}>
              {t.badge && <span className="mkt-tier-badge">{t.badge}</span>}
              <h3 className="mkt-tier-name">{t.name}</h3>
              <div className="mkt-tier-price">
                <span className="mkt-tier-amount">{t.price}</span>
                <span className="mkt-tier-period">{t.period}</span>
              </div>
              <p className="mkt-tier-desc">{t.desc}</p>
              <ul className="mkt-tier-features">
                {t.features.map((f) => (
                  <li key={f}>
                    <span className="mkt-bullet-check">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              {t.href === "#waitlist" ? (
                <button
                  className="mkt-cta-primary"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => {
                    document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {t.cta}
                </button>
              ) : (
                <Link
                  href={t.href}
                  className={t.highlight ? "mkt-cta-primary" : "mkt-cta-secondary"}
                  style={{ width: "100%", justifyContent: "center", textAlign: "center" }}
                >
                  {t.cta}
                </Link>
              )}
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Waitlist */}
      <section className="mkt-waitlist-section" id="waitlist">
        <ScrollReveal className="mkt-waitlist-card">
          <h2 className="mkt-h2" style={{ fontSize: 24 }}>Join the Waitlist</h2>
          <p className="mkt-section-sub" style={{ marginBottom: 24 }}>
            Be the first to access Pro features and get a founding member discount.
          </p>
          {waitlistSubmitted ? (
            <div className="mkt-waitlist-success">
              <span>🎉</span>
              <p>You&apos;re on the list! We&apos;ll be in touch soon.</p>
            </div>
          ) : (
            <>
              <form className="mkt-waitlist-form" onSubmit={handleWaitlist}>
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  className="mkt-waitlist-input"
                  id="waitlist-email"
                />
                <button type="submit" className="mkt-cta-primary" id="waitlist-submit">
                  Join Waitlist
                </button>
              </form>
              {waitlistError && (
                <p style={{ marginTop: 10, fontSize: 13, color: "#f87171" }}>{waitlistError}</p>
              )}
            </>
          )}
        </ScrollReveal>
      </section>

      {/* FAQ */}
      <section className="mkt-faq-section">
        <ScrollReveal className="mkt-section-header">
          <span className="mkt-section-tag">FAQ</span>
          <h2 className="mkt-h2">Frequently Asked Questions</h2>
        </ScrollReveal>

        <div className="mkt-faq-list">
          {FAQ.map((item, i) => (
            <ScrollReveal key={i} delay={i * 0.05} className="mkt-faq-item">
              <button
                className={`mkt-faq-question${openFaq === i ? " open" : ""}`}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                id={`faq-${i}`}
              >
                <span>{item.q}</span>
                <svg
                  width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2"
                  className="mkt-faq-chevron"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div className={`mkt-faq-answer${openFaq === i ? " open" : ""}`}>
                <p>{item.a}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>
    </div>
  );
}
