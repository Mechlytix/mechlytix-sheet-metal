import { UnfoldTree } from "../types/unfold";
import { calculateBendAllowance } from "../animation/bend-allowance";

// ─────────────────────────────────────────────────────────
// Mock L-Bracket: 2 flanges, 1 × 90° bend
//
// Side view (folded):            When unfolded:
//
//   ┌──────────┐                 ┌─────────┬─BA─┬──────────┐
//   │ Flange 2 │  (Wall: 60mm)  │ Flange 1│bend│ Flange 2 │
//   │  (Wall)  │                 │ (Base)  │zone│  (Wall)  │
//   └──────────┤                 └─────────┴────┴──────────┘
//              │ ← 90° bend
//   ┌──────────┘
//   │ Flange 1     (Base: 100mm, depth 50mm)
//   └─────────────────────────
//
// Coordinate system:
//   X = width direction (left→right)
//   Y = vertical (up), also the fold rotation plane
//   Z = depth direction (into screen)
//
// The bend axis runs along Z at x=100.
// The hinge group is placed at axisOrigin = [100, 0, 0].
// When folded (progress=0), the child rotates π/2 around Z,
// lifting it up into the Y direction.
// ─────────────────────────────────────────────────────────

const THICKNESS = 2; // mm
const DEFAULT_K_FACTOR = 0.446; // Mild Steel
const BEND_RADIUS = 3; // mm inside radius
const BEND_ANGLE_DEG = 90;
const BEND_ANGLE_RAD = Math.PI / 2;
const DEPTH = 50; // mm (Z extent)

export function createLBracketMock(kFactor = DEFAULT_K_FACTOR): UnfoldTree {
  const ba = calculateBendAllowance(
    BEND_ANGLE_DEG,
    BEND_RADIUS,
    kFactor,
    THICKNESS
  );

  // Child flange (Wall): 60mm tall, 50mm deep, 2mm thick
  // When folded: rotated 90° around Z at the bend line,
  //   so its 60mm extends upward (Y).
  // localPosition is relative to hinge origin.
  // The child center is at half-width along the "up" direction
  // after the fold rotation is applied. But since the HingeGroup
  // applies the fold rotation to the child, localPosition is
  // expressed in the *child's* local (pre-rotation) frame:
  //   x = 30 (half of 60mm width, extending away from hinge)
  //   y = 0  (on the surface)
  //   z = 25 (centered in depth)
  const childFlange = {
    id: "flange-2",
    label: "Wall",
    geometry: { width: 60, height: DEPTH, thickness: THICKNESS },
    localPosition: [30, 0, 25] as [number, number, number],
    connectedBends: [],
  };

  const bend = {
    id: "bend-1",
    parentFlangeId: "flange-1",
    childFlange,
    properties: {
      axisOrigin: [100, 0, 0] as [number, number, number],
      axisDirection: [0, 0, 1] as [number, number, number],
      angle: BEND_ANGLE_RAD,
      radius: BEND_RADIUS,
      kFactor,
      thickness: THICKNESS,
      bendAllowance: ba,
      bendWidth: DEPTH,
    },
  };

  const rootFlange = {
    id: "flange-1",
    label: "Base",
    geometry: { width: 100, height: DEPTH, thickness: THICKNESS },
    localPosition: [50, 0, 25] as [number, number, number],
    connectedBends: [bend],
  };

  return {
    rootFlange,
    metadata: {
      partName: "L-Bracket",
      totalFlanges: 2,
      totalBends: 1,
      materialName: "Mild Steel",
      kFactor,
      thickness: THICKNESS,
      boundingBox: {
        min: [0, -1, 0],
        max: [100, 60, 50],
      },
      flatPatternDimensions: {
        width: Math.round((100 + ba + 60) * 100) / 100,
        height: DEPTH,
      },
    },
  };
}

// ─────────────────────────────────────────────────────────
// Mock U-Channel: 3 flanges, 2 × 90° bends
//
// Front view (folded):
//
//   ┌───┐         ┌───┐
//   │ F3│         │ F2│   (Both walls: 40mm tall)
//   │   │         │   │
//   └───┤         ├───┘
//       │ bend-2  │ bend-1
//       └─────────┘
//        Flange 1       (Base: 80mm wide)
//
// Bend-1 axis at x=80, direction [0,0,1]  (right edge)
// Bend-2 axis at x=0,  direction [0,0,-1] (left edge, flipped)
// ─────────────────────────────────────────────────────────

export function createUChannelMock(kFactor = DEFAULT_K_FACTOR): UnfoldTree {
  const ba = calculateBendAllowance(
    BEND_ANGLE_DEG,
    BEND_RADIUS,
    kFactor,
    THICKNESS
  );

  const rightWall = {
    id: "flange-2",
    label: "Right Wall",
    geometry: { width: 40, height: DEPTH, thickness: THICKNESS },
    // Relative to hinge at x=80: extends 40mm outward
    localPosition: [20, 0, 25] as [number, number, number],
    connectedBends: [],
  };

  const leftWall = {
    id: "flange-3",
    label: "Left Wall",
    geometry: { width: 40, height: DEPTH, thickness: THICKNESS },
    // Relative to hinge at x=0: extends 40mm outward in -X
    // The negative angle rotates the opposite way, lifting the wall up
    localPosition: [-20, 0, 0] as [number, number, number],
    connectedBends: [],
  };

  const bendRight = {
    id: "bend-1",
    parentFlangeId: "flange-1",
    childFlange: rightWall,
    properties: {
      axisOrigin: [80, 0, 0] as [number, number, number],
      axisDirection: [0, 0, 1] as [number, number, number],
      angle: BEND_ANGLE_RAD,
      radius: BEND_RADIUS,
      kFactor,
      thickness: THICKNESS,
      bendAllowance: ba,
      bendWidth: DEPTH,
    },
  };

  const bendLeft = {
    id: "bend-2",
    parentFlangeId: "flange-1",
    childFlange: leftWall,
    properties: {
      axisOrigin: [0, 0, 0] as [number, number, number],
      // Same axis as right bend, but negative angle folds opposite direction
      axisDirection: [0, 0, 1] as [number, number, number],
      angle: -BEND_ANGLE_RAD,
      radius: BEND_RADIUS,
      kFactor,
      thickness: THICKNESS,
      bendAllowance: ba,
      bendWidth: DEPTH,
    },
  };

  const rootFlange = {
    id: "flange-1",
    label: "Base",
    geometry: { width: 80, height: DEPTH, thickness: THICKNESS },
    localPosition: [40, 0, 25] as [number, number, number],
    connectedBends: [bendRight, bendLeft],
  };

  return {
    rootFlange,
    metadata: {
      partName: "U-Channel",
      totalFlanges: 3,
      totalBends: 2,
      materialName: "Mild Steel",
      kFactor,
      thickness: THICKNESS,
      boundingBox: {
        min: [0, -1, 0],
        max: [80, 40, 50],
      },
      flatPatternDimensions: {
        width: Math.round((40 + ba + 80 + ba + 40) * 100) / 100,
        height: DEPTH,
      },
    },
  };
}

export function generateMockDXF(activePartId: string, kFactor = DEFAULT_K_FACTOR): string {
  const ba = calculateBendAllowance(
    BEND_ANGLE_DEG,
    BEND_RADIUS,
    kFactor,
    THICKNESS
  );
  
  let w = 0;
  const h = DEPTH;
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number; layer: string }> = [];

  if (activePartId === "u-channel") {
    w = 40 + ba + 80 + ba + 40;
    
    // Outer boundaries
    lines.push({ x1: 0, y1: 0, x2: w, y2: 0, layer: "CUT_OUTER" });
    lines.push({ x1: w, y1: 0, x2: w, y2: h, layer: "CUT_OUTER" });
    lines.push({ x1: w, y1: h, x2: 0, y2: h, layer: "CUT_OUTER" });
    lines.push({ x1: 0, y1: h, x2: 0, y2: 0, layer: "CUT_OUTER" });

    // Bend centerlines
    lines.push({ x1: 40 + ba / 2, y1: 0, x2: 40 + ba / 2, y2: h, layer: "BEND_DOWN" });
    lines.push({ x1: 40 + ba + 80 + ba / 2, y1: 0, x2: 40 + ba + 80 + ba / 2, y2: h, layer: "BEND_UP" });
  } else {
    // default/l-bracket
    w = 100 + ba + 60;

    // Outer boundaries
    lines.push({ x1: 0, y1: 0, x2: w, y2: 0, layer: "CUT_OUTER" });
    lines.push({ x1: w, y1: 0, x2: w, y2: h, layer: "CUT_OUTER" });
    lines.push({ x1: w, y1: h, x2: 0, y2: h, layer: "CUT_OUTER" });
    lines.push({ x1: 0, y1: h, x2: 0, y2: 0, layer: "CUT_OUTER" });

    // Bend centerline
    lines.push({ x1: 100 + ba / 2, y1: 0, x2: 100 + ba / 2, y2: h, layer: "BEND_UP" });
  }

  // Generate DXF string using vanilla format
  let dxf = "";
  dxf += "  0\nSECTION\n  2\nHEADER\n  0\nENDSEC\n";
  dxf += "  0\nSECTION\n  2\nTABLES\n  0\nTABLE\n  2\nLTYPE\n 70\n1\n";
  dxf += "  0\nLTYPE\n  2\nCONTINUOUS\n 70\n0\n  3\nSolid line\n 72\n65\n 73\n0\n 40\n0.0\n";
  dxf += "  0\nENDTAB\n";
  
  dxf += "  0\nTABLE\n  2\nLAYER\n 70\n4\n";
  dxf += "  0\nLAYER\n  2\nCUT_OUTER\n 70\n0\n 62\n1\n  6\nCONTINUOUS\n";
  dxf += "  0\nLAYER\n  2\nCUT_INNER\n 70\n0\n 62\n2\n  6\nCONTINUOUS\n";
  dxf += "  0\nLAYER\n  2\nBEND_UP\n 70\n0\n 62\n3\n  6\nCONTINUOUS\n";
  dxf += "  0\nLAYER\n  2\nBEND_DOWN\n 70\n0\n 62\n6\n  6\nCONTINUOUS\n";
  dxf += "  0\nENDTAB\n  0\nENDSEC\n";
  
  dxf += "  0\nSECTION\n  2\nBLOCKS\n  0\nENDSEC\n";
  dxf += "  0\nSECTION\n  2\nENTITIES\n";
  
  for (const line of lines) {
    dxf += `  0\nLINE\n  8\n${line.layer}\n`;
    dxf += ` 10\n${line.x1.toFixed(4)}\n 20\n${line.y1.toFixed(4)}\n 30\n0.0\n`;
    dxf += ` 11\n${line.x2.toFixed(4)}\n 21\n${line.y2.toFixed(4)}\n 31\n0.0\n`;
  }
  
  dxf += "  0\nENDSEC\n  0\nEOF\n";
  return dxf;
}

