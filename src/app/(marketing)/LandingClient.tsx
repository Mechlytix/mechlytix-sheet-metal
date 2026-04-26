"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import ScrollReveal from "@/components/marketing/ScrollReveal";
import AnimatedCounter from "@/components/marketing/AnimatedCounter";

const HeroScene = dynamic(
  () => import("@/components/marketing/HeroScene"),
  { ssr: false }
);

// ─────────────────────────────────────────────────────────
// Icons as inline SVGs (avoids any icon library dependency)
// ─────────────────────────────────────────────────────────
const ICONS = {
  cube: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  unfold: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  upload: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  grid: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  shield: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  globe: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  calculator: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="10" y2="10" /><line x1="14" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="10" y2="14" /><line x1="14" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="10" y2="18" /><line x1="14" y1="18" x2="16" y2="18" />
    </svg>
  ),
  recycle: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5" />
      <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12" />
      <path d="m14 16-3 3 3 3" /><path d="M8.293 13.596 7.196 9.5 3.1 10.598" />
      <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 12.013 3a1.784 1.784 0 0 1 1.575.887l3.974 6.878" />
      <path d="m20.9 13.4-4.096 1.098 1.097 4.096" />
    </svg>
  ),
  arrow: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: ICONS.cube,
    title: "3D Visualization",
    desc: "Interactive Three.js viewport with real-time rendering, material presets, and orbital camera controls.",
  },
  {
    icon: ICONS.unfold,
    title: "Animated Unfold",
    desc: "Watch bends unfold in real time with configurable speed, k-factor, and material property adjustments.",
  },
  {
    icon: ICONS.upload,
    title: "STEP & DXF Import",
    desc: "Upload industry-standard STEP and DXF files. Geometry processed entirely in-browser via OpenCASCADE WASM.",
  },
  {
    icon: ICONS.calculator,
    title: "Instant Quoting",
    desc: "Automated cost breakdown: material, cutting, bending, setup. Send professional quotes to clients in seconds.",
  },
  {
    icon: ICONS.recycle,
    title: "Scrap Rack Tracker",
    desc: "Log remnant sheets with QR labels. Automatically match offcuts to new jobs and cut material waste.",
  },
  {
    icon: ICONS.globe,
    title: "Browser-Native",
    desc: "No downloads, no plugins. Runs entirely in your browser with WebAssembly and WebGL. Works on any device.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Upload Your File",
    desc: "Drag and drop a STEP or DXF file. Our OpenCASCADE kernel processes the geometry instantly in your browser.",
  },
  {
    num: "02",
    title: "Analyse & Unfold",
    desc: "View your part in 3D, watch bends unfold, and inspect flat pattern dimensions with bend deduction corrections.",
  },
  {
    num: "03",
    title: "Get Your Quote",
    desc: "Receive an instant price breakdown covering material, cutting, bending, and setup costs. Send it to your client.",
  },
];

const STATS = [
  { value: 10000, suffix: "+", label: "Parts Quoted" },
  { value: 6, suffix: "", label: "Material Types" },
  { value: 99, suffix: "%", label: "Browser Uptime" },
  { value: 3, suffix: "s", label: "Average Quote Time" },
];

const TESTIMONIALS = [
  {
    quote: "Mechlytix has cut our quoting time from 30 minutes to under a minute. The 3D visualization alone is worth it.",
    author: "James Caldwell",
    role: "Production Manager, Apex Fabrication",
  },
  {
    quote: "The scrap rack tracker paid for itself in the first week. We're using remnants we would have binned.",
    author: "Sarah Mitchell",
    role: "Workshop Lead, Sterling Metalworks",
  },
  {
    quote: "Finally a tool that runs in the browser. No more emailing STEP files around and waiting for quotes.",
    author: "David Chen",
    role: "Design Engineer, NovaTech Ltd",
  },
];

const LOGOS = [
  "Apex Fabrication",
  "Sterling Metalworks",
  "NovaTech",
  "Precision Sheet Co.",
  "Ironside Engineering",
];

// ─────────────────────────────────────────────────────────
export default function LandingClient() {
  return (
    <div className="mkt-page">
      {/* ── Hero ──────────────────────────────────── */}
      <section className="mkt-hero">
        <div className="mkt-hero-bg">
          <div className="login-grid" />
          <div className="login-glow login-glow-1" />
          <div className="login-glow login-glow-2" />
          <div className="mkt-hero-gradient" />
        </div>

        <div className="mkt-hero-content">
          <div className="mkt-hero-text">
            <div className="mkt-badge">
              <span className="mkt-badge-dot" />
              Sheet Metal Engineering
            </div>
            <h1 className="mkt-h1">
              Unfold, Quote &amp; Track
              <br />
              <span className="mkt-h1-accent">Sheet Metal Parts</span>
            </h1>
            <p className="mkt-hero-sub">
              Upload a STEP or DXF file and get instant 3D visualization, flat patterns,
              and automated cost breakdowns — all in your browser. No installs, no waiting.
            </p>
            <div className="mkt-hero-actions">
              <Link href="/login" className="mkt-cta-primary" id="hero-cta-start">
                Start Free {ICONS.arrow}
              </Link>
              <Link href="/features" className="mkt-cta-secondary" id="hero-cta-features">
                Explore Features
              </Link>
            </div>
          </div>

          <div className="mkt-hero-visual">
            <HeroScene />
          </div>
        </div>
      </section>

      {/* ── Social Proof ─────────────────────────── */}
      <section className="mkt-social-proof">
        <ScrollReveal>
          <p className="mkt-social-label">Trusted by engineers at</p>
          <div className="mkt-logo-strip">
            {LOGOS.map((name) => (
              <div key={name} className="mkt-logo-item">{name}</div>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* ── Feature Showcase ─────────────────────── */}
      <section className="mkt-features-section" id="features">
        <ScrollReveal className="mkt-section-header">
          <span className="mkt-section-tag">Capabilities</span>
          <h2 className="mkt-h2">Built for Precision</h2>
          <p className="mkt-section-sub">
            Everything you need to unfold, analyse, quote, and manage sheet metal parts.
          </p>
        </ScrollReveal>

        <div className="mkt-features-grid">
          {FEATURES.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 0.08} className="mkt-feature-card">
              <div className="mkt-feature-icon">{f.icon}</div>
              <h3 className="mkt-feature-title">{f.title}</h3>
              <p className="mkt-feature-desc">{f.desc}</p>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ── How It Works ─────────────────────────── */}
      <section className="mkt-how-section">
        <ScrollReveal className="mkt-section-header">
          <span className="mkt-section-tag">Workflow</span>
          <h2 className="mkt-h2">Three Steps to a Quote</h2>
          <p className="mkt-section-sub">
            From file upload to client-ready quote in under a minute.
          </p>
        </ScrollReveal>

        <div className="mkt-steps">
          {STEPS.map((s, i) => (
            <ScrollReveal
              key={s.num}
              delay={i * 0.15}
              direction={i % 2 === 0 ? "left" : "right"}
              className="mkt-step"
            >
              <span className="mkt-step-num">{s.num}</span>
              <div className="mkt-step-body">
                <h3 className="mkt-step-title">{s.title}</h3>
                <p className="mkt-step-desc">{s.desc}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ── Stats ────────────────────────────────── */}
      <section className="mkt-stats-section">
        <div className="mkt-stats-inner">
          {STATS.map((s) => (
            <div key={s.label} className="mkt-stat">
              <AnimatedCounter
                target={s.value}
                suffix={s.suffix}
                className="mkt-stat-value"
              />
              <span className="mkt-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────── */}
      <section className="mkt-testimonials-section">
        <ScrollReveal className="mkt-section-header">
          <span className="mkt-section-tag">What Engineers Say</span>
          <h2 className="mkt-h2">Built by Engineers, for Engineers</h2>
        </ScrollReveal>

        <div className="mkt-testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <ScrollReveal key={t.author} delay={i * 0.1} className="mkt-testimonial-card">
              <p className="mkt-testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
              <div className="mkt-testimonial-author">
                <div className="mkt-testimonial-avatar">
                  {t.author.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <span className="mkt-testimonial-name">{t.author}</span>
                  <span className="mkt-testimonial-role">{t.role}</span>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────── */}
      <section className="mkt-bottom-cta">
        <ScrollReveal className="mkt-bottom-cta-inner">
          <h2 className="mkt-h2">Ready to Streamline Your Workflow?</h2>
          <p className="mkt-section-sub">
            Create a free account and start quoting sheet metal parts in seconds.
          </p>
          <Link href="/login" className="mkt-cta-primary" id="bottom-cta-start">
            Get Started — It&apos;s Free {ICONS.arrow}
          </Link>
        </ScrollReveal>
      </section>
    </div>
  );
}
