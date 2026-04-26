// ─────────────────────────────────────────────────────────
// Pricing Engine — Cost Model
// Pure function: PricingInput → PricingResult
// All monetary values in £, all dimensions in mm/kg
// ─────────────────────────────────────────────────────────

import type { PricingInput, PricingResult } from "./types";

/**
 * Calculate the full cost breakdown for a sheet metal part.
 *
 * Formula:
 *   materialCost = volume × density × cost_per_kg × waste_factor
 *   cuttingCost  = (perimeter / feed_rate) × hourly_rate / 60
 *                + pierce_count × pierce_time × hourly_rate / 3600
 *   bendingCost  = bend_count × cost_per_bend
 *   setupCost    = setup_minutes × hourly_rate / 60  (amortised over qty)
 *   unitPrice    = (material + cutting + bending + setupPerPart) × (1 + markup%)
 *   totalPrice   = unitPrice × quantity
 */
export function calculatePrice(input: PricingInput): PricingResult {
  const warnings: string[] = [];

  // ── Effective thickness ───────────────────────────────
  const thickness =
    input.geometry.thicknessConfidence === "detected"
      ? input.geometry.thickness
      : (input.thicknessOverride ?? input.geometry.thickness);

  if (thickness <= 0 || thickness > 50) {
    warnings.push("Unusual thickness detected — please verify.");
  }

  // ── Material volume & weight ──────────────────────────
  const partAreaMm2 = input.geometry.partArea > 0
    ? input.geometry.partArea
    : input.geometry.boundingWidth * input.geometry.boundingHeight;

  // Gross area including nesting waste
  const sheetAreaPerPartMm2 = partAreaMm2 * input.wasteFactor;

  // Volume in mm³ → m³ for density calc
  const volumeMm3 = sheetAreaPerPartMm2 * thickness;
  const volumeM3 = volumeMm3 / 1e9;
  const weightKg = volumeM3 * input.materialDensityKgM3;
  const materialCostPerPart = weightKg * input.materialCostPerKg;

  // ── Cutting time ──────────────────────────────────────
  if (input.feedRateMmPerMin <= 0) warnings.push("Feed rate is zero — check machine settings.");
  const feedRate = Math.max(input.feedRateMmPerMin, 100); // floor to prevent div-by-zero
  const cutTimeMinutes = input.geometry.perimeter / feedRate;

  // Pierce cost: each pierce punches through the material
  const pierceTimeSec = input.pierceTimeSeconds * input.geometry.pierceCount;
  const pierceTimeMin = pierceTimeSec / 60;

  const cuttingCostPerPart =
    (cutTimeMinutes + pierceTimeMin) * (input.machineHourlyRate / 60);

  // ── Bending cost ──────────────────────────────────────
  const bendingCostPerPart = input.geometry.bendCount * input.costPerBend;

  // ── Setup cost ────────────────────────────────────────
  const setupCostTotal = input.setupTimeMinutes * (input.machineHourlyRate / 60);
  const setupCostPerPart = setupCostTotal / Math.max(input.quantity, 1);

  // ── Net cost ──────────────────────────────────────────
  const netCostPerPart =
    materialCostPerPart + cuttingCostPerPart + bendingCostPerPart + setupCostPerPart;

  // ── Markup → unit price ───────────────────────────────
  const markupMultiplier = 1 + input.markupPercent / 100;
  const unitPrice = netCostPerPart * markupMultiplier;
  const totalPrice = unitPrice * input.quantity;

  // ── Sanity warnings ───────────────────────────────────
  if (unitPrice < 0.5) warnings.push("Unit price is very low — check geometry and material inputs.");
  if (cutTimeMinutes < 0.001) warnings.push("Cut time is near zero — perimeter may not have been extracted.");
  if (weightKg > 500) warnings.push("Part weight exceeds 500kg — check dimensions (units may be wrong).");

  return {
    thicknessMm: thickness,
    sheetAreaPerPartMm2,
    volumeMm3,
    weightKg,
    materialCostPerPart,
    cutTimeMinutes,
    cuttingCostPerPart,
    bendingCostPerPart,
    setupCostTotal,
    setupCostPerPart,
    netCostPerPart,
    unitPrice,
    totalPrice,
    markupPercent: input.markupPercent,
    warnings,
  };
}
