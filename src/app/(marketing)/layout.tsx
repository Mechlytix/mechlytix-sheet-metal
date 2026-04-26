"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// ─────────────────────────────────────────────────────────
// Marketing Shell — Shared nav + footer for all public pages
// ─────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <>
      {/* ── Navigation ──────────────────────────────── */}
      <nav className={`mkt-nav${scrolled ? " mkt-nav--scrolled" : ""}`}>
        <div className="mkt-nav-inner">
          {/* Brand */}
          <Link href="/" className="mkt-brand">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" aria-label="Mechlytix logo">
              <polygon points="20,2 38,11 38,29 20,38 2,29 2,11" fill="none" stroke="#ff6600" strokeWidth="3" />
              <polygon points="20,10 30,15 30,25 20,30 10,25 10,15" fill="none" stroke="#ff8533" strokeWidth="2" />
              <polygon points="20,18 25,20.5 25,25.5 20,28 15,25.5 15,20.5" fill="#ff6600" />
            </svg>
            <span className="mkt-brand-name">MECHLYTIX</span>
          </Link>

          {/* Desktop links */}
          <div className="mkt-nav-links">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`mkt-nav-link${pathname === l.href ? " active" : ""}`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="mkt-nav-actions">
            <Link href="/login" className="mkt-nav-link">Sign In</Link>
            <Link href="/login" className="mkt-cta-btn">Get Started</Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className={`mkt-hamburger${mobileOpen ? " open" : ""}`}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>

        {/* Mobile drawer */}
        <div className={`mkt-mobile-drawer${mobileOpen ? " open" : ""}`}>
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="mkt-mobile-link">
              {l.label}
            </Link>
          ))}
          <div className="mkt-mobile-divider" />
          <Link href="/login" className="mkt-mobile-link">Sign In</Link>
          <Link href="/login" className="mkt-cta-btn" style={{ marginTop: 8 }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Page Content ────────────────────────────── */}
      <main>{children}</main>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="mkt-footer">
        <div className="mkt-footer-inner">
          {/* Brand column */}
          <div className="mkt-footer-col mkt-footer-brand-col">
            <div className="mkt-brand">
              <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
                <polygon points="20,2 38,11 38,29 20,38 2,29 2,11" fill="none" stroke="#ff6600" strokeWidth="3" />
                <polygon points="20,10 30,15 30,25 20,30 10,25 10,15" fill="none" stroke="#ff8533" strokeWidth="2" />
                <polygon points="20,18 25,20.5 25,25.5 20,28 15,25.5 15,20.5" fill="#ff6600" />
              </svg>
              <span className="mkt-brand-name" style={{ fontSize: 13 }}>MECHLYTIX</span>
            </div>
            <p className="mkt-footer-desc">
              Sheet metal engineering tools for the modern shop floor. Upload, unfold, quote — all in your browser.
            </p>
          </div>

          {/* Product column */}
          <div className="mkt-footer-col">
            <h4 className="mkt-footer-heading">Product</h4>
            <Link href="/features" className="mkt-footer-link">Features</Link>
            <Link href="/pricing" className="mkt-footer-link">Pricing</Link>
            <Link href="/login" className="mkt-footer-link">Sign In</Link>
          </div>

          {/* Company column */}
          <div className="mkt-footer-col">
            <h4 className="mkt-footer-heading">Company</h4>
            <Link href="/about" className="mkt-footer-link">About</Link>
            <Link href="/contact" className="mkt-footer-link">Contact</Link>
          </div>

          {/* Legal column */}
          <div className="mkt-footer-col">
            <h4 className="mkt-footer-heading">Legal</h4>
            <span className="mkt-footer-link mkt-footer-link--muted">Privacy Policy</span>
            <span className="mkt-footer-link mkt-footer-link--muted">Terms of Service</span>
          </div>
        </div>

        <div className="mkt-footer-bottom">
          <span>© {new Date().getFullYear()} Mechlytix. All rights reserved.</span>
          <span className="mkt-footer-built">Built with OpenCASCADE · Three.js · Supabase</span>
        </div>
      </footer>
    </>
  );
}
