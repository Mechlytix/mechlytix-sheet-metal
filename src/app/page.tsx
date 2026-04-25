import Link from "next/link";

export default function MarketingPage() {
  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="panel-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="panel-title">MECHLYTIX</span>
          </div>
          <div className="landing-nav-links">
            <Link href="/login" className="landing-nav-link">Sign In</Link>
            <Link href="/login" className="landing-cta-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-bg">
          <div className="login-grid" />
          <div className="login-glow login-glow-1" />
          <div className="login-glow login-glow-2" />
        </div>
        <div className="landing-hero-content">
          <div className="landing-badge">
            <span className="landing-badge-dot" />
            Sheet Metal Engineering
          </div>
          <h1 className="landing-h1">
            Unfold Sheet Metal<br />
            <span className="landing-h1-accent">In Real Time</span>
          </h1>
          <p className="landing-hero-sub">
            Upload a STEP file and watch it unfold to a flat pattern with interactive 3D visualization.
            Powered by OpenCASCADE geometry kernel.
          </p>
          <div className="landing-hero-actions">
            <Link href="/login" className="landing-cta-primary">
              Start Unfolding
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <a href="#features" className="landing-cta-secondary">
              See Features
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="landing-features">
        <div className="landing-features-inner">
          <h2 className="landing-h2">Built for Precision</h2>
          <p className="landing-features-sub">
            Everything you need to unfold, analyze, and export sheet metal parts.
          </p>

          <div className="landing-feature-grid">
            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <h3>3D Visualization</h3>
              <p>Interactive Three.js viewport with real-time rendering, material presets, and camera controls.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <h3>Animated Unfold</h3>
              <p>Watch bends unfold in real time with configurable speed, k-factor, and material properties.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              </div>
              <h3>STEP Import</h3>
              <p>Upload industry-standard STEP files. Geometry processed in-browser via OpenCASCADE WASM.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <h3>Flat Patterns</h3>
              <p>Automatically compute flat pattern dimensions with bend deductions and k-factor corrections.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3>Cloud Storage</h3>
              <p>Your STEP files and exports are securely stored in the cloud. Access your library from anywhere.</p>
            </div>

            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h3>Browser-Native</h3>
              <p>No downloads, no plugins. Runs entirely in your browser with WebAssembly and WebGL.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-bottom-cta">
        <h2 className="landing-h2">Ready to Unfold?</h2>
        <p className="landing-features-sub">
          Create a free account and start visualizing sheet metal parts in seconds.
        </p>
        <Link href="/login" className="landing-cta-primary" style={{ marginTop: '16px' }}>
          Get Started — It&apos;s Free
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </Link>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="panel-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="panel-title" style={{ fontSize: '12px' }}>MECHLYTIX</span>
          </div>
          <span className="landing-footer-copy">© 2026 Mechlytix. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
