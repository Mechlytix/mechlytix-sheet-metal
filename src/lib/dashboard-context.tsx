"use client";

import { useState, createContext, useContext } from "react";
import type { UnitSystem } from "@/lib/units";

// ─────────────────────────────────────────────────────────
// Global Dashboard context: unit system preference
// ─────────────────────────────────────────────────────────

interface DashboardContextValue {
  units: UnitSystem;
  setUnits: (u: UnitSystem) => void;
}

const DashboardContext = createContext<DashboardContextValue>({
  units: "metric",
  setUnits: () => {},
});

export function useDashboard() {
  return useContext(DashboardContext);
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [units, setUnits] = useState<UnitSystem>("metric");
  return (
    <DashboardContext.Provider value={{ units, setUnits }}>
      {children}
    </DashboardContext.Provider>
  );
}
