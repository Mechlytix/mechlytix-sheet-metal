"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDashboard } from "@/lib/dashboard-context";

// ─── Nav items ────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

const PRIMARY_NAV: NavItem[] = [
  { label: "Overview",    href: "/dashboard",            icon: "grid" },
  { label: "Quoter",      href: "/dashboard/quoter",     icon: "zap",    badge: "NEW" },
  { label: "Unfolder",    href: "/dashboard/unfolder",   icon: "layers" },
  { label: "Quotes",      href: "/dashboard/quotes",     icon: "file-text" },
  { label: "Customers",   href: "/dashboard/customers",  icon: "users" },
  { label: "Materials",   href: "/dashboard/materials",  icon: "box" },
  { label: "Scrap Rack",  href: "/dashboard/scrap-rack", icon: "refresh-cw" },
];

const SETTINGS_NAV: NavItem[] = [
  { label: "Profile",      href: "/dashboard/settings/profile",     icon: "user" },
  { label: "Quoting",      href: "/dashboard/settings/quoting",     icon: "dollar-sign" },
  { label: "Branding",     href: "/dashboard/settings/branding",    icon: "palette" },
  { label: "Machines",     href: "/dashboard/settings/machines",    icon: "cpu" },
  { label: "Preferences",  href: "/dashboard/settings/preferences", icon: "sliders" },
];

// ─── Icon SVGs ────────────────────────────────────────────

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const s = size;
  const icons: Record<string, React.ReactNode> = {
    grid: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
    zap: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
    layers: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
        <polyline points="2 17 12 22 22 17"/>
        <polyline points="2 12 12 17 22 12"/>
      </svg>
    ),
    "file-text": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    box: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
    "refresh-cw": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10"/>
        <polyline points="1 20 1 14 7 14"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
    ),
    settings: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    users: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    // ── Settings sub-nav icons ──
    user: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    "dollar-sign": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
    palette: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/>
        <circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/>
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
      </svg>
    ),
    cpu: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>
        <line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/>
        <line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
        <line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/>
        <line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>
      </svg>
    ),
    sliders: (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
        <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
        <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/>
        <line x1="17" y1="16" x2="23" y2="16"/>
      </svg>
    ),
    "arrow-left": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
      </svg>
    ),
    "log-out": (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    ),
  };
  return <>{icons[name] ?? null}</>;
}

// ─── Nav Item Component ────────────────────────────────────

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive =
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      className={`sidebar-nav-item ${isActive ? "active" : ""}`}
      title={collapsed ? item.label : undefined}
    >
      <span className="sidebar-nav-icon">
        <Icon name={item.icon} />
      </span>
      {!collapsed && (
        <>
          <span className="sidebar-nav-label">{item.label}</span>
          {item.badge && <span className="sidebar-nav-badge">{item.badge}</span>}
        </>
      )}
    </Link>
  );
}

// ─── User Section ──────────────────────────────────────────

function UserSection({ collapsed }: { collapsed: boolean }) {
  const { user } = useDashboard();

  return (
    <div className={`sidebar-user-section ${collapsed ? "collapsed" : ""}`}>
      <Link
        href="/dashboard/account"
        className="sidebar-user-info"
        title={collapsed ? user.displayName : "Account settings"}
      >
        <div className="sidebar-user-avatar">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={user.displayName} width={30} height={30} />
          ) : (
            <span>{user.displayName[0]?.toUpperCase() ?? "U"}</span>
          )}
        </div>
        {!collapsed && (
          <div className="sidebar-user-details">
            <span className="sidebar-user-name">{user.displayName}</span>
            {user.company && <span className="sidebar-user-company">{user.company}</span>}
          </div>
        )}
      </Link>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="sidebar-signout-btn"
          title="Sign out"
        >
          <Icon name="log-out" size={16} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </form>
    </div>
  );
}

// ─── Main Sidebar ──────────────────────────────────────────

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const inSettings = pathname.startsWith("/dashboard/settings");

  return (
    <aside className={`dashboard-sidebar ${collapsed ? "collapsed" : ""}`}>
      {/* Overhanging collapse toggle */}
      <button
        className={`sidebar-collapse-btn ${collapsed ? "is-collapsed" : ""}`}
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>

      {inSettings ? (
        <>
          {/* Back button */}
          <Link
            href="/dashboard"
            className="sidebar-back-btn"
            title={collapsed ? "Back to dashboard" : undefined}
          >
            <span className="sidebar-nav-icon">
              <Icon name="arrow-left" />
            </span>
            {!collapsed && <span className="sidebar-back-label">Back</span>}
          </Link>

          {/* Settings section label */}
          {!collapsed && (
            <div className="sidebar-section-label">Settings</div>
          )}

          {/* Settings sub-navigation */}
          <nav className="sidebar-nav">
            {SETTINGS_NAV.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </nav>
        </>
      ) : (
        <>
          {/* Primary navigation */}
          <nav className="sidebar-nav">
            {PRIMARY_NAV.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </nav>
        </>
      )}

      {/* Spacer — pushes settings + user to bottom */}
      <div style={{ flex: 1 }} />

      {/* Settings link — sits directly above user */}
      <nav className="sidebar-nav sidebar-nav-secondary">
        <NavLink
          item={{ label: "Settings", href: "/dashboard/settings", icon: "settings" }}
          collapsed={collapsed}
        />
      </nav>

      {/* User section — always at bottom */}
      <UserSection collapsed={collapsed} />
    </aside>
  );
}
