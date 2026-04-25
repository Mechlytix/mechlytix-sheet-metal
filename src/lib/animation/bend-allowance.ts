// ─────────────────────────────────────────────────────────
// Bend Allowance & Deduction Calculations
// Standard sheet metal formulas per machinery's handbook
// ─────────────────────────────────────────────────────────

/**
 * Bend Allowance — the arc length of the neutral axis through the bend zone.
 * BA = (π/180) × angleDeg × (r + k × t)
 *
 * @param angleDeg  Bend angle in degrees
 * @param radius    Inside bend radius (mm)
 * @param kFactor   Position of neutral axis (0–1)
 * @param thickness Material thickness (mm)
 */
export function calculateBendAllowance(
  angleDeg: number,
  radius: number,
  kFactor: number,
  thickness: number
): number {
  return (Math.PI / 180) * angleDeg * (radius + kFactor * thickness);
}

/**
 * Bend Deduction — the difference between the sum of flange lengths
 * and the flat pattern length.
 * BD = 2 × (r + t) × tan(angle/2) − BA
 */
export function calculateBendDeduction(
  angleDeg: number,
  radius: number,
  kFactor: number,
  thickness: number
): number {
  const ba = calculateBendAllowance(angleDeg, radius, kFactor, thickness);
  const angleRad = (angleDeg * Math.PI) / 180;
  return 2 * (radius + thickness) * Math.tan(angleRad / 2) - ba;
}

/**
 * Outside Setback — distance from the tangent point to the apex of the bend.
 * OSSB = (r + t) × tan(angle/2)
 */
export function calculateOutsideSetback(
  angleDeg: number,
  radius: number,
  thickness: number
): number {
  const angleRad = (angleDeg * Math.PI) / 180;
  return (radius + thickness) * Math.tan(angleRad / 2);
}
