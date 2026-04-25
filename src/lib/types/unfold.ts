// ─────────────────────────────────────────────────────────
// Mechlytix Sheet — Unfold Data Types
// Shared contract between WebWorker kernel and R3F renderer
// ─────────────────────────────────────────────────────────

/** Geometry data for a single flange face */
export interface FlangeGeometry {
  /** Flange extent along its local X axis (mm) */
  width: number;
  /** Flange extent along its local Z axis (mm) */
  height: number;
  /** Material thickness along Y (mm) */
  thickness: number;
  // Future: raw tessellated buffers from the kernel
  vertices?: Float32Array;
  indices?: Uint32Array;
  normals?: Float32Array;
}

/** Properties of a cylindrical bend feature */
export interface BendProperties {
  axisOrigin: [number, number, number];
  axisDirection: [number, number, number];
  /** Bend angle in radians (positive = fold from flat) */
  angle: number;
  /** Inside bend radius in mm */
  radius: number;
  /** Material K-factor coefficient */
  kFactor: number;
  /** Material thickness in mm */
  thickness: number;
  /** Computed bend allowance in mm */
  bendAllowance: number;
  /** Width of the bend zone along the bend axis (mm) — the depth of the part at the bend */
  bendWidth: number;
}

/** A cylindrical bend connecting a parent flange to a child flange */
export interface BendTransition {
  id: string;
  parentFlangeId: string;
  childFlange: FlangeNode;
  properties: BendProperties;
}

/** A single planar flange in the unfold tree */
export interface FlangeNode {
  id: string;
  label: string;
  geometry: FlangeGeometry;
  /** Center position relative to parent hinge group [x, y, z] */
  localPosition: [number, number, number];
  connectedBends: BendTransition[];
}

/** Root data structure for the entire unfold hierarchy */
export interface UnfoldTree {
  rootFlange: FlangeNode;
  metadata: {
    partName: string;
    totalFlanges: number;
    totalBends: number;
    materialName: string;
    kFactor: number;
    thickness: number;
    boundingBox: {
      min: [number, number, number];
      max: [number, number, number];
    };
    flatPatternDimensions: {
      width: number;
      height: number;
    };
  };
}

/** Material preset with K-factor and display properties */
export interface MaterialPreset {
  name: string;
  kFactor: number;
  color: string;
  metalness: number;
  roughness: number;
}

export const MATERIAL_PRESETS: MaterialPreset[] = [
  { name: "Mild Steel", kFactor: 0.446, color: "#7A8B9A", metalness: 0.85, roughness: 0.35 },
  { name: "304 Stainless", kFactor: 0.45, color: "#B8C4CE", metalness: 0.92, roughness: 0.2 },
  { name: "6061 Aluminum", kFactor: 0.41, color: "#C8CDD2", metalness: 0.88, roughness: 0.25 },
  { name: "Soft Brass", kFactor: 0.35, color: "#C9A84C", metalness: 0.9, roughness: 0.3 },
  { name: "Copper", kFactor: 0.35, color: "#B87333", metalness: 0.95, roughness: 0.2 },
];
