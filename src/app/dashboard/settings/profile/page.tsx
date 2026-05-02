"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// ─────────────────────────────────────────────────────────
// /dashboard/settings/profile — Company Profile
// ─────────────────────────────────────────────────────────

export default function ProfileSettingsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileSaved, setProfileSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  const [profile, setProfile] = useState({
    full_name: "", company: "", phone: "", website: "",
    address_line1: "", address_line2: "", logo_url: "",
  });

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: p } = await supabase.from("profiles")
        .select("full_name, company, phone, website, address_line1, address_line2, logo_url")
        .eq("id", user.id).single();

      if (p) setProfile({
        full_name:     p.full_name     ?? "",
        company:       p.company       ?? "",
        phone:         p.phone         ?? "",
        website:       p.website       ?? "",
        address_line1: p.address_line1 ?? "",
        address_line2: p.address_line2 ?? "",
        logo_url:      p.logo_url      ?? "",
      });
      setLoading(false);
    }
    load();
  }, []);

  async function saveProfile() {
    if (!userId) return;
    startTransition(async () => {
      const supabase = createClient();
      await supabase.from("profiles").update({
        full_name:     profile.full_name,
        company:       profile.company,
        phone:         profile.phone || null,
        website:       profile.website || null,
        address_line1: profile.address_line1 || null,
        address_line2: profile.address_line2 || null,
      }).eq("id", userId);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    });
  }

  async function handleLogoUpload(file: File) {
    if (!userId) return;
    setLogoUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `${userId}/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(path);
      await supabase.from("profiles").update({ logo_url: publicUrl }).eq("id", userId);
      setProfile((p) => ({ ...p, logo_url: publicUrl }));
    } catch (err) {
      console.error("Logo upload failed:", err);
    }
    setLogoUploading(false);
  }

  async function removeLogo() {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("profiles").update({ logo_url: null }).eq("id", userId);
    setProfile((p) => ({ ...p, logo_url: "" }));
  }

  if (loading) return <div className="dash-page"><div className="loading-state">Loading…</div></div>;

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Company Profile</h1>
          <p className="dash-page-subtitle">Your business details shown on quotes and invoices</p>
        </div>
      </div>

      <section className="settings-card" style={{ maxWidth: 640 }}>
        {/* Logo */}
        <div className="logo-upload-row">
          <div className="logo-preview" onClick={() => logoInputRef.current?.click()}>
            {profile.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.logo_url} alt="Company logo" />
            ) : (
              <span className="logo-placeholder">
                {logoUploading ? "⏳" : "🏭"}
              </span>
            )}
          </div>
          <div className="logo-upload-info">
            <p className="logo-upload-label">Company Logo</p>
            <p className="logo-upload-hint">PNG, JPG or SVG. Shown on share pages and print headers.</p>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: 12, padding: "5px 12px" }}
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploading}
              >
                {logoUploading ? "Uploading…" : profile.logo_url ? "Change" : "Upload"}
              </button>
              {profile.logo_url && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: 12, padding: "5px 12px", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}
                  onClick={removeLogo}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLogoUpload(file); }}
          />
        </div>

        <div className="form-row-2">
          <div className="form-field">
            <label>Full Name</label>
            <input value={profile.full_name} onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))} placeholder="Jane Smith" />
          </div>
          <div className="form-field">
            <label>Company Name</label>
            <input value={profile.company} onChange={(e) => setProfile((p) => ({ ...p, company: e.target.value }))} placeholder="Acme Fabrication Ltd" />
          </div>
        </div>

        <div className="form-row-2">
          <div className="form-field">
            <label>Phone</label>
            <input type="tel" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+44 1234 567890" />
          </div>
          <div className="form-field">
            <label>Website</label>
            <input type="url" value={profile.website} onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))} placeholder="https://acmefab.co.uk" />
          </div>
        </div>

        <div className="form-field">
          <label>Address Line 1</label>
          <input value={profile.address_line1} onChange={(e) => setProfile((p) => ({ ...p, address_line1: e.target.value }))} placeholder="Unit 4, Industrial Estate" />
        </div>
        <div className="form-field">
          <label>Address Line 2</label>
          <input value={profile.address_line2} onChange={(e) => setProfile((p) => ({ ...p, address_line2: e.target.value }))} placeholder="Birmingham, B1 1AA" />
        </div>

        <button className="btn-primary" onClick={saveProfile}>
          {profileSaved ? "✓ Saved" : "Save Profile"}
        </button>
      </section>
    </div>
  );
}
