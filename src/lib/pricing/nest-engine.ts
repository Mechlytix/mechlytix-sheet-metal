// ─────────────────────────────────────────────────────────
// Nesting Engine — Multi-Algorithm Bin Packing
// Supports: Shelf BFD, Guillotine, Strip Packing
// Pure function: parts + sheet + config → NestingResult
// ─────────────────────────────────────────────────────────

import type {
  NestingConfig,
  NestingAlgorithm,
  NestingSortOrder,
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

// ─── Shared Types ───────────────────────────────────────

interface PartInstance {
  part: NestingPart;
  instanceIndex: number;
}

interface PlacedPart {
  inst: PartInstance;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

// ─── Shared Helpers ─────────────────────────────────────

function makePlacement(inst: PartInstance, x: number, y: number, w: number, h: number, rotated: boolean): SheetPlacement {
  return {
    partId: inst.part.id,
    filename: inst.part.filename,
    x, y, width: w, height: h, rotated,
    svgPaths: inst.part.svgPaths,
    originalWidth: inst.part.width,
    originalHeight: inst.part.height,
    svgMinX: inst.part.svgMinX,
    svgMinY: inst.part.svgMinY,
  };
}

function sortInstances(instances: PartInstance[], sortOrder: NestingSortOrder, canRotate: boolean): PartInstance[] {
  return [...instances].sort((a, b) => {
    switch (sortOrder) {
      case "area":
        return b.part.area - a.part.area;
      case "width":
        return (canRotate ? Math.max(b.part.width, b.part.height) : b.part.width)
             - (canRotate ? Math.max(a.part.width, a.part.height) : a.part.width);
      case "height":
      default:
        return (canRotate ? Math.max(b.part.height, b.part.width) : b.part.height)
             - (canRotate ? Math.max(a.part.height, a.part.width) : a.part.height);
    }
  });
}

function tryOrientations(pw: number, ph: number, canRotate: boolean): Array<{ w: number; h: number; rotated: boolean }> {
  const orientations: Array<{ w: number; h: number; rotated: boolean }> = [{ w: pw, h: ph, rotated: false }];
  if (canRotate && Math.abs(pw - ph) > 0.1) {
    orientations.push({ w: ph, h: pw, rotated: true });
  }
  return orientations;
}

// ─── Algorithm 1: Shelf Best-Fit Decreasing ─────────────

interface Shelf {
  y: number;
  height: number;
  usedWidth: number;
}

function packShelf(
  instances: PartInstance[],
  sheet: NestingSheet,
  gap: number,
  canRotate: boolean,
): SheetLayout[][] {
  const sheets: SheetLayout[][] = [];
  let currentShelves: Shelf[] = [];
  let currentPlacements: SheetPlacement[] = [];

  function flush() {
    if (currentPlacements.length > 0) {
      sheets.push([...currentPlacements] as unknown as SheetLayout[]);
    }
    currentShelves = [];
    currentPlacements = [];
  }

  function tryPlace(inst: PartInstance, w: number, h: number, rotated: boolean): boolean {
    const partW = w + gap;
    const partH = h + gap;

    // Best-fit: find shelf with smallest remaining space that fits
    let bestIdx = -1;
    let bestRem = Infinity;
    for (let i = 0; i < currentShelves.length; i++) {
      const s = currentShelves[i];
      const remW = sheet.width - s.usedWidth;
      if (partW <= remW + 0.01 && h <= s.height + 0.01) {
        const rem = remW - partW;
        if (rem < bestRem) { bestRem = rem; bestIdx = i; }
      }
    }
    if (bestIdx >= 0) {
      const s = currentShelves[bestIdx];
      currentPlacements.push(makePlacement(inst, s.usedWidth, s.y, w, h, rotated));
      s.usedWidth += partW;
      return true;
    }

    // New shelf
    const shelfY = currentShelves.length === 0
      ? 0
      : currentShelves[currentShelves.length - 1].y + currentShelves[currentShelves.length - 1].height + gap;

    if (shelfY + h <= sheet.height + 0.01 && w <= sheet.width + 0.01) {
      currentShelves.push({ y: shelfY, height: h, usedWidth: partW });
      currentPlacements.push(makePlacement(inst, 0, shelfY, w, h, rotated));
      return true;
    }
    return false;
  }

  for (const inst of instances) {
    let placed = false;
    for (const { w, h, rotated } of tryOrientations(inst.part.width, inst.part.height, canRotate)) {
      if (tryPlace(inst, w, h, rotated)) { placed = true; break; }
    }
    if (!placed) {
      flush();
      for (const { w, h, rotated } of tryOrientations(inst.part.width, inst.part.height, canRotate)) {
        if (tryPlace(inst, w, h, rotated)) { placed = true; break; }
      }
      if (!placed) {
        // Part too big — force-place at origin
        const { w, h } = tryOrientations(inst.part.width, inst.part.height, canRotate)[0];
        currentPlacements.push(makePlacement(inst, 0, 0, w, h, false));
        currentShelves.push({ y: 0, height: h, usedWidth: w + gap });
      }
    }
  }
  flush();
  return sheets;
}

// ─── Algorithm 2: Guillotine ────────────────────────────

interface FreeRect { x: number; y: number; w: number; h: number; }

function packGuillotine(
  instances: PartInstance[],
  sheet: NestingSheet,
  gap: number,
  canRotate: boolean,
): SheetLayout[][] {
  const allSheetPlacements: SheetLayout[][] = [];

  let freeRects: FreeRect[] = [{ x: 0, y: 0, w: sheet.width, h: sheet.height }];
  let currentPlacements: SheetPlacement[] = [];

  function flush() {
    if (currentPlacements.length > 0) {
      allSheetPlacements.push([...currentPlacements] as unknown as SheetLayout[]);
    }
    freeRects = [{ x: 0, y: 0, w: sheet.width, h: sheet.height }];
    currentPlacements = [];
  }

  function tryPlaceGuillotine(inst: PartInstance, pw: number, ph: number, rotated: boolean): boolean {
    const needW = pw + gap;
    const needH = ph + gap;

    // Find best free rect (smallest area that fits — BSSF)
    let bestIdx = -1;
    let bestArea = Infinity;
    for (let i = 0; i < freeRects.length; i++) {
      const fr = freeRects[i];
      if (needW <= fr.w + 0.01 && needH <= fr.h + 0.01) {
        const area = fr.w * fr.h;
        if (area < bestArea) { bestArea = area; bestIdx = i; }
      }
    }

    if (bestIdx < 0) return false;

    const fr = freeRects[bestIdx];
    currentPlacements.push(makePlacement(inst, fr.x, fr.y, pw, ph, rotated));

    // Guillotine split: split the used rect into two new free rects
    // Choose longer axis for the first cut (maximises larger free rect)
    const rightW = fr.w - needW;
    const topH = fr.h - needH;

    freeRects.splice(bestIdx, 1);

    if (rightW > 0.1 && fr.h > 0.1) {
      freeRects.push({ x: fr.x + needW, y: fr.y, w: rightW, h: fr.h });
    }
    if (topH > 0.1 && needW > 0.1) {
      freeRects.push({ x: fr.x, y: fr.y + needH, w: needW, h: topH });
    }

    // Also add the corner if both cuts exist
    if (rightW > 0.1 && topH > 0.1) {
      freeRects.push({ x: fr.x + needW, y: fr.y + needH, w: rightW, h: topH });
    }

    // Merge/prune dominated rects
    freeRects = freeRects.filter(r => r.w > 0.5 && r.h > 0.5);

    return true;
  }

  for (const inst of instances) {
    let placed = false;
    for (const { w, h, rotated } of tryOrientations(inst.part.width, inst.part.height, canRotate)) {
      if (tryPlaceGuillotine(inst, w, h, rotated)) { placed = true; break; }
    }
    if (!placed) {
      flush();
      for (const { w, h, rotated } of tryOrientations(inst.part.width, inst.part.height, canRotate)) {
        if (tryPlaceGuillotine(inst, w, h, rotated)) { placed = true; break; }
      }
      if (!placed) {
        const { w, h } = tryOrientations(inst.part.width, inst.part.height, canRotate)[0];
        currentPlacements.push(makePlacement(inst, 0, 0, w, h, false));
      }
    }
  }
  flush();
  return allSheetPlacements;
}

// ─── Algorithm 3: Strip Packing ─────────────────────────

function packStrip(
  instances: PartInstance[],
  sheet: NestingSheet,
  gap: number,
  canRotate: boolean,
): SheetLayout[][] {
  // Group by part ID, then lay out each group as a grid strip
  const allSheetPlacements: SheetLayout[][] = [];
  let currentPlacements: SheetPlacement[] = [];
  let curX = 0;
  let curY = 0;
  let rowHeight = 0;

  function flush() {
    if (currentPlacements.length > 0) {
      allSheetPlacements.push([...currentPlacements] as unknown as SheetLayout[]);
    }
    currentPlacements = [];
    curX = 0; curY = 0; rowHeight = 0;
  }

  function place(inst: PartInstance, pw: number, ph: number, rotated: boolean) {
    const partW = pw + gap;
    const partH = ph + gap;

    // Wrap to new row
    if (curX + partW > sheet.width + 0.01) {
      curY += rowHeight;
      curX = 0;
      rowHeight = 0;
    }

    // Wrap to new sheet
    if (curY + partH > sheet.height + 0.01) {
      flush();
    }

    currentPlacements.push(makePlacement(inst, curX, curY, pw, ph, rotated));
    curX += partW;
    rowHeight = Math.max(rowHeight, partH);
  }

  for (const inst of instances) {
    const orientations = tryOrientations(inst.part.width, inst.part.height, canRotate);
    // For strip: pick the orientation that fits best in current row, else default
    let chosen = orientations[0];
    for (const o of orientations) {
      if (o.w + gap <= sheet.width - curX) { chosen = o; break; }
    }
    place(inst, chosen.w, chosen.h, chosen.rotated);
  }
  flush();
  return allSheetPlacements;
}

// ─── Main Entry Point ───────────────────────────────────

/**
 * Core nesting function. Dispatches to the chosen algorithm.
 * Supports: shelf (BFD), guillotine (BSSF), strip (grid).
 */
export function nestParts(
  parts: NestingPart[],
  sheet: NestingSheet,
  config: NestingConfig,
  remnants: AvailableRemnant[] = [],
): NestingResult {
  const gap = config.kerfGapMm;
  const canRotate = config.allowRotation && !config.grainLocked;
  const algorithm: NestingAlgorithm = config.algorithm ?? "shelf";
  const sortOrder: NestingSortOrder = config.sortOrder ?? "height";

  // Expand parts into individual instances
  const rawInstances: PartInstance[] = [];
  for (const part of parts) {
    for (let i = 0; i < part.quantity; i++) {
      rawInstances.push({ part, instanceIndex: i });
    }
  }

  if (rawInstances.length === 0) return emptyResult(sheet);

  const instances = sortInstances(rawInstances, sortOrder, canRotate);

  // Run chosen algorithm — returns array of "packed sheets" as SheetPlacement[][]
  let packedSheets: unknown[][];
  switch (algorithm) {
    case "guillotine":
      packedSheets = packGuillotine(instances, sheet, gap, canRotate);
      break;
    case "strip":
      packedSheets = packStrip(instances, sheet, gap, canRotate);
      break;
    case "shelf":
    default:
      packedSheets = packShelf(instances, sheet, gap, canRotate);
      break;
  }

  // Convert raw placements to SheetLayouts
  const sheets: SheetLayout[] = (packedSheets as SheetPlacement[][]).map((placements, idx) =>
    buildSheetLayout(idx, sheet, placements)
  );

  // Compute stats
  const remnantCandidates = findRemnantCandidates(parts, remnants, config, sheet);
  const totalSheetArea = sheets.length * sheet.width * sheet.height;
  const totalUsedArea = sheets.reduce((sum, s) => sum + s.usedArea, 0);
  const totalScrapArea = totalSheetArea - totalUsedArea;
  const overallUtilisation = totalSheetArea > 0 ? (totalUsedArea / totalSheetArea) * 100 : 0;
  const totalPartArea = rawInstances.reduce((sum, i) => sum + i.part.area, 0);
  const effectiveWasteFactor = totalPartArea > 0 ? totalSheetArea / totalPartArea : 1.15;
  const totalMaterialCost = sheet.costPerSheet != null ? sheets.length * sheet.costPerSheet : null;

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

// ─── Helpers ────────────────────────────────────────────

function buildSheetLayout(index: number, sheet: NestingSheet, placements: SheetPlacement[]): SheetLayout {
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
      const fit = countPartsOnSheet(part.width, part.height, rem.width, rem.height, gap, canRotate);
      totalFit += Math.min(fit, part.quantity);
    }
    if (totalFit > 0) {
      const totalQty = Math.max(parts.reduce((s, p) => s + p.quantity, 0), 1);
      const savings = sheet.costPerSheet ? sheet.costPerSheet * (totalFit / totalQty) : 0;
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
  candidates.sort((a, b) => b.partsFit - a.partsFit);
  return candidates;
}

function countPartsOnSheet(partW: number, partH: number, sheetW: number, sheetH: number, gap: number, canRotate: boolean): number {
  const pw = partW + gap, ph = partH + gap;
  const cols1 = Math.floor((sheetW + gap) / pw);
  const rows1 = Math.floor((sheetH + gap) / ph);
  let best = cols1 * rows1;
  if (canRotate && Math.abs(partW - partH) > 0.1) {
    const cols2 = Math.floor((sheetW + gap) / ph);
    const rows2 = Math.floor((sheetH + gap) / pw);
    best = Math.max(best, cols2 * rows2);
  }
  return best;
}
