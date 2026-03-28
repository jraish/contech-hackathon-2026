import React from "react";

function SunLight({ sun }) {
  if (!sun) return null;

  // Remap Z-up solar vector → Three.js Y-up
  const [sx, sy, sz] = sun.vector;
  const dist = 800;
  const tx = sx * dist;
  const ty = sz * dist;   // Z (elevation) → Three.js Y
  const tz = -sy * dist;  // Y (north) → Three.js -Z

  return (
    <>
      <directionalLight
        position={[tx, ty, tz]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={3000}
        shadow-camera-left={-600}
        shadow-camera-right={600}
        shadow-camera-top={600}
        shadow-camera-bottom={-600}
      />
      {/* Visible sun sphere */}
      <mesh position={[tx, ty, tz]}>
        <sphereGeometry args={[12, 16, 16]} />
        <meshBasicMaterial color="#fff5a0" />
      </mesh>
    </>
  );
}

export default SunLight;