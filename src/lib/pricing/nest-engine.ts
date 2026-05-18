// ─────────────────────────────────────────────────────────
// Nesting Engine — Shelf-Based Bin Packing with Rotation
// Pure function: parts + sheet → NestingResult
// ─────────────────────────────────────────────────────────

import type {
  NestingConfig,
  NestingResult,
  SheetLayout,
  SheetPlacement,
  RemnantCandidate,
} from "./types";

/** Input part to nest */
export interface NestingPart {
  id: string;
  filename: string;
  /** Bounding box width (mm) */
  width: number;
  /** Bounding box height (mm) */
  height: number;
  /** Part area (mm²) — for utilisation calc */
  area: number;
  /** Quantity needed */
  quantity: number;
  /** SVG path data for visual outline (DXF only) */
  svgPaths?: string[];
  /** DXF bounding box origin (for normalising path coords) */
  svgMinX?: number;
  svgMinY?: number;
}

/** Sheet to nest onto */
export interface NestingSheet {
  width: number;
  height: number;
  costPerSheet: number | null;
}

/** Remnant available from scrap rack */
export interface AvailableRemnant {
  id: string;
  width: number;
  height: number;
  thickness: number;
  location: string | null;
  materialName: string;
}

// ─── Shelf-Based Packing ────────────────────────────────

interface Shelf {
  y: number;        // Bottom edge Y
  height: number;   // Shelf height (tallest part)
  usedWidth: number; // How far along X we've packed
}

interface PartInstance {
  part: NestingPart;
  instanceIndex: number;
}

/**
 * Core nesting function using a shelf-based best-fit-decreasing algorithm.
 * 
 * Algorithm:
 * 1. Expand all parts × quantities into individual instances
 * 2. Sort by height descending (best-fit-decreasing heuristic)
 * 3. For each instance, try to place on existing shelves (best-fit)
 * 4. If rotation is allowed, try rotated orientation too
 * 5. If no shelf fits, start a new shelf; if sheet is full, start a new sheet
 */
export function nestParts(
  parts: NestingPart[],
  sheet: NestingSheet,
  config: NestingConfig,
  remnants: AvailableRemnant[] = [],
): NestingResult {
  const gap = config.kerfGapMm;
  const canRotate = config.allowRotation && !config.grainLocked;

  // 1. Expand parts into individual instances
  const instances: PartInstance[] = [];
  for (const part of parts) {
    for (let i = 0; i < part.quantity; i++) {
      instances.push({ part, instanceIndex: i });
    }
  }

  if (instances.length === 0) {
    return emptyResult(sheet);
  }

  // 2. Sort by height descending (best-fit-decreasing)
  instances.sort((a, b) => {
    const aH = canRotate ? Math.max(a.part.height, a.part.width) : a.part.height;
    const bH = canRotate ? Math.max(b.part.height, b.part.width) : b.part.height;
    return bH - aH;
  });

  // 3. Pack onto sheets
  const sheets: SheetLayout[] = [];
  let currentShelves: Shelf[] = [];
  let currentPlacements: SheetPlacement[] = [];

  function startNewSheet() {
    if (currentPlacements.length > 0) {
      sheets.push(buildSheetLayout(sheets.length, sheet, currentPlacements));
    }
    currentShelves = [];
    currentPlacements = [];
  }

  function tryPlace(
    inst: PartInstance,
    w: number,
    h: number,
    rotated: boolean,
  ): boolean {
    const partW = w + gap;
    const partH = h + gap;

    // Try to fit on existing shelves (best-fit: smallest remaining space)
    let bestShelfIdx = -1;
    let bestRemaining = Infinity;

    for (let i = 0; i < currentShelves.length; i++) {
      const s = currentShelves[i];
      const remainingW = sheet.width - s.usedWidth;
      const remainingH = s.height;

      if (partW <= remainingW + 0.01 && h <= remainingH + 0.01) {
        const rem = remainingW - partW;
        if (rem < bestRemaining) {
          bestRemaining = rem;
          bestShelfIdx = i;
        }
      }
    }

    if (bestShelfIdx >= 0) {
      const s = currentShelves[bestShelfIdx];
      currentPlacements.push({
        partId: inst.part.id,
        filename: inst.part.filename,
        x: s.usedWidth,
        y: s.y,
        width: w,
        height: h,
        rotated,
        svgPaths: inst.part.svgPaths,
        originalWidth: inst.part.width,
        originalHeight: inst.part.height,
        svgMinX: inst.part.svgMinX,
        svgMinY: inst.part.svgMinY,
      });
      s.usedWidth += partW;
      return true;
    }

    // Try to start a new shelf on the current sheet
    const shelfY =
      currentShelves.length === 0
        ? 0
        : currentShelves[currentShelves.length - 1].y +
          currentShelves[currentShelves.length - 1].height +
          gap;

    if (shelfY + h <= sheet.height + 0.01 && w <= sheet.width + 0.01) {
      currentShelves.push({ y: shelfY, height: h, usedWidth: partW });
      currentPlacements.push({
        partId: inst.part.id,
        filename: inst.part.filename,
        x: 0,
        y: shelfY,
        width: w,
        height: h,
        rotated,
        svgPaths: inst.part.svgPaths,
        originalWidth: inst.part.width,
        originalHeight: inst.part.height,
        svgMinX: inst.part.svgMinX,
        svgMinY: inst.part.svgMinY,
      });
      return true;
    }

    return false;
  }

  for (const inst of instances) {
    const pw = inst.part.width;
    const ph = inst.part.height;

    let placed = false;

    // Try original orientation first
    placed = tryPlace(inst, pw, ph, false);

    // Try rotated if allowed and not placed
    if (!placed && canRotate && Math.abs(pw - ph) > 0.1) {
      placed = tryPlace(inst, ph, pw, true);
    }

    // If still not placed, start a new sheet and try again
    if (!placed) {
      startNewSheet();
      placed = tryPlace(inst, pw, ph, false);
      if (!placed && canRotate && Math.abs(pw - ph) > 0.1) {
        placed = tryPlace(inst, ph, pw, true);
      }
      // If STILL not placed, the part is too big for the sheet
      if (!placed) {
        // Place it anyway (will show as overflowing — user should pick larger sheet)
        currentPlacements.push({
          partId: inst.part.id,
          filename: inst.part.filename,
          x: 0,
          y: 0,
          width: pw,
          height: ph,
          rotated: false,
          svgPaths: inst.part.svgPaths,
          originalWidth: pw,
          originalHeight: ph,
          svgMinX: inst.part.svgMinX,
          svgMinY: inst.part.svgMinY,
        });
        currentShelves.push({ y: 0, height: ph, usedWidth: pw + gap });
      }
    }
  }

  // Finalize the last sheet
  if (currentPlacements.length > 0) {
    sheets.push(buildSheetLayout(sheets.length, sheet, currentPlacements));
  }

  // 4. Check remnants
  const remnantCandidates = findRemnantCandidates(parts, remnants, config, sheet);

  // 5. Compute overall stats
  const totalSheetArea = sheets.length * sheet.width * sheet.height;
  const totalUsedArea = sheets.reduce((sum, s) => sum + s.usedArea, 0);
  const totalScrapArea = totalSheetArea - totalUsedArea;
  const overallUtilisation =
    totalSheetArea > 0 ? (totalUsedArea / totalSheetArea) * 100 : 0;

  // Effective waste factor: total sheet area / total part area
  const totalPartArea = instances.reduce((sum, i) => sum + i.part.area, 0);
  const effectiveWasteFactor =
    totalPartArea > 0 ? totalSheetArea / totalPartArea : 1.15;

  const totalMaterialCost =
    sheet.costPerSheet != null ? sheets.length * sheet.costPerSheet : null;

  return {
    sheets,
    totalSheets: sheets.length,
    overallUtilisation: Math.round(overallUtilisation * 10) / 10,
    totalUsedArea,
    totalScrapArea,
    remnantCandidates,
    effectiveWasteFactor: Math.round(effectiveWasteFactor * 1000) / 1000,
    costPerSheet: sheet.costPerSheet,
    totalMaterialCost,
  };
}

// ─── Helper Functions ───────────────────────────────────

function buildSheetLayout(
  index: number,
  sheet: NestingSheet,
  placements: SheetPlacement[],
): SheetLayout {
  const sheetArea = sheet.width * sheet.height;
  const usedArea = placements.reduce((sum, p) => sum + p.width * p.height, 0);
  const scrapArea = sheetArea - usedArea;
  const utilisation = sheetArea > 0 ? (usedArea / sheetArea) * 100 : 0;

  return {
    index,
    sheetWidth: sheet.width,
    sheetHeight: sheet.height,
    placements: [...placements],
    utilisation: Math.round(utilisation * 10) / 10,
    usedArea,
    scrapArea,
  };
}

function emptyResult(sheet: NestingSheet): NestingResult {
  return {
    sheets: [],
    totalSheets: 0,
    overallUtilisation: 0,
    totalUsedArea: 0,
    totalScrapArea: 0,
    remnantCandidates: [],
    effectiveWasteFactor: 1.15,
    costPerSheet: sheet.costPerSheet,
    totalMaterialCost: null,
  };
}

/**
 * Check if available remnants from the scrap rack could fit any of the parts.
 * Uses simple bounding-box check.
 */
function findRemnantCandidates(
  parts: NestingPart[],
  remnants: AvailableRemnant[],
  config: NestingConfig,
  sheet: NestingSheet,
): RemnantCandidate[] {
  const gap = config.kerfGapMm;
  const canRotate = config.allowRotation && !config.grainLocked;
  const candidates: RemnantCandidate[] = [];

  for (const rem of remnants) {
    let totalFit = 0;

    for (const part of parts) {
      const fit = countPartsOnSheet(
        part.width,
        part.height,
        rem.width,
        rem.height,
        gap,
        canRotate,
      );
      totalFit += Math.min(fit, part.quantity);
    }

    if (totalFit > 0) {
      // Estimate savings: remnant is "free" material vs. buying a new sheet
      const savings = sheet.costPerSheet
        ? sheet.costPerSheet * (totalFit / Math.max(parts.reduce((s, p) => s + p.quantity, 0), 1))
        : 0;

      candidates.push({
        id: rem.id,
        width: rem.width,
        height: rem.height,
        thickness: rem.thickness,
        location: rem.location,
        materialName: rem.materialName,
        partsFit: totalFit,
        savingsEstimate: Math.round(savings * 100) / 100,
      });
    }
  }

  // Sort by most parts fitting
  candidates.sort((a, b) => b.partsFit - a.partsFit);
  return candidates;
}

/**
 * Quick count of how many parts fit on a given rectangular area using strip packing.
 */
function countPartsOnSheet(
  partW: number,
  partH: number,
  sheetW: number,
  sheetH: number,
  gap: number,
  canRotate: boolean,
): number {
  const pw = partW + gap;
  const ph = partH + gap;

  // Original orientation
  const cols1 = Math.floor((sheetW + gap) / pw);
  const rows1 = Math.floor((sheetH + gap) / ph);
  let best = cols1 * rows1;

  // Rotated orientation
  if (canRotate && Math.abs(partW - partH) > 0.1) {
    const cols2 = Math.floor((sheetW + gap) / ph);
    const rows2 = Math.floor((sheetH + gap) / pw);
    best = Math.max(best, cols2 * rows2);
  }

  return best;
}
