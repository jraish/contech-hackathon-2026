import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import BuildingMesh from "./BuildingMesh";
import SunLight from "./SunLight";

function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[2000, 2000]} />
      <meshStandardMaterial color="#2d4a2d" />
    </mesh>
  );
}

function Scene({ sceneData, solarData }) {
  // Figure out a good camera distance based on the scene extents
  const cameraDistance = 300;

  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      shadows
      camera={{
        position: [cameraDistance, cameraDistance * 0.5, cameraDistance],
        fov: 45,
        near: 1,
        far: 10000,
      }}
    >
      {/* Ambient fill so shadowed areas aren't pitch black */}
      <ambientLight intensity={0.3} />

      {/* Sky background — moves with sun position */}
      <Sky
        distance={4500}
        sunPosition={solarData[6]?.vector ?? [1, 0.5, 0]}
        inclination={0}
        azimuth={0.25}
      />

      <SunLight solarData={solarData} />

      {/* Ground */}
      <GroundPlane />

      {/* Buildings */}
      {sceneData.buildings.map((b, i) => (
        <BuildingMesh key={i} building={b} />
      ))}

      {/* Orbit locked to vertical axis — no flipping upside down */}
      <OrbitControls
        target={[0, 40, 0]}          // look at mid-building height
        maxPolarAngle={Math.PI / 2.2} // can't go below ground
        minPolarAngle={0.1}           // can't go straight up
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
      />
    </Canvas>
  );
}

export default Scene;