// ─────────────────────────────────────────────────────────
// Unit conversion utilities
// Metric (mm, kg, £/kg) ↔ Imperial (in, lb, £/lb)
// ─────────────────────────────────────────────────────────

export type UnitSystem = "metric" | "imperial";

// Length
export const mmToIn = (mm: number) => mm / 25.4;
export const inToMm = (inches: number) => inches * 25.4;

// Area
export const mm2ToIn2 = (mm2: number) => mm2 / 645.16;
export const in2ToMm2 = (in2: number) => in2 * 645.16;

// Mass per length
export const kgToLb = (kg: number) => kg * 2.20462;
export const lbToKg = (lb: number) => lb / 2.20462;

// Cost per kg → cost per lb
export const perKgToPerLb = (perKg: number) => perKg / 2.20462;
export const perLbToPerKg = (perLb: number) => perLb * 2.20462;

/** Format a length value for display */
export function formatLength(mm: number, units: UnitSystem, decimals = 1): string {
  if (units === "imperial") {
    return `${mmToIn(mm).toFixed(decimals)}"`;
  }
  return `${mm.toFixed(decimals)} mm`;
}

/** Format an area value for display */
export function formatArea(mm2: number, units: UnitSystem, decimals = 1): string {
  if (units === "imperial") {
    return `${mm2ToIn2(mm2).toFixed(decimals)} in²`;
  }
  return `${(mm2 / 1000).toFixed(decimals)} cm²`;
}

/** Format a weight for display */
export function formatWeight(kg: number, units: UnitSystem, decimals = 2): string {
  if (units === "imperial") {
    return `${kgToLb(kg).toFixed(decimals)} lb`;
  }
  return `${kg.toFixed(decimals)} kg`;
}

/** Format a cost-per-weight rate */
export function formatCostPerWeight(perKg: number, units: UnitSystem, decimals = 2): string {
  const symbol = "£";
  if (units === "imperial") {
    return `${symbol}${perKgToPerLb(perKg).toFixed(decimals)}/lb`;
  }
  return `${symbol}${perKg.toFixed(decimals)}/kg`;
}

/** Format a currency amount */
export function formatCurrency(amount: number, decimals = 2): string {
  return `£${amount.toFixed(decimals)}`;
}

/** Parse a user-entered length value (mm or inches) back to mm */
export function parseLength(value: string, units: UnitSystem): number {
  const n = parseFloat(value);
  if (isNaN(n)) return 0;
  return units === "imperial" ? inToMm(n) : n;
}
