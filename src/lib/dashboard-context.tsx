"use client";

import { useState, createContext, useContext } from "react";
import type { UnitSystem } from "@/lib/units";
import type { Currency } from "@/lib/types/database";
import { CURRENCY_SYMBOLS } from "@/lib/types/database";

// ─────────────────────────────────────────────────────────
// Global Dashboard context: unit system + currency + user
// ─────────────────────────────────────────────────────────

interface UserInfo {
  displayName: string;
  company: string | null;
  avatarUrl: string | null;
}

interface DashboardContextValue {
  units: UnitSystem;
  setUnits: (u: UnitSystem) => void;
  currency: Currency;
  setCurrency: (c: Currency) => void;
  currencySymbol: string;
  user: UserInfo;
}

const DashboardContext = createContext<DashboardContextValue>({
  units: "metric",
  setUnits: () => {},
  currency: "GBP",
  setCurrency: () => {},
  currencySymbol: "£",
  user: { displayName: "User", company: null, avatarUrl: null },
});

export function useDashboard() {
  return useContext(DashboardContext);
}

export function DashboardProvider({
  children,
  initialCurrency = "GBP",
  user,
}: {
  children: React.ReactNode;
  initialCurrency?: Currency;
  user?: UserInfo;
}) {
  const [units, setUnits] = useState<UnitSystem>("metric");
  const [currency, setCurrency] = useState<Currency>(initialCurrency);

  const userInfo = user ?? { displayName: "User", company: null, avatarUrl: null };

  return (
    <DashboardContext.Provider
      value={{
        units,
        setUnits,
        currency,
        setCurrency,
        currencySymbol: CURRENCY_SYMBOLS[currency],
        user: userInfo,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
