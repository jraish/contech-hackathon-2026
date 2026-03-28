import React, { useMemo } from "react";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

const COLOR_STOPS = [
  { t: 0.00, r: 0.10, g: 0.14, b: 0.49 },
  { t: 0.25, r: 0.08, g: 0.40, b: 0.75 },
  { t: 0.50, r: 0.00, g: 0.54, b: 0.48 },
  { t: 0.75, r: 0.98, g: 0.65, b: 0.15 },
  { t: 1.00, r: 1.00, g: 1.00, b: 0.00 },
];

function sunFractionToColor(fraction) {
  const f = Math.max(0, Math.min(1, fraction));
  let lo = COLOR_STOPS[0];
  let hi = COLOR_STOPS[COLOR_STOPS.length - 1];
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (f >= COLOR_STOPS[i].t && f <= COLOR_STOPS[i + 1].t) {
      lo = COLOR_STOPS[i];
      hi = COLOR_STOPS[i + 1];
      break;
    }
  }
  const span = hi.t - lo.t;
  const a = span === 0 ? 0 : (f - lo.t) / span;
  return new THREE.Color(
    lo.r + a * (hi.r - lo.r),
    lo.g + a * (hi.g - lo.g),
    lo.b + a * (hi.b - lo.b)
  );
}

// Target building colors — bright yellow/gold that stands out clearly
const TARGET_COLORS = {
  roof: new THREE.Color("#FFD700"),   // gold roof
  wall: new THREE.Color("#FFF176"),   // bright yellow walls
};

const DEFAULT_COLORS = {
  roof: new THREE.Color("#b0b8c1"),
  wall: new THREE.Color("#d6dde3"),
};

// ---------------------------------------------------------------------------
// Geometry builder — Z-up data → Three.js Y-up
// ---------------------------------------------------------------------------

function makeFaceGeometry(face) {
  const geo = new THREE.BufferGeometry();
  const raw = face.vertices;
  const flat =
    typeof raw[0] === "number"
      ? raw
      : raw.flatMap(([x, y, z]) => [x, z, y]);

  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(flat), 3));
  geo.setIndex(face.indices);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Single face
// ---------------------------------------------------------------------------

function FaceMesh({ face, analysisFace, showAnalysis, isTarget }) {
  const geometry = useMemo(() => makeFaceGeometry(face), [face]);

  const material = useMemo(() => {
    const isWall = face.face_type === "wall";
    const isRoof = face.face_type === "roof";

    let color;

    if (isTarget) {
      // Target building always highlighted — analysis colors override walls only
      if (showAnalysis && isWall && analysisFace != null) {
        color = sunFractionToColor(analysisFace.sun_fraction ?? face.sun_fraction ?? 0);
      } else {
        color = TARGET_COLORS[face.face_type] ?? TARGET_COLORS.wall;
      }
    } else if (showAnalysis && isWall && analysisFace != null) {
      color = sunFractionToColor(analysisFace.sun_fraction ?? face.sun_fraction ?? 0);
    } else if (showAnalysis && isRoof) {
      color = new THREE.Color("#8a9ba8");
    } else {
      color = DEFAULT_COLORS[face.face_type] ?? DEFAULT_COLORS.wall;
    }

    return new THREE.MeshStandardMaterial({
      color,
      roughness: isTarget ? 0.4 : 0.85,
      metalness: isTarget ? 0.2 : 0.05,
      // Give the target building a subtle emissive glow so it reads even in shadow
      emissive: isTarget ? new THREE.Color("#FFD700") : new THREE.Color(0x000000),
      emissiveIntensity: isTarget ? 0.15 : 0,
    });
  }, [face.face_type, showAnalysis, analysisFace, face.sun_fraction, isTarget]);

  if (face.face_type === "floor") return null;

  return (
    <mesh geometry={geometry} material={material} castShadow receiveShadow />
  );
}

// ---------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------

function BuildingMesh({ building, analysisData, showAnalysis }) {
  const faces = building.meshes ?? building.faces ?? [];
  // is_target can come from the building object or from individual faces
  const isTarget = building.is_target ?? faces[0]?.is_target ?? false;

  return (
    <>
      {faces.map((face, i) => {
        if (face.face_type === "floor") return null;
        const analysisFace = analysisData ? analysisData[i] ?? null : null;
        return (
          <FaceMesh
            key={i}
            face={face}
            analysisFace={analysisFace}
            showAnalysis={showAnalysis}
            isTarget={isTarget}
          />
        );
      })}
    </>
  );
}

export default BuildingMesh;