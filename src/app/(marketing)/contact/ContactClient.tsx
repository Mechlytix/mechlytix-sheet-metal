"use client";

import { useState } from "react";
import ScrollReveal from "@/components/marketing/ScrollReveal";

// ─────────────────────────────────────────────────────────
// Contact Page — Form with validation, submits to API route
// ─────────────────────────────────────────────────────────

const SUBJECTS = [
  "General enquiry",
  "Request a demo",
  "Enterprise pricing",
  "Technical support",
  "Partnership opportunity",
  "Other",
];

interface FormData {
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
}

export default function ContactClient() {
  const [form, setForm] = useState<FormData>({
    name: "",
    email: "",
    company: "",
    subject: SUBJECTS[0],
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const update = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");

    try {
      const res = await fetch("/contact/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to submit");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="mkt-page">
      {/* Hero */}
      <section className="mkt-page-hero">
        <ScrollReveal className="mkt-section-header">
          <span className="mkt-section-tag">Contact</span>
          <h1 className="mkt-h1" style={{ fontSize: "clamp(32px, 5vw, 52px)" }}>
            Let&apos;s <span className="mkt-h1-accent">Talk</span>
          </h1>
          <p className="mkt-section-sub" style={{ maxWidth: 480 }}>
            Have a question, want a demo, or need custom pricing? We&apos;d love to hear from you.
          </p>
        </ScrollReveal>
      </section>

      {/* Form */}
      <section className="mkt-contact-section">
        <ScrollReveal className="mkt-contact-layout">
          {/* Form column */}
          <div className="mkt-contact-form-wrap">
            {status === "sent" ? (
              <div className="mkt-contact-success">
                <span className="mkt-contact-success-icon">✓</span>
                <h3>Message Sent!</h3>
                <p>Thanks for reaching out. We&apos;ll get back to you shortly.</p>
              </div>
            ) : (
              <form className="mkt-contact-form" onSubmit={handleSubmit}>
                <div className="mkt-form-row">
                  <div className="mkt-form-group">
                    <label htmlFor="contact-name" className="mkt-form-label">Name *</label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={form.name}
                      onChange={update("name")}
                      placeholder="Your name"
                      className="mkt-form-input"
                    />
                  </div>
                  <div className="mkt-form-group">
                    <label htmlFor="contact-email" className="mkt-form-label">Email *</label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={update("email")}
                      placeholder="your@email.com"
                      className="mkt-form-input"
                    />
                  </div>
                </div>

                <div className="mkt-form-row">
                  <div className="mkt-form-group">
                    <label htmlFor="contact-company" className="mkt-form-label">Company</label>
                    <input
                      id="contact-company"
                      type="text"
                      value={form.company}
                      onChange={update("company")}
                      placeholder="Your company"
                      className="mkt-form-input"
                    />
                  </div>
                  <div className="mkt-form-group">
                    <label htmlFor="contact-subject" className="mkt-form-label">Subject</label>
                    <select
                      id="contact-subject"
                      value={form.subject}
                      onChange={update("subject")}
                      className="mkt-form-input mkt-form-select"
                    >
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mkt-form-group">
                  <label htmlFor="contact-message" className="mkt-form-label">Message *</label>
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    value={form.message}
                    onChange={update("message")}
                    placeholder="Tell us about your project or question..."
                    className="mkt-form-input mkt-form-textarea"
                  />
                </div>

                {status === "error" && (
                  <p className="mkt-form-error">
                    Something went wrong. Please try again or email us directly.
                  </p>
                )}

                <button
                  type="submit"
                  className="mkt-cta-primary"
                  disabled={status === "sending"}
                  id="contact-submit"
                >
                  {status === "sending" ? "Sending..." : "Send Message"}
                </button>
              </form>
            )}
          </div>

          {/* Info column */}
          <div className="mkt-contact-info">
            <div className="mkt-contact-info-card">
              <h3>Other Ways to Reach Us</h3>

              <div className="mkt-contact-info-item">
                <span className="mkt-contact-info-icon">📧</span>
                <div>
                  <span className="mkt-contact-info-label">Email</span>
                  <a href="mailto:hello@mechlytix.com" className="mkt-contact-info-value">
                    hello@mechlytix.com
                  </a>
                </div>
              </div>

              <div className="mkt-contact-info-item">
                <span className="mkt-contact-info-icon">⏰</span>
                <div>
                  <span className="mkt-contact-info-label">Response Time</span>
                  <span className="mkt-contact-info-value">Within 24 hours</span>
                </div>
              </div>

              <div className="mkt-contact-info-item">
                <span className="mkt-contact-info-icon">🌍</span>
                <div>
                  <span className="mkt-contact-info-label">Location</span>
                  <span className="mkt-contact-info-value">United Kingdom</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
