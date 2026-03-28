import React from "react";

function SunLight({ solarData }) {
  // Use midday sun (index 6 ~ noon) as the default light position
  const sun = solarData[6] ?? solarData[0];
  const [x, y, z] = sun.vector;

  const dist = 800; // far enough to act like a directional light

  return (
    <>
      <directionalLight
        position={[x * dist, z * dist, -y * dist]} // Three.js: Y=up, Z=toward viewer
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
      <mesh position={[x * dist, z * dist, -y * dist]}>
        <sphereGeometry args={[12, 16, 16]} />
        <meshBasicMaterial color="#fff5a0" />
      </mesh>
    </>
  );
}

export default SunLight;