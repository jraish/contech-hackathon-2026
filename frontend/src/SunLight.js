import React from "react";

function SunLight({ solarData }) {
  const sun = solarData[0]; // first sun position
  const [x, y, z] = sun.vector;

  return (
    <>
      <directionalLight position={[x * 100, y * 100, z * 100]} intensity={1} />
      
      <mesh position={[x * 100, y * 100, z * 100]}>
        <sphereGeometry args={[5, 32, 32]} />
        <meshBasicMaterial color="yellow" />
      </mesh>
    </>
  );
}

export default SunLight;
