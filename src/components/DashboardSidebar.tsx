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

const SECONDARY_NAV: NavItem[] = [
  { label: "Settings",    href: "/dashboard/settings",   icon: "settings" },
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
  };
  return <>{icons[name] ?? null}</>;
}

// ─── Nav Item Component ────────────────────────────────────

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  // Active: exact match for /dashboard, prefix match for sub-routes
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

// ─── Unit Toggle ───────────────────────────────────────────

function UnitToggle({ collapsed }: { collapsed: boolean }) {
  const { units, setUnits } = useDashboard();
  return (
    <div className={`unit-toggle ${collapsed ? "collapsed" : ""}`} title={collapsed ? `Units: ${units}` : undefined}>
      {!collapsed && <span className="unit-toggle-label">Units</span>}
      <div className="unit-toggle-buttons">
        <button
          className={`unit-btn ${units === "metric" ? "active" : ""}`}
          onClick={() => setUnits("metric")}
          title="Metric (mm / kg)"
        >mm</button>
        <button
          className={`unit-btn ${units === "imperial" ? "active" : ""}`}
          onClick={() => setUnits("imperial")}
          title="Imperial (in / lb)"
        >in</button>
      </div>
    </div>
  );
}

// ─── Main Sidebar ──────────────────────────────────────────

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`dashboard-sidebar ${collapsed ? "collapsed" : ""}`}>
      {/* Collapse toggle */}
      <button
        className="sidebar-collapse-btn"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {collapsed
            ? <><polyline points="9 18 15 12 9 6"/></>
            : <><polyline points="15 18 9 12 15 6"/></>
          }
        </svg>
      </button>

      {/* Primary navigation */}
      <nav className="sidebar-nav">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Unit toggle */}
      <UnitToggle collapsed={collapsed} />

      {/* Secondary navigation */}
      <nav className="sidebar-nav sidebar-nav-secondary">
        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} collapsed={collapsed} />
        ))}
      </nav>
    </aside>
  );
}
