// ─────────────────────────────────────────────────────────
// DXF Geometry Extractor
// Uses dxf-parser to extract pricing geometry from flat patterns
// Handles: LINE, ARC, CIRCLE, LWPOLYLINE, POLYLINE
// ─────────────────────────────────────────────────────────

import type { PricingGeometry, DXFLayer, DXFPath } from "@/lib/pricing/types";

// dxf-parser ships its own JS, use dynamic require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DxfParser = require("dxf-parser");

interface Vertex { x: number; y: number; bulge?: number }

function lineLength(v0: Vertex, v1: Vertex): number {
  const dx = v1.x - v0.x;
  const dy = v1.y - v0.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function segmentLength(v0: Vertex, v1: Vertex): number {
  const chord = lineLength(v0, v1);
  const bulge = v0.bulge ?? 0;
  if (Math.abs(bulge) < 1e-9) return chord;
  const angle = 4 * Math.atan(Math.abs(bulge));
  if (Math.sin(angle / 2) < 1e-9) return chord;
  const radius = chord / (2 * Math.sin(angle / 2));
  return Math.abs(radius * angle);
}

// Convert AutoCAD color index to Hex.
const ACI_TO_HEX: Record<number, string> = {
  1: "#ff0000", 2: "#ffff00", 3: "#00ff00", 4: "#00ffff",
  5: "#0000ff", 6: "#ff00ff", 7: "#000000", 8: "#808080", 9: "#c0c0c0"
};
function getColor(colorIndex?: number): string {
  return ACI_TO_HEX[colorIndex ?? 7] ?? "#333333";
}

interface ParsedEntity {
  id: number;
  layer: string;
  len: number;
  svgPath: string;
  start?: Vertex;
  end?: Vertex;
  isClosed: boolean;
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

  const entities: any[] = dxf?.entities ?? [];
  const layersMap = new Map<string, DXFLayer>();

  if (dxf.tables?.layer?.layers) {
    for (const [name, layerDef] of Object.entries(dxf.tables.layer.layers as Record<string, { colorNumber?: number }>)) {
      layersMap.set(name, {
        name,
        color: getColor(layerDef.colorNumber),
        entityCount: 0,
      });
    }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function updateBB(x: number, y: number) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const parsedEntities: ParsedEntity[] = [];

  for (let idx = 0; idx < entities.length; idx++) {
    const entity = entities[idx];
    const layerName = entity.layer || "0";
    if (!layersMap.has(layerName)) {
      layersMap.set(layerName, { name: layerName, color: "#333333", entityCount: 0 });
    }
    const layer = layersMap.get(layerName)!;

    let svgPath = "";
    let len = 0;
    let isClosed = false;
    let start: Vertex | undefined;
    let end: Vertex | undefined;

    switch (entity.type) {
      case "LINE": {
        const v0 = entity.vertices?.[0] ?? { x: entity.start?.x ?? 0, y: entity.start?.y ?? 0 };
        const v1 = entity.vertices?.[1] ?? { x: entity.end?.x ?? 0, y: entity.end?.y ?? 0 };
        len = lineLength(v0, v1);
        updateBB(v0.x, v0.y);
        updateBB(v1.x, v1.y);
        svgPath = `M ${v0.x} ${v0.y} L ${v1.x} ${v1.y}`;
        start = v0; end = v1;
        break;
      }
      case "ARC": {
        const { center, radius, startAngle, endAngle } = entity;
        if (!center || !radius) break;
        let sweep = endAngle - startAngle;
        if (sweep <= 0) sweep += 360;
        len = (Math.PI / 180) * sweep * radius;

        const startRad = startAngle * Math.PI / 180;
        const endRad = endAngle * Math.PI / 180;
        const startX = center.x + radius * Math.cos(startRad);
        const startY = center.y + radius * Math.sin(startRad);
        const endX = center.x + radius * Math.cos(endRad);
        const endY = center.y + radius * Math.sin(endRad);
        const largeArcFlag = sweep > 180 ? 1 : 0;
        svgPath = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
        
        updateBB(center.x - radius, center.y - radius);
        updateBB(center.x + radius, center.y + radius);
        start = { x: startX, y: startY };
        end = { x: endX, y: endY };
        break;
      }
      case "CIRCLE": {
        const { center, radius } = entity;
        if (!center || !radius) break;
        len = 2 * Math.PI * radius;
        isClosed = true;
        svgPath = `M ${center.x - radius} ${center.y} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`;
        updateBB(center.x - radius, center.y - radius);
        updateBB(center.x + radius, center.y + radius);
        break;
      }
      case "LWPOLYLINE":
      case "POLYLINE": {
        const verts: Vertex[] = entity.vertices ?? [];
        if (verts.length < 2) break;

        svgPath = `M ${verts[0].x} ${verts[0].y}`;
        for (let i = 0; i < verts.length - 1; i++) {
          len += segmentLength(verts[i], verts[i + 1]);
          updateBB(verts[i].x, verts[i].y);
          svgPath += ` L ${verts[i+1].x} ${verts[i+1].y}`;
        }
        updateBB(verts[verts.length - 1].x, verts[verts.length - 1].y);

        isClosed = entity.closed || entity.shape;
        if (isClosed) {
          len += segmentLength(verts[verts.length - 1], verts[0]);
          svgPath += ` Z`;
        } else {
          start = verts[0];
          end = verts[verts.length - 1];
        }
        break;
      }
      case "SPLINE": {
        const pts: Vertex[] = entity.controlPoints ?? entity.fitPoints ?? [];
        if (pts.length < 2) break;
        svgPath = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
          len += lineLength(pts[i], pts[i + 1]);
          updateBB(pts[i].x, pts[i].y);
          svgPath += ` L ${pts[i+1].x} ${pts[i+1].y}`;
        }
        updateBB(pts[pts.length - 1].x, pts[pts.length - 1].y);
        isClosed = entity.closed;
        if (isClosed) {
          svgPath += ` Z`;
        } else {
          start = pts[0];
          end = pts[pts.length - 1];
        }
        break;
      }
    }

    if (len > 0) {
      layer.entityCount++;
      parsedEntities.push({
        id: idx,
        layer: layerName,
        len,
        svgPath,
        start,
        end,
        isClosed
      });
    }
  }

  // Group entities into connected paths per layer
  // A path is a collection of SVG strings that form a single cut
  const finalPaths: DXFPath[] = [];

  // Group by layer first
  const layerGroups = new Map<string, ParsedEntity[]>();
  for (const pe of parsedEntities) {
    if (!layerGroups.has(pe.layer)) layerGroups.set(pe.layer, []);
    layerGroups.get(pe.layer)!.push(pe);
  }

  const TOLERANCE = 0.01;

  for (const [layerName, ents] of layerGroups.entries()) {
    const unvisited = new Set(ents);

    while (unvisited.size > 0) {
      // Start a new connected path
      const first = unvisited.values().next().value as ParsedEntity;
      unvisited.delete(first);

      let currentSvg = first.svgPath;
      let currentLen = first.len;
      let pathIsClosed = first.isClosed;

      // If it's already closed, we don't need to connect it to anything
      if (!pathIsClosed && first.start && first.end) {
        let currentStart = { ...first.start };
        let currentEnd = { ...first.end };
        let added = true;

        while (added) {
          added = false;
          for (const cand of unvisited) {
            if (cand.isClosed) continue;
            
            // Check connections
            const dSS = lineLength(currentStart, cand.start!);
            const dSE = lineLength(currentStart, cand.end!);
            const dES = lineLength(currentEnd, cand.start!);
            const dEE = lineLength(currentEnd, cand.end!);

            if (dES < TOLERANCE) {
              currentSvg += ` ` + cand.svgPath;
              currentEnd = cand.end!;
            } else if (dEE < TOLERANCE) {
              currentSvg += ` ` + cand.svgPath; // Not reversing perfectly for SVG string, but good enough for render visually
              currentEnd = cand.start!;
            } else if (dSS < TOLERANCE) {
              currentSvg += ` ` + cand.svgPath;
              currentStart = cand.end!;
            } else if (dSE < TOLERANCE) {
              currentSvg += ` ` + cand.svgPath;
              currentStart = cand.start!;
            } else {
              continue; // no connection
            }

            // connected!
            currentLen += cand.len;
            unvisited.delete(cand);
            added = true;

            // Check if we closed the loop
            if (lineLength(currentStart, currentEnd) < TOLERANCE) {
              pathIsClosed = true;
              currentSvg += ` Z`;
            }
            break; // restart loop with new endpoints
          }
          if (pathIsClosed) break;
        }
      }

      finalPaths.push({
        id: Math.random().toString(36).substring(7),
        layer: layerName,
        color: layersMap.get(layerName)!.color,
        svgPath: currentSvg,
        length: currentLen,
        isClosed: pathIsClosed,
      });
    }
  }

  const layers = Array.from(layersMap.values()).filter(l => l.entityCount > 0);

  const width  = isFinite(maxX - minX) ? maxX - minX : 0;
  const height = isFinite(maxY - minY) ? maxY - minY : 0;
  const partArea = width * height * 0.8;

  const totalPerimeter = finalPaths.reduce((sum, p) => sum + p.length, 0);
  const pierceCount = finalPaths.length;

  return {
    inputType: "dxf",
    boundingWidth:  width,
    boundingHeight: height,
    partArea,
    perimeter: totalPerimeter,
    pierceCount,
    bendCount: 0,
    bendAngles: [],
    thickness: 0,
    thicknessConfidence: "required",
    dxfData: {
      layers,
      paths: finalPaths,
      minX: isFinite(minX) ? minX : 0,
      minY: isFinite(minY) ? minY : 0,
    }
  };
}
