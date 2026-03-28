import React from "react";
import * as THREE from "three";

function getColor(faceType) {
  if (faceType === "roof") return "lightgray";
  if (faceType === "wall") return "white";
  return "transparent";
}

function BuildingMesh({ building }) {
  return (
    <>
      {building.faces.map((face, i) => {
        const geometry = new THREE.BufferGeometry();

        const vertices = new Float32Array(face.vertices);
        const indices = face.indices;

        geometry.setAttribute(
          "position",
          new THREE.BufferAttribute(vertices, 3)
        );
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return (
          <mesh key={i} geometry={geometry}>
            <meshStandardMaterial color={getColor(face.face_type)} />
          </mesh>
        );
      })}
    </>
  );
}

export default BuildingMesh;
