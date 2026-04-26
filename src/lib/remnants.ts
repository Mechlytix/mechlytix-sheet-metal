// ─────────────────────────────────────────────────────────
// Remnant Scrap Value Calculator
// ─────────────────────────────────────────────────────────

interface RemnantDimensions {
  width_mm: number;
  height_mm: number;
  thickness_mm: number;
}

interface MaterialForCalc {
  density_kg_m3: number;
  scrap_value_per_kg: number | null;
  cost_per_kg: number;
}

export function calcRemnantWeight(dims: RemnantDimensions, mat: MaterialForCalc): number {
  const volumeM3 = (dims.width_mm * dims.height_mm * dims.thickness_mm) / 1e9;
  return volumeM3 * mat.density_kg_m3;
}

export function calcRemnantScrapValue(dims: RemnantDimensions, mat: MaterialForCalc): number {
  const kg = calcRemnantWeight(dims, mat);
  return kg * (mat.scrap_value_per_kg ?? mat.cost_per_kg * 0.15);
}

export function calcRemnantMaterialValue(dims: RemnantDimensions, mat: MaterialForCalc): number {
  const kg = calcRemnantWeight(dims, mat);
  return kg * mat.cost_per_kg;
}
