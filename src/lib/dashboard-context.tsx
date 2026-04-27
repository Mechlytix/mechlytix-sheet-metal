"use client";

import { useState, createContext, useContext } from "react";
import type { UnitSystem } from "@/lib/units";
import type { Currency } from "@/lib/types/database";
import { CURRENCY_SYMBOLS } from "@/lib/types/database";

// ─────────────────────────────────────────────────────────
// Global Dashboard context: unit system + currency preference
// ─────────────────────────────────────────────────────────

interface DashboardContextValue {
  units: UnitSystem;
  setUnits: (u: UnitSystem) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  currencySymbol: string;
}

const DashboardContext = createContext<DashboardContextValue>({
  units: "metric",
  setUnits: () => {},
  currency: "GBP",
  setCurrency: () => {},
  currencySymbol: "£",
});

export function useDashboard() {
  return useContext(DashboardContext);
}

export function DashboardProvider({
  children,
  initialCurrency = "GBP",
}: {
  children: React.ReactNode;
  initialCurrency?: Currency;
}) {
  const [units, setUnits] = useState<UnitSystem>("metric");
  const [currency, setCurrency] = useState<Currency>(initialCurrency);

  return (
    <DashboardContext.Provider
      value={{
        units,
        setUnits,
        currency,
        setCurrency,
        currencySymbol: CURRENCY_SYMBOLS[currency],
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
