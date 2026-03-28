import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import BuildingMesh from "./BuildingMesh";
import SunLight from "./SunLight";

function Scene({ sceneData, solarData }) {
  return (
    <Canvas camera={{ position: [100, 100, 100] }}>
      <ambientLight intensity={0.5} />

      <SunLight solarData={solarData} />

      <OrbitControls />

      {sceneData.buildings.map((b, i) => (
        <BuildingMesh key={i} building={b} />
      ))}
    </Canvas>
  );
}

export default Scene;
