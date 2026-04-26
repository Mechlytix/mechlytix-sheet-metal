// ─────────────────────────────────────────────────────────
// DXF Geometry Extractor
// Uses dxf-parser to extract pricing geometry from flat patterns
// Handles: LINE, ARC, CIRCLE, LWPOLYLINE, POLYLINE
// ─────────────────────────────────────────────────────────

import type { PricingGeometry } from "@/lib/pricing/types";

// dxf-parser ships its own JS, use dynamic require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DxfParser = require("dxf-parser");

interface Vertex { x: number; y: number; bulge?: number }

function lineLength(v0: Vertex, v1: Vertex): number {
  const dx = v1.x - v0.x;
  const dy = v1.y - v0.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Length of a polyline segment accounting for bulge (arc) */
function segmentLength(v0: Vertex, v1: Vertex): number {
  const chord = lineLength(v0, v1);
  const bulge = v0.bulge ?? 0;
  if (Math.abs(bulge) < 1e-9) return chord;
  const angle = 4 * Math.atan(Math.abs(bulge));
  if (Math.sin(angle / 2) < 1e-9) return chord;
  const radius = chord / (2 * Math.sin(angle / 2));
  return Math.abs(radius * angle);
}

/** Shoelace formula for signed area of a polygon */
function polygonArea(verts: Vertex[]): number {
  let area = 0;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += verts[i].x * verts[j].y;
    area -= verts[j].x * verts[i].y;
  }
  return Math.abs(area) / 2;
}

export function parseDXFGeometry(fileContent: string): PricingGeometry {
  const parser = new DxfParser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dxf: any;
  try {
    dxf = parser.parseSync(fileContent);
  } catch {
    throw new Error("Could not parse DXF file — ensure it is a valid R12-R2018 DXF.");
  }

  const entities: any[] = dxf?.entities ?? []; // eslint-disable-line @typescript-eslint/no-explicit-any

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let totalPerimeter = 0;
  let closedLoopCount = 0;
  const closedLoopAreas: number[] = [];

  function updateBB(x: number, y: number) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  for (const entity of entities) {
    switch (entity.type) {
      case "LINE": {
        const v0 = entity.vertices?.[0] ?? { x: entity.start?.x ?? 0, y: entity.start?.y ?? 0 };
        const v1 = entity.vertices?.[1] ?? { x: entity.end?.x ?? 0, y: entity.end?.y ?? 0 };
        totalPerimeter += lineLength(v0, v1);
        updateBB(v0.x, v0.y);
        updateBB(v1.x, v1.y);
        break;
      }

      case "ARC": {
        const { center, radius, startAngle, endAngle } = entity;
        if (!center || !radius) break;
        let sweep = endAngle - startAngle;
        if (sweep <= 0) sweep += 360;
        totalPerimeter += (Math.PI / 180) * sweep * radius;
        updateBB(center.x - radius, center.y - radius);
        updateBB(center.x + radius, center.y + radius);
        break;
      }

      case "CIRCLE": {
        const { center, radius } = entity;
        if (!center || !radius) break;
        totalPerimeter += 2 * Math.PI * radius;
        closedLoopCount++;
        closedLoopAreas.push(Math.PI * radius * radius);
        updateBB(center.x - radius, center.y - radius);
        updateBB(center.x + radius, center.y + radius);
        break;
      }

      case "LWPOLYLINE":
      case "POLYLINE": {
        const verts: Vertex[] = entity.vertices ?? [];
        if (verts.length < 2) break;

        let len = 0;
        for (let i = 0; i < verts.length - 1; i++) {
          len += segmentLength(verts[i], verts[i + 1]);
          updateBB(verts[i].x, verts[i].y);
        }
        updateBB(verts[verts.length - 1].x, verts[verts.length - 1].y);

        const isClosed = entity.closed || entity.shape;
        if (isClosed) {
          len += segmentLength(verts[verts.length - 1], verts[0]);
          closedLoopCount++;
          closedLoopAreas.push(polygonArea(verts));
        }
        totalPerimeter += len;
        break;
      }

      case "SPLINE": {
        // Approximate: sum of control point distances
        const pts: Vertex[] = entity.controlPoints ?? entity.fitPoints ?? [];
        for (let i = 0; i < pts.length - 1; i++) {
          totalPerimeter += lineLength(pts[i], pts[i + 1]);
          updateBB(pts[i].x, pts[i].y);
        }
        if (pts.length > 0) updateBB(pts[pts.length - 1].x, pts[pts.length - 1].y);
        break;
      }
    }
  }

  // Outer contour = the largest closed loop area
  // Everything else is a pierce/hole
  let partArea = 0;
  let pierceCount = 0;

  if (closedLoopAreas.length > 0) {
    const maxArea = Math.max(...closedLoopAreas);
    partArea = maxArea;
    // Holes = all closed loops whose area is not the dominant outer contour
    pierceCount = closedLoopAreas.filter(
      (a) => a < maxArea * 0.9 // smaller than 90% of largest = inner loop
    ).length;
  }

  const width  = isFinite(maxX - minX) ? maxX - minX : 0;
  const height = isFinite(maxY - minY) ? maxY - minY : 0;

  // If we couldn't get area from closed loops, estimate from bounding box
  if (partArea === 0 && width > 0 && height > 0) {
    partArea = width * height * 0.8; // rough 80% nesting efficiency inverse
  }

  return {
    inputType: "dxf",
    boundingWidth:  width,
    boundingHeight: height,
    partArea,
    perimeter: totalPerimeter,
    pierceCount,
    bendCount: 0,       // DXF has no bend info
    bendAngles: [],
    thickness: 0,       // must be user-specified
    thicknessConfidence: "required",
  };
}
