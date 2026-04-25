"use client";

import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  Grid,
  ContactShadows,
  PerspectiveCamera,
  GizmoHelper,
  GizmoViewcube,
} from "@react-three/drei";
import { Suspense } from "react";

interface R3FViewportProps {
  children: React.ReactNode;
  showGrid?: boolean;
}

/** Loading fallback rendered inside the Canvas */
function LoadingIndicator() {
  return (
    <mesh>
      <sphereGeometry args={[0.05, 16, 16]} />
      <meshStandardMaterial color="#ff6600" emissive="#ff6600" emissiveIntensity={2} />
    </mesh>
  );
}

export function R3FViewport({ children, showGrid = true }: R3FViewportProps) {
  return (
    <Canvas
      gl={{ antialias: true }}
      style={{ background: "transparent" }}
    >
      <PerspectiveCamera makeDefault position={[1.5, 1.2, 1.5]} fov={45} near={0.01} far={100} />

      {/* Lighting & Environment */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 8, 5]} intensity={2.0} castShadow />
      <pointLight position={[-3, 4, -2]} intensity={1.0} />
      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>

      {/* Ground & Shadows */}
      <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={2} blur={1.5} far={4} color="#0f172a" />
      {showGrid && (
        <Grid
          args={[10, 10]}
          cellSize={0.1}
          cellThickness={0.5}
          cellColor="#cbd5e1"
          sectionSize={0.5}
          sectionThickness={1}
          sectionColor="#94a3b8"
          fadeDistance={8}
          fadeStrength={1.5}
          position={[0, -0.005, 0]}
          infiniteGrid
        />
      )}

      {/* Controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={0.3}
        maxDistance={5}
        target={[0.3, 0.15, 0.15]}
        makeDefault
      />

      {/* Navigation Cube */}
      <GizmoHelper alignment="top-right" margin={[80, 80]}>
        <GizmoViewcube
          color="#ff6600"       /* Industrial orange */
          opacity={0.15}        /* Translucent faces */
          strokeColor="#ff6600" /* Solid orange edges */
          textColor="#1e293b"   /* Charcoal text */
          hoverColor="#ff6600"  /* Solid orange on hover */
          faces={['Right', 'Left', 'Top', 'Bottom', 'Front', 'Back']}
        />
      </GizmoHelper>

      <Suspense fallback={<LoadingIndicator />}>
        {children}
      </Suspense>
    </Canvas>
  );
}
