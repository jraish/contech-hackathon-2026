import React, { useMemo } from "react";
import * as THREE from "three";

function faceColor(faceType) {
  if (faceType === "roof") return "#b0b8c1";   // cool gray
  if (faceType === "wall") return "#d6dde3";   // slightly lighter gray
  return null;                                  // floor — skip rendering
}

function BuildingMesh({ building }) {
  const faces = building.meshes ?? building.faces ?? [];

  return (
    <>
      {faces.map((face, i) => {
        const color = faceColor(face.face_type);

        // Don't render floors — they're hidden underground anyway
        if (!color) return null;

        // eslint-disable-next-line react-hooks/rules-of-hooks
        const geometry = useMemo(() => {
          const geo = new THREE.BufferGeometry();

          // Dummy JSON has nested [[x,y,z],...], real API may send flat [x,y,z,...]
          const raw = face.vertices;
          const flat =
            typeof raw[0] === "number"
              ? raw  // already flat — assume caller handled axis swap
              : raw.flatMap(([x, y, z]) => [x, z, y]);

          geo.setAttribute(
            "position",
            new THREE.BufferAttribute(new Float32Array(flat), 3)
          );
          geo.setIndex(face.indices);
          geo.computeVertexNormals();
          return geo;
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [face]);

        return (
          <mesh key={i} geometry={geometry} castShadow receiveShadow>
            <meshStandardMaterial
              color={color}
              roughness={0.8}
              metalness={0.1}
            />
          </mesh>
        );
      })}
    </>
  );
}

export default BuildingMesh;