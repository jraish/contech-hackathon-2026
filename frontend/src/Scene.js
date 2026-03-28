import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import BuildingMesh from "./BuildingMesh";
import SunLight from "./SunLight";

function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[2000, 2000]} />
      <meshStandardMaterial color="#c8d4b8" roughness={1} metalness={0} />
    </mesh>
  );
}

function buildAnalysisMap(analyzeData) {
  if (!analyzeData) return null;
  const buildings = analyzeData.buildings ?? analyzeData;
  const map = {};
  for (const b of buildings) {
    map[b.bin] = b.meshes ?? b.faces ?? [];
  }
  return map;
}

function Scene({ sceneData, solarData, analyzeData, sunIndex }) {
  const sun = solarData[sunIndex] ?? solarData[0];
  const analysisMap = buildAnalysisMap(analyzeData);
  const showAnalysis = analysisMap !== null;

  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      shadows="soft"
      camera={{ position: [300, 150, 300], fov: 45, near: 1, far: 10000 }}
    >
      <ambientLight intensity={0.5} />

      <Sky
        distance={4500}
        sunPosition={sun ? [sun.vector[0], sun.vector[2], -sun.vector[1]] : [1, 0.5, 0]}
        inclination={0}
        azimuth={0.25}
      />

      <SunLight sun={sun} />
      <GroundPlane />

      {sceneData.buildings.map((b, i) => (
        <BuildingMesh
          key={b.bin ?? i}
          building={b}
          analysisData={analysisMap ? analysisMap[b.bin] ?? null : null}
          showAnalysis={showAnalysis}
        />
      ))}

      <OrbitControls
        target={[0, 40, 0]}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={0.1}
        enablePan
        enableZoom
        enableRotate
      />
    </Canvas>
  );
}

export default Scene;