"use client";

import ScrollReveal from "@/components/marketing/ScrollReveal";

// ─────────────────────────────────────────────────────────
// About Page — Mission, technology, team
// ─────────────────────────────────────────────────────────

const TECH_STACK = [
  {
    name: "OpenCASCADE",
    desc: "Industrial-grade geometry kernel compiled to WebAssembly. Processes STEP files entirely in-browser — no server uploads.",
    icon: "⚙️",
  },
  {
    name: "Three.js",
    desc: "GPU-accelerated 3D rendering with physically-based materials, real-time shadows, and interactive camera controls.",
    icon: "🎨",
  },
  {
    name: "Next.js",
    desc: "React framework with server-side rendering, optimised routing, and edge-ready API endpoints.",
    icon: "⚡",
  },
  {
    name: "Supabase",
    desc: "Postgres database with Row Level Security, real-time subscriptions, and built-in authentication.",
    icon: "🔐",
  },
];

const VALUES = [
  {
    title: "Shop Floor First",
    desc: "We build for the people who actually cut, bend, and weld metal — not just the people who draw it.",
    icon: "🏭",
  },
  {
    title: "Browser-Native",
    desc: "Every feature runs in your browser. No installers, no licence dongles, no IT department required.",
    icon: "🌐",
  },
  {
    title: "Transparent Pricing",
    desc: "No hidden fees, no per-seat upsells. You know exactly what you're paying for.",
    icon: "💎",
  },
  {
    title: "Data Ownership",
    desc: "Your files never leave your browser for geometry processing. Your data stays yours.",
    icon: "🛡️",
  },
];

export default function AboutClient() {
  return (
    <div className="mkt-page">
      {/* Hero */}
      <section className="mkt-page-hero">
        <ScrollReveal className="mkt-section-header">
          <span className="mkt-section-tag">About</span>
          <h1 className="mkt-h1" style={{ fontSize: "clamp(32px, 5vw, 52px)" }}>
            Engineering Tools for
            <br />
            <span className="mkt-h1-accent">The Modern Shop Floor</span>
          </h1>
          <p className="mkt-section-sub" style={{ maxWidth: 600 }}>
            Mechlytix is building the sheet metal engineering platform we wished existed.
          </p>
        </ScrollReveal>
      </section>

      {/* Mission */}
      <section className="mkt-about-mission">
        <ScrollReveal className="mkt-about-mission-inner">
          <div className="mkt-about-mission-text">
            <h2 className="mkt-h2">Our Mission</h2>
            <p className="mkt-about-para">
              Sheet metal fabrication is a £200 billion global industry, yet most shops still quote
              jobs with spreadsheets, gut feel, and back-of-napkin calculations.
            </p>
            <p className="mkt-about-para">
              We&apos;re building the tools to change that. Mechlytix brings browser-native 3D
              visualization, automated cost estimation, and inventory tracking to any fabrication
              shop — regardless of size, budget, or IT infrastructure.
            </p>
            <p className="mkt-about-para">
              Our goal is simple: <strong>make every quote accurate, every part traceable, and every
              scrap sheet reusable.</strong>
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* Values */}
      <section className="mkt-features-section">
        <ScrollReveal className="mkt-section-header">
          <span className="mkt-section-tag">Values</span>
          <h2 className="mkt-h2">What We Believe</h2>
        </ScrollReveal>

        <div className="mkt-features-grid" style={{ maxWidth: 900, margin: "0 auto" }}>
          {VALUES.map((v, i) => (
            <ScrollReveal key={v.title} delay={i * 0.08} className="mkt-feature-card">
              <div className="mkt-feature-icon">
                <span style={{ fontSize: 22 }}>{v.icon}</span>
              </div>
              <h3 className="mkt-feature-title">{v.title}</h3>
              <p className="mkt-feature-desc">{v.desc}</p>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="mkt-how-section">
        <ScrollReveal className="mkt-section-header">
          <span className="mkt-section-tag">Technology</span>
          <h2 className="mkt-h2">Built on Best-in-Class Foundations</h2>
          <p className="mkt-section-sub">
            We use industrial-grade open-source technology to deliver a premium experience.
          </p>
        </ScrollReveal>

        <div className="mkt-tech-grid">
          {TECH_STACK.map((t, i) => (
            <ScrollReveal key={t.name} delay={i * 0.1} className="mkt-tech-card">
              <span className="mkt-tech-icon">{t.icon}</span>
              <h3 className="mkt-tech-name">{t.name}</h3>
              <p className="mkt-tech-desc">{t.desc}</p>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Team placeholder */}
      <section className="mkt-features-section">
        <ScrollReveal className="mkt-section-header">
          <span className="mkt-section-tag">Team</span>
          <h2 className="mkt-h2">A Small Team with Big Ambitions</h2>
          <p className="mkt-section-sub" style={{ maxWidth: 480 }}>
            We&apos;re a lean team of engineers and fabricators building the tools we always wanted.
          </p>
        </ScrollReveal>

        <ScrollReveal className="mkt-team-cta">
          <p>Interested in joining? We&apos;re always looking for talented people.</p>
          <a href="mailto:hello@mechlytix.com" className="mkt-cta-secondary">
            Get in Touch
          </a>
        </ScrollReveal>
      </section>
    </div>
  );
}
