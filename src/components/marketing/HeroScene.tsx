"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float } from "@react-three/drei";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────
// HeroScene — Lightweight 3D demo for the marketing page
// Shows a rotating sheet metal bracket with brand lighting
// ─────────────────────────────────────────────────────────

function SheetMetalPart() {
  const groupRef = useRef<THREE.Group>(null);

  // Create an L-bracket shape using BufferGeometry
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    // L-bracket profile (mm, scaled down)
    shape.moveTo(-1.5, -1);
    shape.lineTo(1.5, -1);
    shape.lineTo(1.5, -0.7);
    shape.lineTo(-1.2, -0.7);
    shape.lineTo(-1.2, 1);
    shape.lineTo(-1.5, 1);
    shape.closePath();

    // Add some holes for visual interest
    const hole1 = new THREE.Path();
    hole1.absellipse(0.5, -0.85, 0.08, 0.08, 0, Math.PI * 2, false, 0);
    shape.holes.push(hole1);

    const hole2 = new THREE.Path();
    hole2.absellipse(-1.35, 0.3, 0.08, 0.08, 0, Math.PI * 2, false, 0);
    shape.holes.push(hole2);

    const hole3 = new THREE.Path();
    hole3.absellipse(-1.35, 0.7, 0.08, 0.08, 0, Math.PI * 2, false, 0);
    shape.holes.push(hole3);

    const extrudeSettings = {
      depth: 2.5,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.rotation.y = t * 0.3;
    groupRef.current.rotation.x = Math.sin(t * 0.2) * 0.15;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
      <group ref={groupRef}>
        <mesh geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial
            color="#8a9199"
            metalness={0.92}
            roughness={0.25}
            envMapIntensity={0.8}
          />
        </mesh>
        {/* Wireframe overlay for engineering aesthetic */}
        <mesh geometry={geometry}>
          <meshBasicMaterial
            color="#ff6600"
            wireframe
            transparent
            opacity={0.06}
          />
        </mesh>
      </group>
    </Float>
  );
}

function SecondaryPart() {
  const ref = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.6, -0.6);
    shape.lineTo(0.6, -0.6);
    shape.lineTo(0.6, 0.6);
    shape.lineTo(-0.6, 0.6);
    shape.closePath();

    const centerHole = new THREE.Path();
    centerHole.absellipse(0, 0, 0.2, 0.2, 0, Math.PI * 2, false, 0);
    shape.holes.push(centerHole);

    // Corner holes
    [[-0.4, -0.4], [0.4, -0.4], [0.4, 0.4], [-0.4, 0.4]].forEach(([x, y]) => {
      const h = new THREE.Path();
      h.absellipse(x, y, 0.06, 0.06, 0, Math.PI * 2, false, 0);
      shape.holes.push(h);
    });

    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.15,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.01,
      bevelSegments: 1,
    });
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.z = t * 0.2;
    ref.current.rotation.y = t * 0.15;
  });

  return (
    <Float speed={2} rotationIntensity={0.2} floatIntensity={0.3}>
      <mesh ref={ref} geometry={geometry} position={[2.5, 1, -1]} castShadow>
        <meshStandardMaterial
          color="#6b7280"
          metalness={0.88}
          roughness={0.3}
          envMapIntensity={0.6}
        />
      </mesh>
    </Float>
  );
}

function SceneContent() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} color="#ffffff" />
      <pointLight position={[-3, 2, 4]} intensity={0.5} color="#ff6600" />
      <pointLight position={[3, -2, -3]} intensity={0.3} color="#ff8533" />
      <SheetMetalPart />
      <SecondaryPart />
      <Environment preset="city" />
    </>
  );
}

export default function HeroScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="mkt-demo-viewport">
      {visible && !isMobile ? (
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          style={{ background: "transparent" }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
        >
          <SceneContent />
        </Canvas>
      ) : (
        <div className="mkt-demo-fallback">
          <svg width="80" height="80" viewBox="0 0 40 40" fill="none" opacity="0.15">
            <polygon points="20,2 38,11 38,29 20,38 2,29 2,11" fill="none" stroke="#ff6600" strokeWidth="2" />
            <polygon points="20,10 30,15 30,25 20,30 10,25 10,15" fill="none" stroke="#ff8533" strokeWidth="1.5" />
            <polygon points="20,18 25,20.5 25,25.5 20,28 15,25.5 15,20.5" fill="#ff6600" />
          </svg>
        </div>
      )}
    </div>
  );
}
