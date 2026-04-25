"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FlangeNode, BendTransition, MaterialPreset } from "@/lib/types/unfold";

interface SheetMetalModelProps {
  rootFlange: FlangeNode;
  progressRef: React.RefObject<number>;
  material: MaterialPreset;
  /** Scale factor to normalize parts to a viewable size */
  scale?: number;
  wireframe?: boolean;
  transparent?: boolean;
}

/**
 * Recursively renders the unfold tree as a Three.js scene graph.
 * Each bend becomes a hinge <group> whose rotation is driven by the progress ref.
 *
 * Scene graph structure:
 *   <root group> (scale + centering)
 *     <FlangeMesh>  (base flange box at its localPosition)
 *     <HingeGroup position={axisOrigin}>
 *       <BendZoneMesh>  (procedural cylinder arc, vertices in local HingeGroup space)
 *       <rotation group>  (quaternion slerp + BA offset)
 *         <FlangeMesh>  (child flange box at its localPosition)
 *         ...recurse
 */
export function SheetMetalModel({
  rootFlange,
  progressRef,
  material,
  scale = 0.01,
  wireframe = false,
  transparent = false,
}: SheetMetalModelProps) {
  return (
    <group scale={[scale, scale, scale]}>
      <FlangeMesh flange={rootFlange} material={material} wireframe={wireframe} transparent={transparent} />
      {rootFlange.connectedBends.map((bend) => (
        <HingeGroup
          key={bend.id}
          bend={bend}
          progressRef={progressRef}
          material={material}
          wireframe={wireframe}
          transparent={transparent}
        />
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────
// FlangeMesh — renders a single planar flange face
// ─────────────────────────────────────────────────────────

function FlangeMesh({
  flange,
  material,
  wireframe,
  transparent,
}: {
  flange: FlangeNode;
  material: MaterialPreset;
  wireframe: boolean;
  transparent: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { width, height, thickness, vertices, indices, normals } = flange.geometry;
  const [x, y, z] = flange.localPosition;
  const hasKernelGeometry = vertices && vertices.length > 0;

  const bufferGeo = useMemo(() => {
    if (!hasKernelGeometry) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(vertices!, 3));
    if (normals && normals.length > 0) {
      geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    } else {
      geo.computeVertexNormals();
    }
    if (indices && indices.length > 0) {
      geo.setIndex(new THREE.BufferAttribute(indices, 1));
    }
    return geo;
  }, [hasKernelGeometry, vertices, normals, indices]);

  return (
    <mesh ref={meshRef} position={[x, y, z]} castShadow receiveShadow geometry={bufferGeo || undefined}>
      {!hasKernelGeometry && (
        <boxGeometry args={[width, thickness, height]} />
      )}
      <meshStandardMaterial
        color={material.color}
        metalness={material.metalness}
        roughness={material.roughness}
        envMapIntensity={1.2}
        side={THREE.DoubleSide}
        wireframe={wireframe}
        transparent={transparent}
        opacity={transparent ? 0.3 : 1}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────
// BendZoneMesh — procedural cylinder strip between flanges
//
// The cylinder arc is generated in the HingeGroup's local
// coordinate space. The arc sweeps from theta=0 (parent edge)
// to theta=bendAngle (child edge).
//
// Key vectors (all in HingeGroup-local space):
//   axisVec   - the bend axis direction (e.g. [0,0,1])
//   parentDir - direction from axis toward the parent flange
//               (theta=0 of the arc starts here)
//   sweepDir  - cross(axisVec, parentDir), the sweep direction
//
// parentDir is the UN-rotated radial direction: the direction
// from the hinge toward the parent flange's edge in the base
// XY plane. For a Z-axis bend at x=100 with parent centered
// at x=50, parentDir = [-1, 0, 0] (toward the parent).
// ─────────────────────────────────────────────────────────

const ARC_SEGMENTS = 16;

function BendZoneMesh({
  bend,
  progressRef,
  material,
  wireframe,
  transparent,
}: {
  bend: BendTransition;
  progressRef: React.RefObject<number>;
  material: MaterialPreset;
  wireframe: boolean;
  transparent: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { properties } = bend;
  const { radius, thickness, angle, bendWidth } = properties;
  const depth = bendWidth || 50;

  // Build the coordinate frame for the arc.
  //
  // parentDir: the direction from the hinge axis TOWARD the parent flange.
  // For the L-Bracket: hinge at x=100, parent centered at x=50 → parentDir = [-1,0,0]
  //
  // We derive parentDir from the child flange's UNrotated localPosition:
  //   childPos = [30, 0, 25] → perpendicular to axis Z is [30, 0, 0] → normalized [1,0,0]
  //   That points AWAY from parent, so parentDir = -childPosPerp = [-1,0,0]
  //
  // The arc starts at parentDir (theta=0) and sweeps toward the child.
  const { axisVec, parentDir, sweepDir } = useMemo(() => {
    const a = new THREE.Vector3(...properties.axisDirection).normalize();

    // Get the child's position projected perpendicular to the axis
    const childPos = new THREE.Vector3(...bend.childFlange.localPosition);
    const axisProj = childPos.clone().projectOnVector(a);
    const childPerp = childPos.clone().sub(axisProj);

    let pDir: THREE.Vector3;
    if (childPerp.length() > 0.001) {
      // parentDir is OPPOSITE to childPerp (toward parent, not child)
      pDir = childPerp.normalize().negate();
    } else {
      // Fallback: pick something perpendicular to axis
      const up = Math.abs(a.y) > 0.9
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0);
      pDir = new THREE.Vector3().crossVectors(up, a).normalize();
    }

    // sweepDir completes the right-hand frame: sweepDir = cross(axisVec, parentDir)
    const sDir = new THREE.Vector3().crossVectors(a, pDir).normalize();

    return { axisVec: a, parentDir: pDir, sweepDir: sDir };
  }, [properties.axisDirection, bend.childFlange.localPosition]);

  // Z-center: the arc's depth extent should match the flange depth.
  // The child's Z-component in localPosition tells us where it's centered.
  const depthCenter = useMemo(() => {
    const childPos = new THREE.Vector3(...bend.childFlange.localPosition);
    // The Z-component along the axis direction
    return childPos.dot(axisVec);
  }, [bend.childFlange.localPosition, axisVec]);

  // Build index buffer (doesn't change)
  const indices = useMemo(() => {
    const idx: number[] = [];
    for (let i = 0; i < ARC_SEGMENTS; i++) {
      const base = i * 4;
      const next = (i + 1) * 4;
      // Inner surface
      idx.push(base + 0, next + 0, next + 1);
      idx.push(base + 0, next + 1, base + 1);
      // Outer surface
      idx.push(base + 2, next + 3, next + 2);
      idx.push(base + 2, base + 3, next + 3);
      // Side cap A
      idx.push(base + 0, next + 2, next + 0);
      idx.push(base + 0, base + 2, next + 2);
      // Side cap B
      idx.push(base + 1, next + 1, next + 3);
      idx.push(base + 1, next + 3, base + 3);
    }
    return new Uint32Array(idx);
  }, []);

  // Allocate geometry once
  const bendGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertexCount = (ARC_SEGMENTS + 1) * 4;
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return geo;
  }, [indices]);

  // Reusable vectors
  const _radDir = useMemo(() => new THREE.Vector3(), []);
  const _pos = useMemo(() => new THREE.Vector3(), []);

  // Per-frame: update arc vertex positions
  // Interpolate between arc shape (folded) and flat strip (unfolded)
  useFrame(() => {
    if (!bendGeo) return;
    const progress = progressRef.current ?? 0;
    const posAttr = bendGeo.getAttribute("position") as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;

    const innerR = radius;
    const outerR = radius + thickness;
    const halfD = depth / 2;
    const absAngle = Math.abs(angle);

    // Flat strip dimensions: the unfolded bend zone becomes a flat rectangle.
    // The strip extends from the parent edge in the -parentDir direction
    // (which is the child/outward direction).
    // childDir = -parentDir (the direction toward the child when flat)
    // The flat strip length should match the bend allowance (neutral fiber)
    // so the strip exactly bridges parent edge → child edge.
    const flatStripLen = properties.bendAllowance;

    // childDir = direction the strip extends when flat (away from parent)
    // childDir = -parentDir
    const childDirX = -parentDir.x;
    const childDirY = -parentDir.y;
    const childDirZ = -parentDir.z;

    for (let i = 0; i <= ARC_SEGMENTS; i++) {
      const t = i / ARC_SEGMENTS;
      const base = i * 4 * 3;

      // ── ARC position (folded state) ──
      const theta = t * angle;  // preserves sign for CW/CCW
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      _radDir.copy(parentDir).multiplyScalar(cosT).addScaledVector(sweepDir, sinT);

      // Arc center is offset so inner surface at theta=0 = hinge origin
      // arcCenter = -parentDir * innerR
      // innerArc = arcCenter + radDir * innerR
      // outerArc = arcCenter + radDir * outerR
      const acx = -parentDir.x * innerR;
      const acy = -parentDir.y * innerR;
      const acz = -parentDir.z * innerR;

      const innerArcX = acx + _radDir.x * innerR;
      const innerArcY = acy + _radDir.y * innerR;
      const innerArcZ = acz + _radDir.z * innerR;

      const outerArcX = acx + _radDir.x * outerR;
      const outerArcY = acy + _radDir.y * outerR;
      const outerArcZ = acz + _radDir.z * outerR;

      // ── FLAT position (unfolded state) ──
      // Inner surface: flat strip from origin, extending childDir by flatStripLen
      const innerFlatX = childDirX * t * flatStripLen;
      const innerFlatY = childDirY * t * flatStripLen;
      const innerFlatZ = childDirZ * t * flatStripLen;

      // Outer surface: same extension but offset by thickness perpendicular to the flat plane
      // When flat, the "up" direction is sweepDir (perpendicular to parent surface)
      const outerFlatX = childDirX * t * flatStripLen + sweepDir.x * thickness;
      const outerFlatY = childDirY * t * flatStripLen + sweepDir.y * thickness;
      const outerFlatZ = childDirZ * t * flatStripLen + sweepDir.z * thickness;

      // ── LERP between arc and flat ──
      const p = progress;
      const ip = 1 - progress;

      // Inner, depth = depthCenter - halfD
      positions[base + 0] = (ip * innerArcX + p * innerFlatX) + axisVec.x * (depthCenter - halfD);
      positions[base + 1] = (ip * innerArcY + p * innerFlatY) + axisVec.y * (depthCenter - halfD);
      positions[base + 2] = (ip * innerArcZ + p * innerFlatZ) + axisVec.z * (depthCenter - halfD);

      // Inner, depth = depthCenter + halfD
      positions[base + 3] = (ip * innerArcX + p * innerFlatX) + axisVec.x * (depthCenter + halfD);
      positions[base + 4] = (ip * innerArcY + p * innerFlatY) + axisVec.y * (depthCenter + halfD);
      positions[base + 5] = (ip * innerArcZ + p * innerFlatZ) + axisVec.z * (depthCenter + halfD);

      // Outer, depth = depthCenter - halfD
      positions[base + 6] = (ip * outerArcX + p * outerFlatX) + axisVec.x * (depthCenter - halfD);
      positions[base + 7] = (ip * outerArcY + p * outerFlatY) + axisVec.y * (depthCenter - halfD);
      positions[base + 8] = (ip * outerArcZ + p * outerFlatZ) + axisVec.z * (depthCenter - halfD);

      // Outer, depth = depthCenter + halfD
      positions[base + 9] = (ip * outerArcX + p * outerFlatX) + axisVec.x * (depthCenter + halfD);
      positions[base + 10] = (ip * outerArcY + p * outerFlatY) + axisVec.y * (depthCenter + halfD);
      positions[base + 11] = (ip * outerArcZ + p * outerFlatZ) + axisVec.z * (depthCenter + halfD);
    }

    posAttr.needsUpdate = true;
    bendGeo.computeVertexNormals();
  });

  return (
    <mesh ref={meshRef} geometry={bendGeo} castShadow receiveShadow>
      <meshStandardMaterial
        color={material.color}
        metalness={material.metalness}
        roughness={material.roughness}
        envMapIntensity={1.2}
        side={THREE.DoubleSide}
        wireframe={wireframe}
        transparent={transparent}
        opacity={transparent ? 0.3 : 1}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────
// HingeGroup — positioned at the bend axis, rotates child
//
// At progress=0 (folded): child is rotated by the fold angle
// At progress=1 (flat):   child lies flat, offset by bend allowance
//
// The BA offset direction is the UNFOLDED direction: the
// direction the child extends when flat. This is the same as
// the child's perpendicular-to-axis position (before fold rotation).
// For L-Bracket child at [30,0,25] with Z axis: childPerp = [1,0,0]
// ─────────────────────────────────────────────────────────

function HingeGroup({
  bend,
  progressRef,
  material,
  wireframe,
  transparent,
}: {
  bend: BendTransition;
  progressRef: React.RefObject<number>;
  material: MaterialPreset;
  wireframe: boolean;
  transparent: boolean;
}) {
  const rotationGroupRef = useRef<THREE.Group>(null);
  const { properties, childFlange } = bend;
  const [ox, oy, oz] = properties.axisOrigin;

  // Pre-compute quaternions for folded and flat states
  const foldedQuat = useRef(new THREE.Quaternion());
  const flatQuat = useRef(new THREE.Quaternion());
  const currentQuat = useRef(new THREE.Quaternion());
  const axisVec = useRef(new THREE.Vector3(...properties.axisDirection).normalize());

  // The fold angle: rotation from flat to folded
  foldedQuat.current.setFromAxisAngle(axisVec.current, properties.angle);

  // BA direction: the direction the child slides in when UNFOLDED.
  // This is the child's perpendicular-to-axis direction (NOT rotated by fold).
  // For L-Bracket: childPos = [30,0,25], axis = Z → perpendicular = [30,0,0] → norm [1,0,0]
  // When flat, the child extends in +X from the hinge, so BA slides it further in +X.
  const baDirVec = useRef<THREE.Vector3>(null!);
  if (!baDirVec.current) {
    const childCenter = new THREE.Vector3(...childFlange.localPosition);
    // Project out the axis component to get the perpendicular direction
    const axisProj = childCenter.clone().projectOnVector(axisVec.current);
    const radial = childCenter.clone().sub(axisProj);
    if (radial.length() > 0.001) {
      radial.normalize();
    } else {
      // Fallback
      const up = Math.abs(axisVec.current.y) > 0.9
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0);
      radial.crossVectors(up, axisVec.current).normalize();
    }
    baDirVec.current = radial;
  }

  useFrame(() => {
    if (!rotationGroupRef.current) return;
    const progress = progressRef.current ?? 0;

    // Slerp from folded → flat
    currentQuat.current.slerpQuaternions(
      foldedQuat.current,
      flatQuat.current,
      progress
    );
    rotationGroupRef.current.quaternion.copy(currentQuat.current);

    // Bend allowance offset: slide child outward as it unfolds
    const baOffset = properties.bendAllowance * progress;
    rotationGroupRef.current.position.set(
      baDirVec.current.x * baOffset,
      baDirVec.current.y * baOffset,
      baDirVec.current.z * baOffset
    );
  });

  return (
    <group position={[ox, oy, oz]}>
      {/* Bend zone mesh (the connecting cylinder strip) */}
      <BendZoneMesh
        bend={bend}
        progressRef={progressRef}
        material={material}
        wireframe={wireframe}
        transparent={transparent}
      />
      {/* Rotating group containing child flange */}
      <group ref={rotationGroupRef}>
        <FlangeMesh flange={childFlange} material={material} wireframe={wireframe} transparent={transparent} />
        {/* Recursively render any child bends */}
        {childFlange.connectedBends.map((childBend) => (
          <HingeGroup
            key={childBend.id}
            bend={childBend}
            progressRef={progressRef}
            material={material}
            wireframe={wireframe}
            transparent={transparent}
          />
        ))}
      </group>
    </group>
  );
}
