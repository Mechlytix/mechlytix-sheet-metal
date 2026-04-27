import { createClient } from "@/lib/supabase/server";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { DashboardProvider } from "@/lib/dashboard-context";
import { redirect } from "next/navigation";
import type { Currency } from "@/lib/types/database";
import "../dashboard.css";

// ─────────────────────────────────────────────────────────
// Dashboard shell layout
// Wraps all /dashboard/* routes with sidebar + topbar
// ─────────────────────────────────────────────────────────

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Belt-and-suspenders auth check (proxy handles this too)
  if (!user) redirect("/login");

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, company, avatar_url, logo_url")
      .eq("id", user.id)
      .single(),
    supabase
      .from("user_settings")
      .select("currency")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const displayName =
    profile?.full_name ?? user.email?.split("@")[0] ?? "User";
  const company = profile?.company;
  const avatarUrl = profile?.avatar_url;
  const logoUrl = profile?.logo_url;
  const currency = (settings?.currency ?? "GBP") as Currency;

  return (
    <DashboardProvider initialCurrency={currency}>
      <div className="app-container">
        {/* Top Bar */}
        <header className="top-bar dash-top-bar">
          <div className="dash-top-bar-brand">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={company ?? "Logo"} className="dash-brand-logo" />
            ) : (
              <svg width="22" height="22" viewBox="0 0 40 40" fill="none" aria-label="Mechlytix logo">
                <polygon points="20,2 38,11 38,29 20,38 2,29 2,11" fill="none" stroke="#ff6600" strokeWidth="3"/>
                <polygon points="20,10 30,15 30,25 20,30 10,25 10,15" fill="none" stroke="#ff8533" strokeWidth="2"/>
                <polygon points="20,18 25,20.5 25,25.5 20,28 15,25.5 15,20.5" fill="#ff6600"/>
              </svg>
            )}
            <span className="dash-brand-name">{company ?? "Mechlytix"}</span>
          </div>

          <div className="dash-top-bar-right">
            {/* User chip */}
            <div className="user-chip">
              <div className="user-chip-avatar">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt={displayName} width={28} height={28} />
                ) : (
                  <span>{displayName[0].toUpperCase()}</span>
                )}
              </div>
              <div className="user-chip-info">
                <span className="user-chip-name">{displayName}</span>
                {company && <span className="user-chip-company">{company}</span>}
              </div>
              {/* Dropdown */}
              <div className="user-chip-menu">
                <a href="/dashboard/settings" className="user-menu-item">Settings</a>
                <form action="/auth/signout" method="post">
                  <button type="submit" className="user-menu-item danger">Sign out</button>
                </form>
              </div>
            </div>
          </div>
        </header>

        {/* Body: sidebar + page content */}
        <div className="dash-body">
          <DashboardSidebar />
          <main className="dash-main">
            {children}
          </main>
        </div>
      </div>
    </DashboardProvider>
  );
}
