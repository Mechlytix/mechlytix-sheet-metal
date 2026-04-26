"use client";

import Link from "next/link";
import ScrollReveal from "@/components/marketing/ScrollReveal";

// ─────────────────────────────────────────────────────────
// Features Page — Deep-dive on each capability
// Alternating text/visual layout sections
// ─────────────────────────────────────────────────────────

const FEATURE_SECTIONS = [
  {
    tag: "3D Engine",
    title: "Interactive 3D Visualization",
    desc: "View your sheet metal parts in a professional Three.js viewport with orbital controls, multiple material presets, and real-time edge rendering. Rotate, zoom, and inspect every detail before committing to production.",
    bullets: [
      "Real-time rendering with PBR materials",
      "Material presets: stainless, aluminium, mild steel, copper, brass",
      "Wireframe and edge overlay modes",
      "Camera position bookmarks (top, front, isometric)",
    ],
    visual: "🔲",
  },
  {
    tag: "Geometry Kernel",
    title: "Animated Unfold & Flat Patterns",
    desc: "Upload a STEP file and watch bends unfold in real time. Our OpenCASCADE WASM kernel computes flat pattern dimensions with configurable k-factor and bend deductions — entirely in your browser.",
    bullets: [
      "Animated bend unfolding with adjustable speed",
      "K-factor and bend deduction corrections",
      "Flat pattern dimension extraction",
      "DXF export for CNC programming",
    ],
    visual: "📐",
  },
  {
    tag: "Quoter",
    title: "Instant Cost Breakdowns",
    desc: "Get a full price breakdown in seconds: material cost, laser cutting time, bend charges, and setup fees. Adjust quantities, markup percentages, and machine profiles to produce client-ready quotes.",
    bullets: [
      "Automated material, cutting, bending, and setup cost calculation",
      "Configurable markup and quantity pricing",
      "Machine profile support (laser, waterjet, plasma, punch)",
      "PDF-ready quote generation with status tracking",
    ],
    visual: "💰",
  },
  {
    tag: "Inventory",
    title: "Scrap Rack & Remnant Tracking",
    desc: "Stop throwing away usable offcuts. Log remnant sheets with dimensions and location, generate QR labels for your rack, and let the quoter automatically suggest matching remnants for new jobs.",
    bullets: [
      "Remnant logging with material, dimensions, and location",
      "QR code label generation for physical tracking",
      "Automatic remnant matching during quoting",
      "Status lifecycle: available → reserved → consumed",
    ],
    visual: "♻️",
  },
  {
    tag: "Materials",
    title: "Material & Machine Management",
    desc: "Maintain a comprehensive database of materials with density, k-factor, cost per kilogram, and visual properties. Define machine profiles with hourly rates, feed speeds, and setup times.",
    bullets: [
      "System and custom material libraries",
      "Per-material 3D rendering properties (colour, metalness, roughness)",
      "Machine profiles with configurable feed rates",
      "Scrap value tracking for remnant calculations",
    ],
    visual: "🧱",
  },
  {
    tag: "Platform",
    title: "Cloud-Native & Browser-First",
    desc: "No downloads, no plugins, no VPN. Mechlytix runs entirely in your browser using WebAssembly for geometry processing and WebGL for rendering. Your files and quotes are securely stored in the cloud.",
    bullets: [
      "OpenCASCADE WASM kernel — no server-side geometry processing",
      "Supabase-backed cloud storage and authentication",
      "Works on Chrome, Firefox, Safari, and Edge",
      "Responsive design — works on desktop and tablet",
    ],
    visual: "☁️",
  },
];

export default function FeaturesClient() {
  return (
    <div className="mkt-page">
      {/* Hero */}
      <section className="mkt-page-hero">
        <ScrollReveal className="mkt-section-header">
          <span className="mkt-section-tag">Platform</span>
          <h1 className="mkt-h1" style={{ fontSize: "clamp(32px, 5vw, 52px)" }}>
            Everything You Need for
            <br />
            <span className="mkt-h1-accent">Sheet Metal Engineering</span>
          </h1>
          <p className="mkt-section-sub" style={{ maxWidth: 600 }}>
            From file upload to client-ready quote — one platform, zero installs.
          </p>
        </ScrollReveal>
      </section>

      {/* Feature sections */}
      {FEATURE_SECTIONS.map((f, i) => (
        <section
          key={f.tag}
          className={`mkt-feature-section ${i % 2 === 1 ? "mkt-feature-section--alt" : ""}`}
        >
          <div className="mkt-feature-section-inner">
            <ScrollReveal
              direction={i % 2 === 0 ? "left" : "right"}
              className="mkt-feature-text"
            >
              <span className="mkt-section-tag">{f.tag}</span>
              <h2 className="mkt-h2">{f.title}</h2>
              <p className="mkt-feature-longdesc">{f.desc}</p>
              <ul className="mkt-feature-bullets">
                {f.bullets.map((b) => (
                  <li key={b}>
                    <span className="mkt-bullet-check">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </ScrollReveal>

            <ScrollReveal
              direction={i % 2 === 0 ? "right" : "left"}
              className="mkt-feature-visual"
            >
              <div className="mkt-feature-visual-box">
                <span className="mkt-feature-visual-emoji">{f.visual}</span>
              </div>
            </ScrollReveal>
          </div>
        </section>
      ))}

      {/* Bottom CTA */}
      <section className="mkt-bottom-cta">
        <ScrollReveal className="mkt-bottom-cta-inner">
          <h2 className="mkt-h2">See It in Action</h2>
          <p className="mkt-section-sub">
            Create a free account and explore every feature.
          </p>
          <Link href="/login" className="mkt-cta-primary" id="features-cta">
            Get Started Free
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </ScrollReveal>
      </section>
    </div>
  );
}
