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

  // Write to WASM virtual FS
  const uint8 = new Uint8Array(buffer);
  oc.FS.writeFile("/upload.step", uint8);

  const reader = new oc.STEPControl_Reader_1();
  const readResult = reader.ReadFile("/upload.step");
  const expected = oc.IFSelect_ReturnStatus.IFSelect_RetDone;

  const actualVal = typeof readResult === "object" ? readResult.value : readResult;
  const expectedVal = typeof expected === "object" ? expected.value : expected;

  if (actualVal !== expectedVal) {
    throw new Error(`STEP read failed with status: ${actualVal}`);
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
      classified = {
        index,
        type: "plane",
        face,
        area,
        normal: [dir.X(), dir.Y(), dir.Z()],
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
  if (!f1.normal || !f2.normal) return Math.PI / 2; // fallback

  // Angle between face normals
  const dot =
    f1.normal[0] * f2.normal[0] +
    f1.normal[1] * f2.normal[1] +
    f1.normal[2] * f2.normal[2];
  const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
  return Math.PI - angle; // bend angle = supplement of dihedral angle
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
  kFactor: number
): UnfoldTree | null {
  const planes = classified.filter((f) => f.type === "plane");
  if (planes.length === 0) return null;

  // Seed: largest planar face
  const seed = planes.reduce((a, b) => (a.area > b.area ? a : b));
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
            (angle * 180) / Math.PI,
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

    return {
      id: `flange-${flangeIdx}`,
      label: isRoot ? "Base" : `Flange ${flangeIdx}`,
      geometry: {
        ...geo,
        width: 0,
        height: 0,
        thickness,
      },
      localPosition: isRoot ? centroid as [number, number, number] : [0, 0, 0],
      connectedBends: bends,
    };
  }

  const rootFlange = buildNode(seed.index, true);
  const totalFlanges = planes.length;
  const totalBends = classified.filter((f) => f.type === "cylinder").length;

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
      flatPatternDimensions: { width: 0, height: 0 }, // TODO: compute
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

/** Compute face bounding box dimensions in local XZ plane */
function computeFaceDimensions(face: any): { width: number; height: number } {
  const location = new oc.TopLoc_Location_1();
  const triangulation = oc.BRep_Tool.Triangulation(face, location);
  if (triangulation.IsNull()) {
    location.delete();
    return { width: 0, height: 0 };
  }
  const tri = triangulation.get();
  const nbNodes = tri.NbNodes();
  const trsf = location.Transformation();

  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (let i = 1; i <= nbNodes; i++) {
    const node = tri.Node(i).Transformed(trsf);
    if (node.X() < minX) minX = node.X();
    if (node.X() > maxX) maxX = node.X();
    if (node.Z() < minZ) minZ = node.Z();
    if (node.Z() > maxZ) maxZ = node.Z();
    node.delete();
  }
  location.delete();
  trsf.delete();
  return {
    width:  isFinite(maxX - minX) ? maxX - minX : 0,
    height: isFinite(maxZ - minZ) ? maxZ - minZ : 0,
  };
}

/** Traverse unfold tree to compute flat pattern bounding dimensions */
function computeFlatPatternDims(
  node: import("@/lib/types/unfold").FlangeNode,
  thickness: number
): { width: number; height: number } {
  // Walk the tree linearly — sum widths + bend allowances, take max height
  let totalWidth = node.geometry.width || 0;
  let maxHeight = node.geometry.height || 0;

  for (const bend of node.connectedBends) {
    const ba = bend.properties.bendAllowance;
    const child = bend.childFlange;
    const childDims = computeFlatPatternDims(child, thickness);
    totalWidth += ba + childDims.width;
    if (childDims.height > maxHeight) maxHeight = childDims.height;
  }

  return { width: totalWidth, height: maxHeight };
}

// ── Public API ──────────────────────────────────────────

const api = {
  initialize,

  async parseSTEP(
    fileBuffer: ArrayBuffer,
    kFactor: number = 0.446
  ): Promise<UnfoldTree> {
    if (!oc) await initialize();

    const shape = readSTEP(fileBuffer);
    const faces = extractFaces(shape);
    const classified = classifyFaces(faces);
    const adjacency = buildAdjacency(shape, faces);
    const tree = buildUnfoldTree(classified, adjacency, shape, kFactor);

    if (!tree) {
      throw new Error(
        "Could not build unfold tree. No planar faces found — is this a sheet metal part?"
      );
    }

    return tree;
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

    if (topFace) {
      const dims = computeFaceDimensions(topFace);
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
          const dims = node.geometry.width > 0
            ? { width: node.geometry.width, height: node.geometry.height }
            : computeFaceDimensions(
                classified.find((c) => c.index === parseInt(node.id.replace("flange-", "")))?.face ?? topFace
              );
          node.geometry.width  = dims.width;
          node.geometry.height = dims.height;
          for (const bend of node.connectedBends) {
            bendAngles.push((bend.properties.angle * 180) / Math.PI);
            enrichNode(bend.childFlange);
          }
        }
        enrichNode(tree.rootFlange);

        const flatDims = computeFlatPatternDims(tree.rootFlange, thickness);
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

