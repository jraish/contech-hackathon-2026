"""Test script for /scene/dummy – no pytest required."""

import json, os, sys, time, subprocess, signal

SERVER_URL = os.getenv("TEST_SERVER_URL", "http://127.0.0.1:8000")

def main():
    import httpx

    # Hit /scene/dummy
    resp = httpx.get(f"{SERVER_URL}/scene/dummy", timeout=15)
    resp.raise_for_status()
    data = resp.json()

    os.makedirs("output", exist_ok=True)
    with open("output/scene_dummy.json", "w") as f:
        json.dump(data, f, indent=2)
    print(f"Wrote output/scene_dummy.json  ({len(json.dumps(data))} bytes)")

    # Summary
    print(f"\nScene: {data['count']} buildings, origin_utm={data['origin_utm']}")
    for b in data["buildings"]:
        wall_faces = sum(1 for face in b["faces"] if face["face_type"] == "wall")
        print(
            f"  BIN {b['bin']}: {b['face_count']} faces "
            f"({wall_faces} walls), {b['vertex_count']} vertices"
        )

    # Write OBJ
    obj_lines = ["# UMBRA scene preview"]
    vertex_offset = 0
    for b in data["buildings"]:
        obj_lines.append(f"o building_{b['bin']}")
        for face in b["faces"]:
            for v in face["vertices"]:
                obj_lines.append(f"v {v[0]:.4f} {v[2]:.4f} {v[1]:.4f}")  # swap y/z for OBJ
            for tri in face["indices"]:
                i0 = tri[0] + vertex_offset + 1
                i1 = tri[1] + vertex_offset + 1
                i2 = tri[2] + vertex_offset + 1
                obj_lines.append(f"f {i0} {i1} {i2}")
            vertex_offset += len(face["vertices"])

    with open("output/scene_preview.obj", "w") as f:
        f.write("\n".join(obj_lines) + "\n")
    print(f"Wrote output/scene_preview.obj  ({vertex_offset} total vertices)")


if __name__ == "__main__":
    main()
