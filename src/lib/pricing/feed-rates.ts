// ─────────────────────────────────────────────────────────
// Default feed rates (mm/min) for a 4kW fiber laser
// by material category and thickness (mm)
// Based on industry-standard cutting tables
// ─────────────────────────────────────────────────────────

type FeedRateTable = Record<string, Record<string, number>>;

/** Feed rates for 4kW fiber laser (mm/min) */
export const FEED_RATES_4KW: FeedRateTable = {
  mild_steel: {
    "0.5": 16000, "0.8": 13000, "1.0": 10000, "1.5": 7500,
    "2.0": 5500,  "2.5": 4200,  "3.0": 3500,  "4.0": 2500,
    "5.0": 1800,  "6.0": 1400,  "8.0": 950,   "10.0": 650,
    "12.0": 450,
  },
  stainless: {
    "0.5": 14000, "0.8": 10000, "1.0": 8000,  "1.5": 6000,
    "2.0": 4000,  "2.5": 3000,  "3.0": 2500,  "4.0": 1800,
    "5.0": 1200,  "6.0": 900,   "8.0": 600,
  },
  aluminum: {
    "0.5": 20000, "0.8": 16000, "1.0": 14000, "1.5": 10000,
    "2.0": 7500,  "2.5": 6000,  "3.0": 5000,  "4.0": 3500,
    "5.0": 2500,  "6.0": 2000,  "8.0": 1400,  "10.0": 1000,
  },
  copper: {
    "0.5": 12000, "1.0": 8000,  "1.5": 5500,  "2.0": 3800,
    "3.0": 2200,  "4.0": 1500,
  },
  brass: {
    "0.5": 14000, "1.0": 9000,  "1.5": 6500,  "2.0": 4500,
    "3.0": 2800,  "4.0": 1800,
  },
  other: {
    "1.0": 8000, "2.0": 4000, "3.0": 2500,
  },
};

/**
 * Lookup feed rate for a given material category and thickness.
 * Interpolates between known values.
 */
export function getFeedRate(
  category: string,
  thicknessMm: number,
  powerKw: number = 4
): number {
  const table = FEED_RATES_4KW[category] ?? FEED_RATES_4KW.mild_steel;
  return interpolateFromTable(table, thicknessMm, powerKw / 4);
}

/**
 * Lookup feed rate using a machine's custom table first,
 * falling back to built-in 4kW defaults if no custom entry exists.
 *
 * @param customFeedRates  The `feed_rates` JSONB from machine_profiles (may be null)
 * @param category         Material category key (e.g. "mild_steel")
 * @param thicknessMm      Part thickness in mm
 * @param powerKw          Machine power — only applied to built-in fallback
 */
export function getFeedRateWithCustom(
  customFeedRates: unknown,
  category: string,
  thicknessMm: number,
  powerKw: number = 4
): number {
  if (customFeedRates && typeof customFeedRates === "object") {
    const custom = customFeedRates as Record<string, Record<string, number>>;
    const catTable = custom[category];
    if (catTable && typeof catTable === "object" && Object.keys(catTable).length > 0) {
      // Use custom table — no power scaling (values are machine-specific actuals)
      return interpolateFromTable(catTable, thicknessMm, 1);
    }
  }
  // Fall back to built-in table with power scaling
  return getFeedRate(category, thicknessMm, powerKw);
}

/** Shared interpolation logic */
function interpolateFromTable(
  table: Record<string, number>,
  thicknessMm: number,
  powerScale: number
): number {
  // Convert table keys to a uniform numeric map to avoid string "1.0" vs "1" mismatch
  const numTable = new Map<number, number>();
  for (const [k, v] of Object.entries(table)) {
    numTable.set(Number(k), Number(v));
  }

  const thicknesses = Array.from(numTable.keys()).sort((a, b) => a - b);

  if (thicknesses.length === 0) return scaleFeedRate(3000, powerScale);

  // Exact match
  if (numTable.has(thicknessMm)) {
    return scaleFeedRate(numTable.get(thicknessMm)!, powerScale);
  }

  // Below range — clamp to minimum
  if (thicknessMm <= thicknesses[0]) {
    return scaleFeedRate(numTable.get(thicknesses[0])!, powerScale);
  }

  // Above range — clamp to maximum
  if (thicknessMm >= thicknesses[thicknesses.length - 1]) {
    return scaleFeedRate(numTable.get(thicknesses[thicknesses.length - 1])!, powerScale);
  }

  // Linear interpolation between bracketing values
  for (let i = 0; i < thicknesses.length - 1; i++) {
    const lo = thicknesses[i];
    const hi = thicknesses[i + 1];
    if (thicknessMm >= lo && thicknessMm <= hi) {
      const t = (thicknessMm - lo) / (hi - lo);
      const rateLo = numTable.get(lo)!;
      const rateHi = numTable.get(hi)!;
      return scaleFeedRate(rateLo + t * (rateHi - rateLo), powerScale);
    }
  }

  return scaleFeedRate(3000, powerScale); // fallback
}

/** Scale feed rate linearly by power relative to baseline */
function scaleFeedRate(rate: number, powerScale: number): number {
  return Math.round(rate * powerScale);
}
