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
  const thicknesses = Object.keys(table).map(Number).sort((a, b) => a - b);

  // Exact match
  const exact = table[thicknessMm.toString()];
  if (exact) return scaleFeedRate(exact, powerKw);

  // Below range
  if (thicknessMm <= thicknesses[0]) {
    return scaleFeedRate(table[thicknesses[0].toString()], powerKw);
  }

  // Above range
  if (thicknessMm >= thicknesses[thicknesses.length - 1]) {
    return scaleFeedRate(table[thicknesses[thicknesses.length - 1].toString()], powerKw);
  }

  // Linear interpolation between bracketing values
  for (let i = 0; i < thicknesses.length - 1; i++) {
    const lo = thicknesses[i];
    const hi = thicknesses[i + 1];
    if (thicknessMm >= lo && thicknessMm <= hi) {
      const t = (thicknessMm - lo) / (hi - lo);
      const rateLo = table[lo.toString()];
      const rateHi = table[hi.toString()];
      return scaleFeedRate(rateLo + t * (rateHi - rateLo), powerKw);
    }
  }

  return scaleFeedRate(3000, powerKw); // fallback
}

/** Scale feed rate linearly by machine power relative to 4kW baseline */
function scaleFeedRate(rate: number, powerKw: number): number {
  return Math.round(rate * (powerKw / 4));
}
