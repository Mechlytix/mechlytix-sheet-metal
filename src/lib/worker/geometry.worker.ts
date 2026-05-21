/* eslint-disable @typescript-eslint/no-explicit-any */
// ─────────────────────────────────────────────────────────
// Mechlytix — Geometry WebWorker
// Runs OpenCASCADE.js (WASM) off the main thread.
// Handles: STEP parsing → topology → AAG → unfold tree → tessellation
// ─────────────────────────────────────────────────────────
import * as Comlink from "comlink";
import type { UnfoldTree, FlangeNode, BendTransition } from "@/lib/types/unfold";
import { calculateBendAllowance } from "@/lib/animation/bend-allowance";

type OC = any;
let oc: OC | null = null;

// ── Caching State ────────────────────────────────────────
let cachedShape: any = null;
let cachedFaces: any[] = [];
let cachedClassified: ClassifiedFace[] = [];
let cachedAdjacency: Map<number, Set<number>> | null = null;

function clearCache() {
  if (cachedShape) {
    try {
      cachedShape.delete();
    } catch (e) {}
    cachedShape = null;
  }
  if (cachedFaces) {
    for (const face of cachedFaces) {
      try {
        face.delete();
      } catch (e) {}
    }
    cachedFaces = [];
  }
  cachedClassified = [];
  if (cachedAdjacency) {
    cachedAdjacency.clear();
    cachedAdjacency = null;
  }
}

// ── Geometry Helpers ─────────────────────────────────────

function isReversed(orientation: any): boolean {
  if (!oc) return false;
  const reversedVal = oc.TopAbs_Orientation.TopAbs_REVERSED;
  const val = typeof orientation === "object" ? orientation.value : orientation;
  const target = typeof reversedVal === "object" ? reversedVal.value : reversedVal;
  return val === target;
}

function computeLocalBasis(normal: [number, number, number]): { uBasis: [number, number, number]; vBasis: [number, number, number] } {
  const nx = normal[0], ny = normal[1], nz = normal[2];
  let ux = 0, uy = 0, uz = 0;
  // Check if normal is parallel to global Y axis [0, 1, 0]
  if (Math.abs(ny) < 0.99) {
    // U = normal x [0, 1, 0] = [nz, 0, -nx]
    const len = Math.sqrt(nz * nz + nx * nx);
    ux = nz / len;
    uy = 0;
    uz = -nx / len;
  } else {
    // U = normal x [0, 0, 1] = [ny, -nx, 0]
    const len = Math.sqrt(ny * ny + nx * nx);
    ux = ny / len;
    uy = -nx / len;
    uz = 0;
  }
  // V = normal x U
  const vx = ny * uz - nz * uy;
  const vy = nz * ux - nx * uz;
  const vz = nx * uy - ny * ux;
  // Normalize V
  const lenV = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
  return {
    uBasis: [ux, uy, uz],
    vBasis: [vx / lenV, vy / lenV, vz / lenV],
  };
}

function project3DPointTo2D(
  p3d: [number, number, number],
  centroid: [number, number, number],
  uBasis: [number, number, number],
  vBasis: [number, number, number],
  flatX: number,
  flatY: number,
  flatAngle: number
): { x: number; y: number } {
  const dx = p3d[0] - centroid[0];
  const dy = p3d[1] - centroid[1];
  const dz = p3d[2] - centroid[2];
  const u = dx * uBasis[0] + dy * uBasis[1] + dz * uBasis[2];
  const v = dx * vBasis[0] + dy * vBasis[1] + dz * vBasis[2];
  const cosA = Math.cos(flatAngle);
  const sinA = Math.sin(flatAngle);
  return {
    x: flatX + u * cosA - v * sinA,
    y: flatY + u * sinA + v * cosA,
  };
}

interface DXFLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  layer: string;
}

interface DXFArc {
  cx: number;
  cy: number;
  r: number;
  startAngle: number;
  endAngle: number;
  layer: string;
}

interface DXFCircle {
  cx: number;
  cy: number;
  r: number;
  layer: string;
}

function traverseTreeForDXF(
  node: FlangeNode,
  classified: ClassifiedFace[],
  lines: DXFLine[],
  arcs: DXFArc[],
  circles: DXFCircle[]
) {
  const flangeIdx = parseInt(node.id.replace("flange-", ""));
  const f = classified[flangeIdx];
  if (!f) return;

  const centroid = computeFaceCentroid(f.face);
  const uBasis = f.uBasis || [1, 0, 0];
  const vBasis = f.vBasis || [0, 1, 0];
  const flatX = node.flatX ?? 0;
  const flatY = node.flatY ?? 0;
  const flatAngle = node.flatAngle ?? 0;

  // Traverse wires
  const faceIter = new oc.TopoDS_Iterator_2(f.face, true, true);
  const wiresData: Array<{ edges: Array<{ type: string; data: any }>; area: number }> = [];

  while (faceIter.More()) {
    const wireShape = faceIter.Value();
    const wire = oc.TopoDS.Wire_1(wireShape);
    let wireAreaSum = 0;
    const wireEdges: Array<{ type: string; data: any }> = [];

    const edgeExp = new oc.TopExp_Explorer_2(
      wire,
      oc.TopAbs_ShapeEnum.TopAbs_EDGE,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );

    while (edgeExp.More()) {
      const edge = oc.TopoDS.Edge_1(edgeExp.Current());
      const edgeOrientation = edge.Orientation();
      const reversed = isReversed(edgeOrientation);

      const curveAdaptor = new oc.BRepAdaptor_Curve_2(edge);
      const curveType = curveAdaptor.GetType();
      const firstParam = curveAdaptor.FirstParameter();
      const lastParam = curveAdaptor.LastParameter();

      const p1 = curveAdaptor.Value(firstParam);
      const p2 = curveAdaptor.Value(lastParam);

      const pt1 = project3DPointTo2D(
        [p1.X(), p1.Y(), p1.Z()],
        centroid,
        uBasis,
        vBasis,
        flatX,
        flatY,
        flatAngle
      );
      const pt2 = project3DPointTo2D(
        [p2.X(), p2.Y(), p2.Z()],
        centroid,
        uBasis,
        vBasis,
        flatX,
        flatY,
        flatAngle
      );

      const ptStart = reversed ? pt2 : pt1;
      const ptEnd = reversed ? pt1 : pt2;

      wireAreaSum += (ptStart.x * ptEnd.y - ptEnd.x * ptStart.y);

      if (curveType === oc.GeomAbs_CurveType.GeomAbs_Line) {
        wireEdges.push({
          type: "line",
          data: { x1: ptStart.x, y1: ptStart.y, x2: ptEnd.x, y2: ptEnd.y }
        });
      } else if (curveType === oc.GeomAbs_CurveType.GeomAbs_Circle) {
        const circle = curveAdaptor.Circle();
        const radius = circle.Radius();
        const loc = circle.Location();
        const center2D = project3DPointTo2D(
          [loc.X(), loc.Y(), loc.Z()],
          centroid,
          uBasis,
          vBasis,
          flatX,
          flatY,
          flatAngle
        );
        loc.delete();
        circle.delete();

        const paramRange = lastParam - firstParam;
        if (paramRange > 6.2) {
          wireEdges.push({
            type: "circle",
            data: { cx: center2D.x, cy: center2D.y, r: radius }
          });
        } else {
          let startAngle = Math.atan2(pt1.y - center2D.y, pt1.x - center2D.x) * 180 / Math.PI;
          let endAngle = Math.atan2(pt2.y - center2D.y, pt2.x - center2D.x) * 180 / Math.PI;
          if (startAngle < 0) startAngle += 360;
          if (endAngle < 0) endAngle += 360;

          const midParam = (firstParam + lastParam) / 2;
          const pm = curveAdaptor.Value(midParam);
          const ptm = project3DPointTo2D(
            [pm.X(), pm.Y(), pm.Z()],
            centroid,
            uBasis,
            vBasis,
            flatX,
            flatY,
            flatAngle
          );
          let midAngle = Math.atan2(ptm.y - center2D.y, ptm.x - center2D.x) * 180 / Math.PI;
          if (midAngle < 0) midAngle += 360;
          pm.delete();

          let isCCW = false;
          if (startAngle < endAngle) {
            isCCW = (midAngle > startAngle && midAngle < endAngle);
          } else {
            isCCW = (midAngle > startAngle || midAngle < endAngle);
          }

          if (!isCCW) {
            const temp = startAngle;
            startAngle = endAngle;
            endAngle = temp;
          }

          wireEdges.push({
            type: "arc",
            data: { cx: center2D.x, cy: center2D.y, r: radius, startAngle, endAngle }
          });
        }
      } else {
        // Fallback for complex curves
        const numSegments = 16;
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= numSegments; i++) {
          const t = firstParam + (lastParam - firstParam) * (i / numSegments);
          const p = curveAdaptor.Value(t);
          pts.push(project3DPointTo2D(
            [p.X(), p.Y(), p.Z()],
            centroid,
            uBasis,
            vBasis,
            flatX,
            flatY,
            flatAngle
          ));
          p.delete();
        }
        const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
        for (let i = 0; i < numSegments; i++) {
          const s = reversed ? numSegments - i : i;
          const e = reversed ? numSegments - i - 1 : i + 1;
          segments.push({
            x1: pts[s].x,
            y1: pts[s].y,
            x2: pts[e].x,
            y2: pts[e].y
          });
        }
        wireEdges.push({
          type: "spline",
          data: segments
        });
      }

      p1.delete();
      p2.delete();
      curveAdaptor.delete();
      edgeExp.Next();
    }
    edgeExp.delete();

    wiresData.push({
      edges: wireEdges,
      area: Math.abs(wireAreaSum / 2)
    });

    faceIter.Next();
  }
  faceIter.delete();

  if (wiresData.length > 0) {
    let outerWireIdx = 0;
    let maxArea = -1;
    for (let i = 0; i < wiresData.length; i++) {
      if (wiresData[i].area > maxArea) {
        maxArea = wiresData[i].area;
        outerWireIdx = i;
      }
    }

    for (let i = 0; i < wiresData.length; i++) {
      const isOuter = (i === outerWireIdx);
      const layer = isOuter ? "CUT_OUTER" : "CUT_INNER";

      for (const edgeInfo of wiresData[i].edges) {
        if (edgeInfo.type === "line") {
          lines.push({ ...edgeInfo.data, layer });
        } else if (edgeInfo.type === "circle") {
          circles.push({ ...edgeInfo.data, layer });
        } else if (edgeInfo.type === "arc") {
          arcs.push({ ...edgeInfo.data, layer });
        } else if (edgeInfo.type === "spline") {
          for (const seg of edgeInfo.data) {
            lines.push({ ...seg, layer });
          }
        }
      }
    }
  }

  // Draw bend centerlines
  const cosP = Math.cos(flatAngle);
  const sinP = Math.sin(flatAngle);

  for (const bend of node.connectedBends) {
    const O = bend.properties.axisOrigin;
    const A = bend.properties.axisDirection;
    const ba = bend.properties.bendAllowance;
    const bendWidth = bend.properties.bendWidth;
    const angle = bend.properties.angle;

    // Parent hinge point in local
    const hP_3d = [O[0] - centroid[0], O[1] - centroid[1], O[2] - centroid[2]];
    const uHP = hP_3d[0] * uBasis[0] + hP_3d[1] * uBasis[1] + hP_3d[2] * uBasis[2];
    const vHP = hP_3d[0] * vBasis[0] + hP_3d[1] * vBasis[1] + hP_3d[2] * vBasis[2];
    const HP = [uHP, vHP];

    // Hinge axis in parent local basis
    const uAP = A[0] * uBasis[0] + A[1] * uBasis[1] + A[2] * uBasis[2];
    const vAP = A[0] * vBasis[0] + A[1] * vBasis[1] + A[2] * vBasis[2];
    const AP = [uAP, vAP];
    const lenAP = Math.sqrt(uAP * uAP + vAP * vAP) || 1;
    const AP_norm = [uAP / lenAP, vAP / lenAP];

    // Direction pointing from parent centroid to hinge (perpendicular to bend line)
    const dotHP_AP = HP[0] * AP_norm[0] + HP[1] * AP_norm[1];
    const DP = [HP[0] - dotHP_AP * AP_norm[0], HP[1] - dotHP_AP * AP_norm[1]];
    const lenDP = Math.sqrt(DP[0] * DP[0] + DP[1] * DP[1]);
    if (lenDP > 0.001) {
      DP[0] /= lenDP;
      DP[1] /= lenDP;
    }

    // Parent hinge point in global flat coordinates
    const hP_global = [
      flatX + HP[0] * cosP - HP[1] * sinP,
      flatY + HP[0] * sinP + HP[1] * cosP
    ];

    // DP in global flat coordinates
    const DP_global = [
      DP[0] * cosP - DP[1] * sinP,
      DP[0] * sinP + DP[1] * cosP
    ];

    // Centerline origin shifted by half of bend allowance
    const centerlineOrigin = [
      hP_global[0] + DP_global[0] * (ba / 2),
      hP_global[1] + DP_global[1] * (ba / 2)
    ];

    // Hinge direction in global flat coordinates
    const V_bend = [
      AP_norm[0] * cosP - AP_norm[1] * sinP,
      AP_norm[0] * sinP + AP_norm[1] * cosP
    ];

    const x1 = centerlineOrigin[0] - V_bend[0] * (bendWidth / 2);
    const y1 = centerlineOrigin[1] - V_bend[1] * (bendWidth / 2);
    const x2 = centerlineOrigin[0] + V_bend[0] * (bendWidth / 2);
    const y2 = centerlineOrigin[1] + V_bend[1] * (bendWidth / 2);

    const layer = angle > 0 ? "BEND_UP" : "BEND_DOWN";
    lines.push({ x1, y1, x2, y2, layer });

    // Recurse
    traverseTreeForDXF(bend.childFlange, classified, lines, arcs, circles);
  }
}

function generateDXF(
  lines: DXFLine[],
  arcs: DXFArc[],
  circles: DXFCircle[]
): string {
  let dxf = "";
  
  // Header / Tables section for layers
  dxf += "  0\nSECTION\n  2\nHEADER\n  0\nENDSEC\n";
  dxf += "  0\nSECTION\n  2\nTABLES\n  0\nTABLE\n  2\nLTYPE\n 70\n1\n";
  dxf += "  0\nLTYPE\n  2\nCONTINUOUS\n 70\n0\n  3\nSolid line\n 72\n65\n 73\n0\n 40\n0.0\n";
  dxf += "  0\nENDTAB\n";
  
  dxf += "  0\nTABLE\n  2\nLAYER\n 70\n4\n";
  // Layer CUT_OUTER (Red = 1)
  dxf += "  0\nLAYER\n  2\nCUT_OUTER\n 70\n0\n 62\n1\n  6\nCONTINUOUS\n";
  // Layer CUT_INNER (Yellow = 2)
  dxf += "  0\nLAYER\n  2\nCUT_INNER\n 70\n0\n 62\n2\n  6\nCONTINUOUS\n";
  // Layer BEND_UP (Green = 3)
  dxf += "  0\nLAYER\n  2\nBEND_UP\n 70\n0\n 62\n3\n  6\nCONTINUOUS\n";
  // Layer BEND_DOWN (Magenta = 6)
  dxf += "  0\nLAYER\n  2\nBEND_DOWN\n 70\n0\n 62\n6\n  6\nCONTINUOUS\n";
  dxf += "  0\nENDTAB\n  0\nENDSEC\n";
  
  dxf += "  0\nSECTION\n  2\nBLOCKS\n  0\nENDSEC\n";
  dxf += "  0\nSECTION\n  2\nENTITIES\n";
  
  for (const line of lines) {
    dxf += `  0\nLINE\n  8\n${line.layer}\n`;
    dxf += ` 10\n${line.x1.toFixed(4)}\n 20\n${line.y1.toFixed(4)}\n 30\n0.0\n`;
    dxf += ` 11\n${line.x2.toFixed(4)}\n 21\n${line.y2.toFixed(4)}\n 31\n0.0\n`;
  }
  
  for (const circle of circles) {
    dxf += `  0\nCIRCLE\n  8\n${circle.layer}\n`;
    dxf += ` 10\n${circle.cx.toFixed(4)}\n 20\n${circle.cy.toFixed(4)}\n 30\n0.0\n`;
    dxf += ` 40\n${circle.r.toFixed(4)}\n`;
  }
  
  for (const arc of arcs) {
    dxf += `  0\nARC\n  8\n${arc.layer}\n`;
    dxf += ` 10\n${arc.cx.toFixed(4)}\n 20\n${arc.cy.toFixed(4)}\n 30\n0.0\n`;
    dxf += ` 40\n${arc.r.toFixed(4)}\n`;
    dxf += ` 50\n${arc.startAngle.toFixed(4)}\n`;
    dxf += ` 51\n${arc.endAngle.toFixed(4)}\n`;
  }
  
  dxf += "  0\nENDSEC\n  0\nEOF\n";
  return dxf;
}

function assignFlatCoordinates(
  node: FlangeNode,
  flatX: number,
  flatY: number,
  flatAngle: number,
  classified: ClassifiedFace[],
  all2DVertices: { x: number; y: number }[]
) {
  node.flatX = flatX;
  node.flatY = flatY;
  node.flatAngle = flatAngle;

  const flangeIdx = parseInt(node.id.replace("flange-", ""));
  const f = classified[flangeIdx];
  if (!f) return;
  const centroid = computeFaceCentroid(f.face);
  const uBasis = f.uBasis || [1, 0, 0];
  const vBasis = f.vBasis || [0, 1, 0];

  // Project vertices of this flange to 2D and store in all2DVertices
  if (node.geometry.vertices && node.geometry.vertices.length > 0) {
    const verts = node.geometry.vertices;
    const cosA = Math.cos(flatAngle);
    const sinA = Math.sin(flatAngle);

    for (let i = 0; i < verts.length; i += 3) {
      const vx = verts[i];
      const vy = verts[i + 1];
      const vz = verts[i + 2];

      // local u, v relative to centroid
      const dx = vx - centroid[0];
      const dy = vy - centroid[1];
      const dz = vz - centroid[2];

      const u = dx * uBasis[0] + dy * uBasis[1] + dz * uBasis[2];
      const v = dx * vBasis[0] + dy * vBasis[1] + dz * vBasis[2];

      // global 2D flat coordinates
      const fx = flatX + u * cosA - v * sinA;
      const fy = flatY + u * sinA + v * cosA;

      all2DVertices.push({ x: fx, y: fy });
    }
  }

  // Recurse on children
  for (const bend of node.connectedBends) {
    const child = bend.childFlange;
    const childIdx = parseInt(child.id.replace("flange-", ""));
    const fc = classified[childIdx];
    if (!fc) continue;

    const O = bend.properties.axisOrigin;
    const A = bend.properties.axisDirection;

    // Parent hinge point in local
    const hP_3d = [O[0] - centroid[0], O[1] - centroid[1], O[2] - centroid[2]];
    const uHP = hP_3d[0] * uBasis[0] + hP_3d[1] * uBasis[1] + hP_3d[2] * uBasis[2];
    const vHP = hP_3d[0] * vBasis[0] + hP_3d[1] * vBasis[1] + hP_3d[2] * vBasis[2];
    const HP = [uHP, vHP];

    // Hinge axis in parent local basis
    const uAP = A[0] * uBasis[0] + A[1] * uBasis[1] + A[2] * uBasis[2];
    const vAP = A[0] * vBasis[0] + A[1] * vBasis[1] + A[2] * vBasis[2];
    const AP = [uAP, vAP];
    const lenAP = Math.sqrt(uAP * uAP + vAP * vAP) || 1;
    const AP_norm = [uAP / lenAP, vAP / lenAP];

    // Direction pointing from parent centroid to hinge (perpendicular to bend line)
    const dotHP_AP = HP[0] * AP_norm[0] + HP[1] * AP_norm[1];
    const DP = [HP[0] - dotHP_AP * AP_norm[0], HP[1] - dotHP_AP * AP_norm[1]];
    const lenDP = Math.sqrt(DP[0] * DP[0] + DP[1] * DP[1]);
    if (lenDP > 0.001) {
      DP[0] /= lenDP;
      DP[1] /= lenDP;
    }

    // Child hinge point in local
    const centroidChild = computeFaceCentroid(fc.face);
    const uBasisChild = fc.uBasis || [1, 0, 0];
    const vBasisChild = fc.vBasis || [0, 1, 0];

    const hC_3d = [O[0] - centroidChild[0], O[1] - centroidChild[1], O[2] - centroidChild[2]];
    const uHC = hC_3d[0] * uBasisChild[0] + hC_3d[1] * uBasisChild[1] + hC_3d[2] * uBasisChild[2];
    const vHC = hC_3d[0] * vBasisChild[0] + hC_3d[1] * vBasisChild[1] + hC_3d[2] * vBasisChild[2];
    const HC = [uHC, vHC];

    // Hinge axis in child local basis
    const uAC = A[0] * uBasisChild[0] + A[1] * uBasisChild[1] + A[2] * uBasisChild[2];
    const vAC = A[0] * vBasisChild[0] + A[1] * vBasisChild[1] + A[2] * vBasisChild[2];
    const AC = [uAC, vAC];
    const lenAC = Math.sqrt(uAC * uAC + vAC * vAC) || 1;
    const AC_norm = [uAC / lenAC, vAC / lenAC];

    // Direction pointing from child centroid to hinge (perpendicular to bend line)
    const dotHC_AC = HC[0] * AC_norm[0] + HC[1] * AC_norm[1];
    const DC = [HC[0] - dotHC_AC * AC_norm[0], HC[1] - dotHC_AC * AC_norm[1]];
    const lenDC = Math.sqrt(DC[0] * DC[0] + DC[1] * DC[1]);
    if (lenDC > 0.001) {
      DC[0] /= lenDC;
      DC[1] /= lenDC;
    }

    // Parent's hinge point in global flat coordinates
    const cosP = Math.cos(flatAngle);
    const sinP = Math.sin(flatAngle);
    const hP_global = [
      flatX + HP[0] * cosP - HP[1] * sinP,
      flatY + HP[0] * sinP + HP[1] * cosP
    ];

    // DP in global flat coordinates
    const DP_global = [
      DP[0] * cosP - DP[1] * sinP,
      DP[0] * sinP + DP[1] * cosP
    ];

    // Child hinge point in global flat coordinates: shifted by bend allowance
    const ba = bend.properties.bendAllowance;
    const hC_global = [
      hP_global[0] + DP_global[0] * ba,
      hP_global[1] + DP_global[1] * ba
    ];

    // Child angle: thetaC = phiP - phiC + pi
    const phiP = Math.atan2(DP_global[1], DP_global[0]);
    const phiC = Math.atan2(DC[1], DC[0]);
    const childAngle = phiP - phiC + Math.PI;

    // Child flat center
    const cosC = Math.cos(childAngle);
    const sinC = Math.sin(childAngle);
    const childFlatX = hC_global[0] - (HC[0] * cosC - HC[1] * sinC);
    const childFlatY = hC_global[1] - (HC[0] * sinC + HC[1] * cosC);

    // Recurse on child
    assignFlatCoordinates(child, childFlatX, childFlatY, childAngle, classified, all2DVertices);
  }
}

// ── Initialization ──────────────────────────────────────

async function initialize(): Promise<{ status: string }> {
  if (oc) return { status: "ready (cached)" };

  try {
    // Import the factory — the bundler handles this JS file fine (~315KB)
    const mod = await import(
      /* webpackIgnore: true */
      // @ts-expect-error — Turbopack/Webpack resolve via alias
      "opencascade.js/dist/opencascade.wasm.js"
    );
    const factory = mod.default || mod;

    oc = await factory({
      locateFile: (filename: string) => {
        if (filename.endsWith(".wasm")) {
          return "/wasm/opencascade.wasm.wasm";
        }
        return filename;
      },
      print: (text: string) => console.log("[OC Print]:", text),
      printErr: (text: string) => console.error("[OC Error]:", text),
    });

    return { status: "ready" };
  } catch (err) {
    // Fallback: fetch factory from public/wasm
    console.warn("Primary OC import failed, trying fallback:", err);
    const resp = await fetch("/wasm/opencascade.wasm.js");
    const code = await resp.text();
    // eslint-disable-next-line no-new-func
    const factoryFn = new Function(
      `${code.replace("export default opencascade;", "")}; return opencascade;`
    )();
    oc = await factoryFn({
      locateFile: (f: string) =>
        f.endsWith(".wasm") ? "/wasm/opencascade.wasm.wasm" : f,
      print: (text: string) => console.log("[OC Print]:", text),
      printErr: (text: string) => console.error("[OC Error]:", text),
    });
    return { status: "ready (fallback)" };
  }
}

// ── STEP File Reading ───────────────────────────────────

interface ClassifiedFace {
  index: number;
  type: "plane" | "cylinder" | "other";
  face: any; // TopoDS_Face
  area: number;
  // Plane data
  normal?: [number, number, number];
  uBasis?: [number, number, number];
  vBasis?: [number, number, number];
  // Cylinder data
  axisOrigin?: [number, number, number];
  axisDirection?: [number, number, number];
  radius?: number;
}

interface AdjacencyEntry {
  edgeIndex: number;
  faceIndices: number[];
}

function readSTEP(buffer: ArrayBuffer): any {
  if (!oc) throw new Error("Kernel not initialized");

  // Test with a known valid dummy STEP file first
  const dummySTEP = `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION((''),'2;1');\nFILE_NAME('','',(''),(''),'','','');\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN_CC2 { 1 2 10303 214 -1 1 5 4 }'));\nENDSEC;\nDATA;\n#1=APPLICATION_PROTOCOL_DEFINITION('','',2000,#2);\n#2=APPLICATION_CONTEXT('');\n#3=SHAPE_DEFINITION_REPRESENTATION(#4,#10);\n#4=PRODUCT_DEFINITION_SHAPE('','',#5);\n#5=PRODUCT_DEFINITION('','',#6,#9);\n#6=PRODUCT_DEFINITION_FORMATION('','',#7);\n#7=PRODUCT('','','',(#8));\n#8=PRODUCT_CONTEXT('',#2,'');\n#9=PRODUCT_DEFINITION_CONTEXT('',#2,'');\n#10=SHAPE_REPRESENTATION('',(#11),#15);\n#11=AXIS2_PLACEMENT_3D('',#12,#13,#14);\n#12=CARTESIAN_POINT('',(0.,0.,0.));\n#13=DIRECTION('',(0.,0.,1.));\n#14=DIRECTION('',(1.,0.,0.));\n#15=(GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#19)) GLOBAL_UNIT_ASSIGNED_CONTEXT((#16,#17,#18)) REPRESENTATION_CONTEXT('',''));\n#16=(LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.));\n#17=(NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.));\n#18=(NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT());\n#19=UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-07),#16,'','');\n#20=PRODUCT_RELATED_PRODUCT_CATEGORY('',$,(#7));\nENDSEC;\nEND-ISO-10303-21;\n`;
  oc.FS.writeFile("dummy.step", new TextEncoder().encode(dummySTEP));
  const dummyReader = new oc.STEPControl_Reader_1();
  const dummyRes = dummyReader.ReadFile("dummy.step");
  const dummyVal = typeof dummyRes === "object" ? dummyRes.value : dummyRes;
  console.log("Dummy read code:", dummyVal);
  if (dummyVal !== 1) {
    console.log("Dummy failed, printing check load:");
    dummyReader.PrintCheckLoad(true, 1);
  }

  // Write the user's file to WASM virtual FS
  let uint8 = new Uint8Array(buffer);
  
  // Strip UTF-8 BOM if present
  if (uint8.length >= 3 && uint8[0] === 0xef && uint8[1] === 0xbb && uint8[2] === 0xbf) {
    uint8 = uint8.slice(3);
  }

  oc.FS.writeFile("upload.step", uint8);

  const reader = new oc.STEPControl_Reader_1();
  const readResult = reader.ReadFile("upload.step");
  const expected = oc.IFSelect_ReturnStatus.IFSelect_RetDone;

  const actualVal = typeof readResult === "object" ? readResult.value : readResult;
  const expectedVal = typeof expected === "object" ? expected.value : expected;

  if (actualVal !== expectedVal) {
    const headHex = Array.from(uint8.slice(0, 5)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    const head = new TextDecoder().decode(uint8.slice(0, 20)).replace(/\n/g, '\\n');
    throw new Error(`STEP read failed (code: ${actualVal}). Dummy read code: ${dummyVal}. Size: ${uint8.length}B, Hex: [${headHex}], Head: "${head}"`);
  }

  reader.TransferRoots(new oc.Message_ProgressRange_1());
  const shape = reader.OneShape();

  // Cleanup virtual FS
  oc.FS.unlink("/upload.step");

  return shape;
}

// ── Topology Extraction ─────────────────────────────────

function extractFaces(shape: any): any[] {
  const faces: any[] = [];
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE
  );
  while (explorer.More()) {
    faces.push(oc.TopoDS.Face_1(explorer.Current()));
    explorer.Next();
  }
  explorer.delete();
  return faces;
}

function classifyFaces(faces: any[]): ClassifiedFace[] {
  return faces.map((face, index) => {
    const surface = new oc.BRepAdaptor_Surface_2(face, true);
    const surfType = surface.GetType();

    const props = new oc.GProp_GProps_1();
    oc.BRepGProp.SurfaceProperties_1(face, props, 1e-6, false);
    const area = props.Mass();

    let classified: ClassifiedFace;

    if (surfType === oc.GeomAbs_SurfaceType.GeomAbs_Plane) {
      const plane = surface.Plane();
      const axis = plane.Axis();
      const dir = axis.Direction();
      let normalVec: [number, number, number] = [dir.X(), dir.Y(), dir.Z()];
      if (isReversed(face.Orientation())) {
        normalVec = [-normalVec[0], -normalVec[1], -normalVec[2]];
      }
      const basis = computeLocalBasis(normalVec);
      classified = {
        index,
        type: "plane",
        face,
        area,
        normal: normalVec,
        uBasis: basis.uBasis,
        vBasis: basis.vBasis,
      };
      plane.delete();
    } else if (surfType === oc.GeomAbs_SurfaceType.GeomAbs_Cylinder) {
      const cyl = surface.Cylinder();
      const axis = cyl.Axis();
      const loc = axis.Location();
      const dir = axis.Direction();
      classified = {
        index,
        type: "cylinder",
        face,
        area,
        axisOrigin: [loc.X(), loc.Y(), loc.Z()],
        axisDirection: [dir.X(), dir.Y(), dir.Z()],
        radius: cyl.Radius(),
      };
      cyl.delete();
    } else {
      classified = { index, type: "other", face, area };
    }

    surface.delete();
    props.delete();
    return classified;
  });
}

// ── Adjacency Graph ─────────────────────────────────────

function buildAdjacency(
  shape: any,
  faces: any[]
): Map<number, Set<number>> {
  // Map edges → ancestor faces
  const edgeFaceMap = new oc.TopTools_IndexedDataMapOfShapeListOfShape_1();
  oc.TopExp.MapShapesAndAncestors(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    edgeFaceMap
  );

  // Build face index lookup
  const faceIndexMap = new oc.TopTools_IndexedMapOfShape_1();
  oc.TopExp.MapShapes_1(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    faceIndexMap
  );

  // Build adjacency: face → set of adjacent faces
  const adjacency = new Map<number, Set<number>>();
  for (let i = 0; i < faces.length; i++) {
    adjacency.set(i, new Set());
  }

  for (let e = 1; e <= edgeFaceMap.Extent(); e++) {
    const faceList = edgeFaceMap.FindFromIndex(e);
    const faceIndices: number[] = [];

    const iter = new oc.TopTools_ListIteratorOfListOfShape_2(faceList);
    while (iter.More()) {
      const fi = faceIndexMap.FindIndex(iter.Value());
      if (fi > 0) faceIndices.push(fi - 1); // convert to 0-indexed
      iter.Next();
    }
    iter.delete();

    // Create adjacency links between all faces sharing this edge
    for (let a = 0; a < faceIndices.length; a++) {
      for (let b = a + 1; b < faceIndices.length; b++) {
        adjacency.get(faceIndices[a])?.add(faceIndices[b]);
        adjacency.get(faceIndices[b])?.add(faceIndices[a]);
      }
    }
  }

  edgeFaceMap.delete();
  faceIndexMap.delete();
  return adjacency;
}

// ── Bend Detection & Unfold Tree ────────────────────────

function computeBendAngle(
  classified: ClassifiedFace[],
  bendIdx: number,
  flange1Idx: number,
  flange2Idx: number
): number {
  const f1 = classified[flange1Idx];
  const f2 = classified[flange2Idx];
  const bend = classified[bendIdx];
  if (!f1.normal || !f2.normal || !bend.axisDirection) return Math.PI / 2; // fallback

  const n1 = f1.normal;
  const n2 = f2.normal;
  const a = bend.axisDirection;

  // Project n1 and n2 perpendicular to a
  const dot1 = n1[0] * a[0] + n1[1] * a[1] + n1[2] * a[2];
  const p1 = [n1[0] - dot1 * a[0], n1[1] - dot1 * a[1], n1[2] - dot1 * a[2]];
  const len1 = Math.sqrt(p1[0] * p1[0] + p1[1] * p1[1] + p1[2] * p1[2]);

  const dot2 = n2[0] * a[0] + n2[1] * a[1] + n2[2] * a[2];
  const p2 = [n2[0] - dot2 * a[0], n2[1] - dot2 * a[1], n2[2] - dot2 * a[2]];
  const len2 = Math.sqrt(p2[0] * p2[0] + p2[1] * p2[1] + p2[2] * p2[2]);

  if (len1 < 1e-5 || len2 < 1e-5) {
    // If one of the normals is parallel to the bend axis, fallback to the supplement of the angle
    const dot = n1[0] * n2[0] + n1[1] * n2[1] + n1[2] * n2[2];
    const rawAngle = Math.acos(Math.max(-1, Math.min(1, dot)));
    return Math.PI - rawAngle;
  }

  const u1 = [p1[0] / len1, p1[1] / len1, p1[2] / len1];
  const u2 = [p2[0] / len2, p2[1] / len2, p2[2] / len2];

  // Cross product: u1 x u2
  const cx = u1[1] * u2[2] - u1[2] * u2[1];
  const cy = u1[2] * u2[0] - u1[0] * u2[2];
  const cz = u1[0] * u2[1] - u1[1] * u2[0];

  // Dot product of (u1 x u2) with a
  const sinTheta = cx * a[0] + cy * a[1] + cz * a[2];
  // Dot product of u1 with u2
  const cosTheta = u1[0] * u2[0] + u1[1] * u2[1] + u1[2] * u2[2];

  return Math.atan2(sinTheta, cosTheta);
}

/** Compute the bounding box centroid of a single face's tessellation */
function computeFaceCentroid(
  face: any
): [number, number, number] {
  const location = new oc.TopLoc_Location_1();
  const triangulation = oc.BRep_Tool.Triangulation(face, location);
  if (triangulation.IsNull()) {
    location.delete();
    return [0, 0, 0];
  }

  const tri = triangulation.get();
  const nbNodes = tri.NbNodes();
  const trsf = location.Transformation();

  let cx = 0, cy = 0, cz = 0;
  for (let i = 1; i <= nbNodes; i++) {
    const node = tri.Node(i).Transformed(trsf);
    cx += node.X();
    cy += node.Y();
    cz += node.Z();
    node.delete();
  }

  location.delete();
  trsf.delete();

  const n = Math.max(nbNodes, 1);
  return [cx / n, cy / n, cz / n];
}

/** Compute the width of a cylindrical face along its axis (the bend depth) */
function computeBendWidth(
  face: any
): number {
  const location = new oc.TopLoc_Location_1();
  const triangulation = oc.BRep_Tool.Triangulation(face, location);
  if (triangulation.IsNull()) {
    location.delete();
    return 50; // fallback
  }

  const tri = triangulation.get();
  const nbNodes = tri.NbNodes();
  const trsf = location.Transformation();

  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 1; i <= nbNodes; i++) {
    const node = tri.Node(i).Transformed(trsf);
    const z = node.Z();
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
    node.delete();
  }

  location.delete();
  trsf.delete();

  return maxZ - minZ || 50;
}

function buildUnfoldTree(
  classified: ClassifiedFace[],
  adjacency: Map<number, Set<number>>,
  shape: any,
  kFactor: number,
  baseFlangeIdx?: number
): UnfoldTree | null {
  const planes = classified.filter((f) => f.type === "plane");
  if (planes.length === 0) return null;

  // Seed: if baseFlangeIdx is specified and is a plane, use it. Otherwise, use largest planar face
  let seed = planes.reduce((a, b) => (a.area > b.area ? a : b));
  if (baseFlangeIdx !== undefined) {
    const found = planes.find(p => p.index === baseFlangeIdx);
    if (found) {
      seed = found;
    }
  }
  const thickness = detectThickness(classified, adjacency, seed.index);

  // Tessellate the full shape once upfront (higher quality)
  new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.1, true);

  // BFS to build the unfold tree
  const visited = new Set<number>();
  visited.add(seed.index);

  function buildNode(flangeIdx: number, isRoot: boolean): FlangeNode {
    const flange = classified[flangeIdx];
    const geo = tessellateFace(flange.face);
    const centroid = computeFaceCentroid(flange.face);
    const bends: BendTransition[] = [];

    // Find adjacent cylindrical faces (bends)
    const neighbors = adjacency.get(flangeIdx) || new Set();
    for (const neighborIdx of neighbors) {
      if (visited.has(neighborIdx)) continue;
      const neighbor = classified[neighborIdx];

      if (neighbor.type === "cylinder") {
        visited.add(neighborIdx);
        // Find the planar face on the other side of this bend
        const bendNeighbors = adjacency.get(neighborIdx) || new Set();
        for (const childFlangeIdx of bendNeighbors) {
          if (visited.has(childFlangeIdx)) continue;
          const childFlange = classified[childFlangeIdx];
          if (childFlange.type !== "plane") continue;

          visited.add(childFlangeIdx);
          const angle = computeBendAngle(
            classified,
            neighborIdx,
            flangeIdx,
            childFlangeIdx
          );
          const radius = neighbor.radius || 3;
          const ba = calculateBendAllowance(
            (Math.abs(angle) * 180) / Math.PI,
            radius,
            kFactor,
            thickness
          );
          const bendWidth = computeBendWidth(neighbor.face);

          const childNode = buildNode(childFlangeIdx, false);

          // Compute child localPosition relative to the bend axis origin
          const childCentroid = computeFaceCentroid(childFlange.face);
          const axisO = neighbor.axisOrigin || [0, 0, 0];
          const relPos: [number, number, number] = [
            childCentroid[0] - axisO[0],
            childCentroid[1] - axisO[1],
            childCentroid[2] - axisO[2],
          ];
          childNode.localPosition = relPos;

          bends.push({
            id: `bend-${neighborIdx}`,
            parentFlangeId: `flange-${flangeIdx}`,
            childFlange: childNode,
            properties: {
              axisOrigin: neighbor.axisOrigin || [0, 0, 0],
              axisDirection: neighbor.axisDirection || [0, 0, 1],
              angle,
              radius,
              kFactor,
              thickness,
              bendAllowance: ba,
              bendWidth,
            },
          });
          break; // one child flange per bend
        }
      }
    }

    const uBasis = flange.uBasis || [1, 0, 0];
    const vBasis = flange.vBasis || [0, 1, 0];
    const dims = computeFaceDimensions(flange.face, uBasis, vBasis);

    return {
      id: `flange-${flangeIdx}`,
      label: isRoot ? "Base" : `Flange ${flangeIdx}`,
      geometry: {
        ...geo,
        width: dims.width,
        height: dims.height,
        thickness,
      },
      localPosition: isRoot ? centroid as [number, number, number] : [0, 0, 0],
      connectedBends: bends,
    };
  }

  const rootFlange = buildNode(seed.index, true);
  const totalFlanges = planes.length;
  const totalBends = classified.filter((f) => f.type === "cylinder").length;

  // Compute 2D flat coordinates and exact flat pattern dimensions
  const all2DVertices: { x: number; y: number }[] = [];
  assignFlatCoordinates(rootFlange, 0, 0, 0, classified, all2DVertices);

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const v of all2DVertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  const flatWidth = isFinite(maxX - minX) ? maxX - minX : 0;
  const flatHeight = isFinite(maxY - minY) ? maxY - minY : 0;

  // Compute bounding box from tessellated root
  const bb = computeBoundingBox(shape);

  return {
    rootFlange,
    metadata: {
      partName: "Imported Part",
      totalFlanges,
      totalBends,
      materialName: "Custom",
      kFactor,
      thickness,
      boundingBox: bb,
      flatPatternDimensions: {
        width: Math.round(flatWidth * 10) / 10,
        height: Math.round(flatHeight * 10) / 10,
      },
    },
  };
}

// ── Thickness Detection ─────────────────────────────────

function detectThickness(
  classified: ClassifiedFace[],
  adjacency: Map<number, Set<number>>,
  seedIdx: number
): number {
  // Heuristic: find smallest planar face adjacent to seed → its width is likely the thickness
  // Or: find the smallest dimension of the bounding box
  // For MVP: check if there's a parallel opposite face and measure distance
  const seed = classified[seedIdx];
  if (!seed.normal) return 2; // fallback

  for (const neighborIdx of adjacency.get(seedIdx) || []) {
    const neighbor = classified[neighborIdx];
    if (neighbor.type !== "plane" || !neighbor.normal) continue;
    // Check if normals are anti-parallel (opposite face)
    const dot =
      seed.normal[0] * neighbor.normal[0] +
      seed.normal[1] * neighbor.normal[1] +
      seed.normal[2] * neighbor.normal[2];
    if (dot < -0.99) {
      // Found opposite face — distance between them is the thickness
      // Use BRep_Tool to get a point on each face
      const uv1 = new oc.BRepAdaptor_Surface_2(seed.face, true);
      const uv2 = new oc.BRepAdaptor_Surface_2(neighbor.face, true);
      const p1 = uv1.Value(uv1.FirstUParameter(), uv1.FirstVParameter());
      const p2 = uv2.Value(uv2.FirstUParameter(), uv2.FirstVParameter());
      const dx = p1.X() - p2.X();
      const dy = p1.Y() - p2.Y();
      const dz = p1.Z() - p2.Z();
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      uv1.delete();
      uv2.delete();
      p1.delete();
      p2.delete();
      if (dist > 0.1 && dist < 50) return Math.round(dist * 100) / 100;
    }
  }
  return 2; // default 2mm
}

// ── Tessellation ────────────────────────────────────────

function tessellateFace(
  face: any
): { vertices: Float32Array; indices: Uint32Array; normals: Float32Array } {
  // Mesh is assumed to already exist (built upfront in buildUnfoldTree)

  const location = new oc.TopLoc_Location_1();
  const triangulation = oc.BRep_Tool.Triangulation(face, location);

  if (triangulation.IsNull()) {
    location.delete();
    // Return empty geometry
    return {
      vertices: new Float32Array(0),
      indices: new Uint32Array(0),
      normals: new Float32Array(0),
    };
  }

  const tri = triangulation.get();
  const nbNodes = tri.NbNodes();
  const nbTriangles = tri.NbTriangles();
  const trsf = location.Transformation();

  const vertices = new Float32Array(nbNodes * 3);
  const normals = new Float32Array(nbNodes * 3);
  const indices = new Uint32Array(nbTriangles * 3);

  // Extract vertices
  for (let i = 1; i <= nbNodes; i++) {
    const node = tri.Node(i).Transformed(trsf);
    vertices[(i - 1) * 3] = node.X();
    vertices[(i - 1) * 3 + 1] = node.Y();
    vertices[(i - 1) * 3 + 2] = node.Z();
    node.delete();
  }

  // Extract triangles
  for (let i = 1; i <= nbTriangles; i++) {
    const triangle = tri.Triangle(i);
    const i1 = triangle.Value(1) - 1; // 0-indexed
    const i2 = triangle.Value(2) - 1;
    const i3 = triangle.Value(3) - 1;
    indices[(i - 1) * 3] = i1;
    indices[(i - 1) * 3 + 1] = i2;
    indices[(i - 1) * 3 + 2] = i3;
    triangle.delete();
  }

  // Compute face normals per-vertex (simple: flat normals from triangles)
  for (let i = 0; i < nbTriangles; i++) {
    const i0 = indices[i * 3];
    const i1 = indices[i * 3 + 1];
    const i2 = indices[i * 3 + 2];

    const ax = vertices[i1 * 3] - vertices[i0 * 3];
    const ay = vertices[i1 * 3 + 1] - vertices[i0 * 3 + 1];
    const az = vertices[i1 * 3 + 2] - vertices[i0 * 3 + 2];
    const bx = vertices[i2 * 3] - vertices[i0 * 3];
    const by = vertices[i2 * 3 + 1] - vertices[i0 * 3 + 1];
    const bz = vertices[i2 * 3 + 2] - vertices[i0 * 3 + 2];

    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

    for (const idx of [i0, i1, i2]) {
      normals[idx * 3] += nx / len;
      normals[idx * 3 + 1] += ny / len;
      normals[idx * 3 + 2] += nz / len;
    }
  }

  // Normalize accumulated normals
  for (let i = 0; i < nbNodes; i++) {
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    normals[i * 3] /= len;
    normals[i * 3 + 1] /= len;
    normals[i * 3 + 2] /= len;
  }

  location.delete();
  trsf.delete();

  return { vertices, indices, normals };
}

// ── Bounding Box ────────────────────────────────────────

function computeBoundingBox(
  shape: any
): { min: [number, number, number]; max: [number, number, number] } {
  const bbox = new oc.Bnd_Box_1();
  oc.BRepBndLib.Add(shape, bbox, false);
  const min = bbox.CornerMin();
  const max = bbox.CornerMax();
  const result = {
    min: [min.X(), min.Y(), min.Z()] as [number, number, number],
    max: [max.X(), max.Y(), max.Z()] as [number, number, number],
  };
  min.delete();
  max.delete();
  bbox.delete();
  return result;
}

// ── Pricing Geometry Helpers ────────────────────────────

/** Sum all edge lengths on a single face (outer + inner wires) */
function computeFaceEdgeLengths(face: any): { outerPerimeter: number; innerCount: number } {
  let outerPerimeter = 0;
  let innerCount = 0;

  // Iterate wires on the face
  const faceIter = new oc.TopoDS_Iterator_2(face, true, true);
  let wireIndex = 0;
  while (faceIter.More()) {
    const wireShape = faceIter.Value();
    const wire = oc.TopoDS.Wire_1(wireShape);

    // Sum edge lengths in this wire
    let wireLen = 0;
    const edgeExp = new oc.TopExp_Explorer_2(
      wire,
      oc.TopAbs_ShapeEnum.TopAbs_EDGE,
      oc.TopAbs_ShapeEnum.TopAbs_SHAPE
    );
    while (edgeExp.More()) {
      const edge = oc.TopoDS.Edge_1(edgeExp.Current());
      const gProps = new oc.GProp_GProps_1();
      oc.BRepGProp.LinearProperties(edge, gProps, false, false);
      wireLen += gProps.Mass();
      gProps.delete();
      edgeExp.Next();
    }
    edgeExp.delete();

    if (wireIndex === 0) {
      outerPerimeter = wireLen;
    } else {
      innerCount++;
    }
    wireIndex++;
    faceIter.Next();
  }
  faceIter.delete();

  return { outerPerimeter, innerCount };
}

/** Compute face bounding box dimensions projected onto local basis */
function computeFaceDimensions(
  face: any,
  uBasis: [number, number, number],
  vBasis: [number, number, number]
): { width: number; height: number } {
  const location = new oc.TopLoc_Location_1();
  const triangulation = oc.BRep_Tool.Triangulation(face, location);
  if (triangulation.IsNull()) {
    location.delete();
    return { width: 0, height: 0 };
  }
  const tri = triangulation.get();
  const nbNodes = tri.NbNodes();
  const trsf = location.Transformation();

  let minU = Infinity, maxU = -Infinity;
  let minV = Infinity, maxV = -Infinity;
  for (let i = 1; i <= nbNodes; i++) {
    const node = tri.Node(i).Transformed(trsf);
    const ux = node.X();
    const uy = node.Y();
    const uz = node.Z();
    // Project node coordinates onto uBasis and vBasis
    const u = ux * uBasis[0] + uy * uBasis[1] + uz * uBasis[2];
    const v = ux * vBasis[0] + uy * vBasis[1] + uz * vBasis[2];

    if (u < minU) minU = u;
    if (u > maxU) maxU = u;
    if (v < minV) minV = v;
    if (v > maxV) maxV = v;
    node.delete();
  }
  location.delete();
  trsf.delete();
  return {
    width:  isFinite(maxU - minU) ? maxU - minU : 0,
    height: isFinite(maxV - minV) ? maxV - minV : 0,
  };
}

/** Traverse unfold tree to compute flat pattern bounding dimensions */
function computeFlatPatternDims(
  node: import("@/lib/types/unfold").FlangeNode,
  classified: ClassifiedFace[]
): { width: number; height: number } {
  const all2DVertices: { x: number; y: number }[] = [];

  function collectVertices(n: import("@/lib/types/unfold").FlangeNode) {
    const flangeIdx = parseInt(n.id.replace("flange-", ""));
    const f = classified.find((c) => c.index === flangeIdx);
    if (f && f.face) {
      const centroid = computeFaceCentroid(f.face);
      const uBasis = f.uBasis || [1, 0, 0];
      const vBasis = f.vBasis || [0, 1, 0];
      const flatX = n.flatX || 0;
      const flatY = n.flatY || 0;
      const flatAngle = n.flatAngle || 0;

      const verts = n.geometry.vertices;
      if (verts && verts.length > 0) {
        const cosA = Math.cos(flatAngle);
        const sinA = Math.sin(flatAngle);
        for (let i = 0; i < verts.length; i += 3) {
          const vx = verts[i];
          const vy = verts[i + 1];
          const vz = verts[i + 2];
          const dx = vx - centroid[0];
          const dy = vy - centroid[1];
          const dz = vz - centroid[2];
          const u = dx * uBasis[0] + dy * uBasis[1] + dz * uBasis[2];
          const v = dx * vBasis[0] + dy * vBasis[1] + dz * vBasis[2];
          const fx = flatX + u * cosA - v * sinA;
          const fy = flatY + u * sinA + v * cosA;
          all2DVertices.push({ x: fx, y: fy });
        }
      }
    }
    for (const bend of n.connectedBends) {
      collectVertices(bend.childFlange);
    }
  }

  collectVertices(node);

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  for (const v of all2DVertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }

  return {
    width: isFinite(maxX - minX) ? maxX - minX : 0,
    height: isFinite(maxY - minY) ? maxY - minY : 0,
  };
}

// ── Public API ──────────────────────────────────────────

const api = {
  initialize,

  async parseSTEP(
    fileBuffer: ArrayBuffer,
    kFactor: number = 0.446
  ): Promise<UnfoldTree> {
    if (!oc) await initialize();

    clearCache();
    cachedShape = readSTEP(fileBuffer);
    cachedFaces = extractFaces(cachedShape);
    cachedClassified = classifyFaces(cachedFaces);
    cachedAdjacency = buildAdjacency(cachedShape, cachedFaces);
    const tree = buildUnfoldTree(cachedClassified, cachedAdjacency, cachedShape, kFactor);

    if (!tree) {
      throw new Error(
        "Could not build unfold tree. No planar faces found — is this a sheet metal part?"
      );
    }

    return tree;
  },

  async rebuildTree(
    kFactor: number,
    baseFlangeIdx?: number
  ): Promise<UnfoldTree> {
    if (!oc) await initialize();
    if (!cachedShape || cachedClassified.length === 0 || !cachedAdjacency) {
      throw new Error("No cached geometry. Please load a STEP file first.");
    }
    const tree = buildUnfoldTree(cachedClassified, cachedAdjacency, cachedShape, kFactor, baseFlangeIdx);
    if (!tree) {
      throw new Error(
        `Could not rebuild unfold tree. No planar faces found for base flange ${baseFlangeIdx}`
      );
    }
    return tree;
  },

  async exportDXF(
    kFactor: number,
    baseFlangeIdx?: number
  ): Promise<string> {
    if (!oc) await initialize();
    if (!cachedShape || cachedClassified.length === 0 || !cachedAdjacency) {
      throw new Error("No cached geometry. Please load a STEP file first.");
    }
    const tree = buildUnfoldTree(cachedClassified, cachedAdjacency, cachedShape, kFactor, baseFlangeIdx);
    if (!tree) {
      throw new Error("Could not rebuild unfold tree for DXF export.");
    }

    const lines: DXFLine[] = [];
    const arcs: DXFArc[] = [];
    const circles: DXFCircle[] = [];

    traverseTreeForDXF(tree.rootFlange, cachedClassified, lines, arcs, circles);

    return generateDXF(lines, arcs, circles);
  },

  async getFlat2DGeometry(
    kFactor: number,
    baseFlangeIdx?: number
  ): Promise<{
    lines: DXFLine[];
    arcs: DXFArc[];
    circles: DXFCircle[];
    width: number;
    height: number;
  }> {
    if (!oc) await initialize();
    if (!cachedShape || cachedClassified.length === 0 || !cachedAdjacency) {
      throw new Error("No cached geometry. Please load a STEP file first.");
    }
    const tree = buildUnfoldTree(cachedClassified, cachedAdjacency, cachedShape, kFactor, baseFlangeIdx);
    if (!tree) {
      throw new Error("Could not rebuild unfold tree.");
    }

    const lines: DXFLine[] = [];
    const arcs: DXFArc[] = [];
    const circles: DXFCircle[] = [];

    traverseTreeForDXF(tree.rootFlange, cachedClassified, lines, arcs, circles);

    return {
      lines,
      arcs,
      circles,
      width: tree.metadata.flatPatternDimensions.width,
      height: tree.metadata.flatPatternDimensions.height,
    };
  },

  /** Extract geometry data needed for pricing, from a STEP file */
  async extractPricingGeometry(
    fileBuffer: ArrayBuffer,
    kFactor: number = 0.446
  ): Promise<{
    boundingWidth: number;
    boundingHeight: number;
    partArea: number;
    perimeter: number;
    pierceCount: number;
    bendCount: number;
    bendAngles: number[];
    thickness: number;
  }> {
    if (!oc) await initialize();

    const shape = readSTEP(fileBuffer);
    const faces = extractFaces(shape);
    const classified = classifyFaces(faces);
    const adjacency = buildAdjacency(shape, faces);

    // Tessellate for dimension extraction
    new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.1, true);

    // Identify geometry class counts
    const planes    = classified.filter((f) => f.type === "plane");
    const cylinders = classified.filter((f) => f.type === "cylinder");

    // Detect thickness from largest seed face
    const seed = planes.length > 0
      ? planes.reduce((a, b) => (a.area > b.area ? a : b))
      : classified[0];
    const thickness = seed
      ? detectThickness(classified, adjacency, seed.index)
      : 2;

    // Find the two largest opposite planar faces (top + bottom of the part)
    // Sort by area descending; the top face is the largest plane
    const sortedPlanes = [...planes].sort((a, b) => b.area - a.area);
    const topFace = sortedPlanes[0]?.face ?? null;

    // Compute face dimensions and perimeter from the largest face
    let outerPerimeter = 0;
    let pierceCount = 0;
    let partArea = 0;
    let faceWidth = 0;
    let faceHeight = 0;

    if (topFace && sortedPlanes[0]) {
      const dims = computeFaceDimensions(
        topFace,
        sortedPlanes[0].uBasis || [1, 0, 0],
        sortedPlanes[0].vBasis || [0, 1, 0]
      );
      faceWidth  = dims.width;
      faceHeight = dims.height;
      partArea   = sortedPlanes[0].area; // already in mm²

      try {
        const edgeData = computeFaceEdgeLengths(topFace);
        outerPerimeter = edgeData.outerPerimeter;
        pierceCount    = edgeData.innerCount;
      } catch {
        // Fallback if OCCT wire iteration fails
        outerPerimeter = 2 * (faceWidth + faceHeight);
        pierceCount = 0;
      }
    }

    // Build unfold tree to get flat pattern dims and bend data
    let flatWidth  = faceWidth;
    let flatHeight = faceHeight;
    const bendAngles: number[] = [];

    try {
      const tree = buildUnfoldTree(classified, adjacency, shape, kFactor);
      if (tree) {
        // Enrich flange dimensions from tessellation
        function enrichNode(node: FlangeNode) {
          const targetIdx = parseInt(node.id.replace("flange-", ""));
          const targetFace = classified.find((c) => c.index === targetIdx);
          const dims = node.geometry.width > 0
            ? { width: node.geometry.width, height: node.geometry.height }
            : computeFaceDimensions(
                targetFace?.face ?? topFace,
                targetFace?.uBasis ?? sortedPlanes[0]?.uBasis ?? [1, 0, 0],
                targetFace?.vBasis ?? sortedPlanes[0]?.vBasis ?? [0, 1, 0]
              );
          node.geometry.width  = dims.width;
          node.geometry.height = dims.height;
          for (const bend of node.connectedBends) {
            bendAngles.push((bend.properties.angle * 180) / Math.PI);
            enrichNode(bend.childFlange);
          }
        }
        enrichNode(tree.rootFlange);

        const flatDims = computeFlatPatternDims(tree.rootFlange, classified);
        if (flatDims.width > 0)  flatWidth  = flatDims.width;
        if (flatDims.height > 0) flatHeight = flatDims.height;
      }
    } catch {
      // Fallback to face dims if tree fails
    }

    return {
      boundingWidth:  Math.round(flatWidth  * 10) / 10,
      boundingHeight: Math.round(flatHeight * 10) / 10,
      partArea:       Math.round(partArea),
      perimeter:      Math.round(outerPerimeter * 10) / 10,
      pierceCount,
      bendCount:      cylinders.length,
      bendAngles,
      thickness:      Math.round(thickness * 100) / 100,
    };
  },

  /** Quick topology dump for diagnostics */
  async analyzeSTEP(
    fileBuffer: ArrayBuffer
  ): Promise<{
    faceCount: number;
    planeCount: number;
    cylinderCount: number;
    otherCount: number;
    faces: Array<{ index: number; type: string; area: number }>;
  }> {
    if (!oc) await initialize();

    const shape = readSTEP(fileBuffer);
    const faces = extractFaces(shape);
    const classified = classifyFaces(faces);

    return {
      faceCount: classified.length,
      planeCount: classified.filter((f) => f.type === "plane").length,
      cylinderCount: classified.filter((f) => f.type === "cylinder").length,
      otherCount: classified.filter((f) => f.type === "other").length,
      faces: classified.map((f) => ({
        index: f.index,
        type: f.type,
        area: Math.round(f.area * 100) / 100,
      })),
    };
  },
};

export type GeometryWorkerAPI = typeof api;
Comlink.expose(api);


