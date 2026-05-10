// ─────────────────────────────────────────────────────────
// Pricing Engine — Shared Types
// ─────────────────────────────────────────────────────────

export type DXFIntent = "cut" | "bend" | "ignore";

export interface DXFPath {
  id: string;
  layer: string;
  color?: string;
  svgPath: string;
  length: number;
  isClosed: boolean;
  intent?: DXFIntent;
}

export interface DXFLayer {
  name: string;
  color: string;
  entityCount: number;
  intent?: DXFIntent;
}

export interface DXFData {
  layers: DXFLayer[];
  paths: DXFPath[];
  minX: number;
  minY: number;
}

/** Geometry extracted from a STEP or DXF file */
export interface PricingGeometry {
  /** Source format */
  inputType: "step" | "dxf";
  /** Flat pattern bounding box dimensions (mm) */
  boundingWidth: number;
  boundingHeight: number;
  /** Net part area (mm²) — planar face area or polygon area */
  partArea: number;
  /** Total outer + inner cut length (mm) */
  perimeter: number;
  /** Number of holes / internal cutouts */
  pierceCount: number;
  /** Number of bends (STEP only, 0 for DXF) */
  bendCount: number;
  /** Individual bend angles in degrees (STEP only) */
  bendAngles: number[];
  /** Detected thickness (mm) — STEP only; user-specified for DXF */
  thickness: number;
  /** Whether thickness was detected automatically or requires user input */
  thicknessConfidence: "detected" | "required";
  /** Optional detailed DXF geometry for rendering and layer toggling */
  dxfData?: DXFData;
}

/** Pricing inputs provided by the user */
export interface PricingInput {
  geometry: PricingGeometry;
  /** Cost per kg of material (£) */
  materialCostPerKg: number;
  /** Material density (kg/m³) */
  materialDensityKgM3: number;
  /** Scrap value per kg (£) */
  scrapValuePerKg: number;
  /** Machine hourly rate (£/hr) */
  machineHourlyRate: number;
  /** Cut feed rate (mm/min) — from lookup table or user override */
  feedRateMmPerMin: number;
  /** Pierce time per hole (seconds) */
  pierceTimeSeconds: number;
  /** Setup time (minutes) — amortised over quantity */
  setupTimeMinutes: number;
  /** Cost per press-brake bend (£) */
  costPerBend: number;
  /** Number of parts to produce */
  quantity: number;
  /** Markup percentage (e.g. 15 = 15%) */
  markupPercent: number;
  /** Waste / yield factor (e.g. 1.15 = 15% nesting waste) */
  wasteFactor: number;
  /** Thickness override in mm (used when thicknessConfidence = 'required') */
  thicknessOverride?: number;
}

/** Detailed cost breakdown */
export interface PricingResult {
  /** Effective thickness used (mm) */
  thicknessMm: number;
  /** Gross sheet area required per part including waste (mm²) */
  sheetAreaPerPartMm2: number;
  /** Material volume per part (mm³) */
  volumeMm3: number;
  /** Material weight per part (kg) */
  weightKg: number;
  /** Raw material cost per part (£) */
  materialCostPerPart: number;
  /** Cut time per part (minutes) */
  cutTimeMinutes: number;
  /** Cutting cost per part (£) */
  cuttingCostPerPart: number;
  /** Bending cost per part (£) */
  bendingCostPerPart: number;
  /** Setup cost (£) — total, not per part */
  setupCostTotal: number;
  /** Setup cost amortised per part (£) */
  setupCostPerPart: number;
  /** Net cost per part before markup (£) */
  netCostPerPart: number;
  /** Unit price per part after markup (£) */
  unitPrice: number;
  /** Total price for all quantity (£) */
  totalPrice: number;
  /** Effective markup applied (%) */
  markupPercent: number;
  /** Notes / warnings */
  warnings: string[];
}

export interface PriceBreak {
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  materialCostPerPart: number;
  cuttingCostPerPart: number;
  bendingCostPerPart: number;
  setupCostPerPart: number;
  setupCostTotal: number;
  leadTime?: string;
  /** Manual overrides for this specific break */
  overrides: {
    material: number | null;
    cutting: number | null;
    bending: number | null;
    setup: number | null;
    markup: number | null;
  };
}

// ─────────────────────────────────────────────────────────
// Nesting Engine Types
// ─────────────────────────────────────────────────────────

/** Configuration for the nesting algorithm */
export interface NestingConfig {
  /** Gap between parts in mm (kerf + handling clearance) */
  kerfGapMm: number;
  /** Allow 90° rotation of parts */
  allowRotation: boolean;
  /** Material grain direction locked (prevents rotation) */
  grainLocked: boolean;
}

/** A single part placed on a sheet */
export interface SheetPlacement {
  /** Part item ID (matches QuoteItem.id) */
  partId: string;
  /** Filename of the placed part */
  filename: string;
  /** X position on sheet (mm, from left edge) */
  x: number;
  /** Y position on sheet (mm, from bottom edge) */
  y: number;
  /** Part bounding width after rotation */
  width: number;
  /** Part bounding height after rotation */
  height: number;
  /** Whether the part was rotated 90° */
  rotated: boolean;
  /** SVG path data for the part outline (if DXF) */
  svgPaths?: string[];
  /** Original part bounding box (before rotation) */
  originalWidth: number;
  originalHeight: number;
}

/** Layout of a single sheet */
export interface SheetLayout {
  /** Sheet index (0-based) */
  index: number;
  /** Sheet dimensions */
  sheetWidth: number;
  sheetHeight: number;
  /** Parts placed on this sheet */
  placements: SheetPlacement[];
  /** Utilisation percentage (0-100) */
  utilisation: number;
  /** Used area in mm² */
  usedArea: number;
  /** Scrap area in mm² */
  scrapArea: number;
}

/** A remnant from the scrap rack that could fit the job */
export interface RemnantCandidate {
  id: string;
  width: number;
  height: number;
  thickness: number;
  location: string | null;
  materialName: string;
  /** How many parts fit on this remnant */
  partsFit: number;
  /** Estimated material cost savings vs. new sheet */
  savingsEstimate: number;
}

/** Full result from the nesting engine */
export interface NestingResult {
  /** Per-sheet layouts */
  sheets: SheetLayout[];
  /** Total number of sheets required */
  totalSheets: number;
  /** Overall utilisation (%) */
  overallUtilisation: number;
  /** Total material area used (mm²) */
  totalUsedArea: number;
  /** Total scrap area (mm²) */
  totalScrapArea: number;
  /** Remnant candidates from scrap rack */
  remnantCandidates: RemnantCandidate[];
  /** Effective waste factor (for cost model) */
  effectiveWasteFactor: number;
  /** Cost per sheet if available */
  costPerSheet: number | null;
  /** Total material cost based on nesting */
  totalMaterialCost: number | null;
}
