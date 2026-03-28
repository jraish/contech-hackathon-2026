"""UMBRA FastAPI backend – Milestones 1 & 2.  Zero native C deps."""

import os, math
from typing import List

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

app = FastAPI(title="UMBRA API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── Pure-math WGS84 → UTM Zone 18N ──────────────────────────

_a = 6378137.0
_f = 1 / 298.257223563
_e2 = 2 * _f - _f * _f
_k0 = 0.9996
_lon0 = math.radians(-75)


def _latlon_to_utm18n(lat_deg: float, lon_deg: float):
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    sin_lat, cos_lat, tan_lat = math.sin(lat), math.cos(lat), math.tan(lat)
    ep2 = _e2 / (1 - _e2)
    N = _a / math.sqrt(1 - _e2 * sin_lat**2)
    T, C, A = tan_lat**2, ep2 * cos_lat**2, (lon - _lon0) * cos_lat
    M = _a * (
        (1 - _e2/4 - 3*_e2**2/64 - 5*_e2**3/256) * lat
        - (3*_e2/8 + 3*_e2**2/32 + 45*_e2**3/1024) * math.sin(2*lat)
        + (15*_e2**2/256 + 45*_e2**3/1024) * math.sin(4*lat)
        - (35*_e2**3/3072) * math.sin(6*lat)
    )
    x = _k0 * N * (A + (1-T+C)*A**3/6 + (5-18*T+T**2+72*C-58*ep2)*A**5/120) + 500000
    y = _k0 * (M + N*tan_lat*(A**2/2 + (5-T+9*C+4*C**2)*A**4/24 + (61-58*T+T**2+600*C-330*ep2)*A**6/720))
    return x, y


# ── Models ────────────────────────────────────────────────────

class BuildingQuery(BaseModel):
    lat: float
    lon: float
    radius: float = 500.0

class BuildingGeometry(BaseModel):
    type: str = "Polygon"
    coordinates: list
    crs: str = "EPSG:32618"

class BuildingOut(BaseModel):
    bin: str
    heightroof: float
    groundelev: float
    geometry: BuildingGeometry

class BuildingsResponse(BaseModel):
    buildings: List[BuildingOut]
    count: int
    crs: str = "EPSG:32618"

class Face(BaseModel):
    vertices: List[List[float]]
    indices: List[List[int]]
    normal: List[float]
    face_type: str

class BuildingMesh(BaseModel):
    bin: str
    faces: List[Face]
    vertex_count: int
    face_count: int

class SceneResponse(BaseModel):
    buildings: List[BuildingMesh]
    origin_utm: List[float]
    count: int

# ── Dummy data ────────────────────────────────────────────────

DUMMY_BUILDINGS_RAW = [
    {"bin":"1234567","heightroof":45.0,"groundelev":2.5,
     "coords_utm":[[583960,4507523],[583980,4507523],[583980,4507543],[583960,4507543],[583960,4507523]]},
    {"bin":"2345678","heightroof":78.5,"groundelev":5.0,
     "coords_utm":[[583900,4507600],[583930,4507600],[583930,4507635],[583900,4507635],[583900,4507600]]},
    {"bin":"3456789","heightroof":95.2,"groundelev":8.3,
     "coords_utm":[[584010,4507480],[584050,4507480],[584050,4507520],[584010,4507520],[584010,4507480]]},
]
DUMMY_ORIGIN_UTM = [583960.0, 4507523.0]

def _dummy_buildings():
    return [BuildingOut(bin=b["bin"], heightroof=b["heightroof"], groundelev=b["groundelev"],
                        geometry=BuildingGeometry(coordinates=[b["coords_utm"]])) for b in DUMMY_BUILDINGS_RAW]

# ── /buildings endpoints ──────────────────────────────────────

NYC_OPEN_DATA = "https://data.cityofnewyork.us/resource/5zhs-2jue.json"
NYC_APP_TOKEN = os.getenv("NYC_APP_TOKEN", "")

@app.post("/buildings", response_model=BuildingsResponse)
async def get_buildings(q: BuildingQuery):
    where = f"within_circle(the_geom, {q.lat}, {q.lon}, {q.radius})"
    params = {"$where": where, "$select": "bin, heightroof, groundelev, the_geom", "$limit": 1000}
    if NYC_APP_TOKEN:
        params["$$app_token"] = NYC_APP_TOKEN
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(NYC_OPEN_DATA, params=params)
        resp.raise_for_status()
    buildings = []
    for row in resp.json():
        geom = row.get("the_geom")
        if not geom or geom.get("type") != "MultiPolygon":
            continue
        for poly_coords in geom["coordinates"]:
            utm_coords = []
            for ring in poly_coords:
                utm_coords.append([list(_latlon_to_utm18n(lat, lon)) for lon, lat in ring])
            buildings.append(BuildingOut(
                bin=str(row.get("bin", "")),
                heightroof=float(row.get("heightroof", 0) or 0),
                groundelev=float(row.get("groundelev", 0) or 0),
                geometry=BuildingGeometry(coordinates=utm_coords),
            ))
    return BuildingsResponse(buildings=buildings, count=len(buildings))

@app.get("/buildings/dummy", response_model=BuildingsResponse)
async def get_buildings_dummy():
    blds = _dummy_buildings()
    return BuildingsResponse(buildings=blds, count=len(blds))

# ── Mesh extrusion ────────────────────────────────────────────

def _normalize(v):
    mag = math.sqrt(sum(c*c for c in v))
    return [c/mag for c in v] if mag > 1e-12 else [0,0,0]

def _cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]

def _signed_area_2d(ring):
    """Signed area; positive = CCW."""
    s = 0.0
    n = len(ring)
    for i in range(n):
        j = (i + 1) % n
        s += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1]
    return s / 2.0

def extrude_building(bin_id, coords_utm, heightroof, groundelev, origin):
    outer_ring = coords_utm[0]
    # Remove closing dup if present
    if len(outer_ring) > 1 and outer_ring[0] == outer_ring[-1]:
        outer_ring = outer_ring[:-1]
    # Ensure CCW
    if _signed_area_2d(outer_ring) < 0:
        outer_ring = list(reversed(outer_ring))

    n = len(outer_ring)
    z_floor, z_roof = groundelev, groundelev + heightroof

    def rel(x, y, z):
        return [x - origin[0], y - origin[1], z]

    faces = []
    # roof
    rv = [rel(p[0], p[1], z_roof) for p in outer_ring]
    faces.append(Face(vertices=rv, indices=[[0,i,i+1] for i in range(1,n-1)], normal=[0,0,1], face_type="roof"))
    # floor
    fv = [rel(p[0], p[1], z_floor) for p in outer_ring]
    faces.append(Face(vertices=fv, indices=[[0,i+1,i] for i in range(1,n-1)], normal=[0,0,-1], face_type="floor"))
    # walls
    for i in range(n):
        j = (i+1) % n
        p0, p1 = outer_ring[i], outer_ring[j]
        v0,v1,v2,v3 = rel(p0[0],p0[1],z_floor), rel(p1[0],p1[1],z_floor), rel(p1[0],p1[1],z_roof), rel(p0[0],p0[1],z_roof)
        normal = _normalize(_cross([p1[0]-p0[0], p1[1]-p0[1], 0], [0,0,1]))
        faces.append(Face(vertices=[v0,v1,v2,v3], indices=[[0,1,2],[0,2,3]], normal=normal, face_type="wall"))

    total_verts = sum(len(f.vertices) for f in faces)
    return BuildingMesh(bin=bin_id, faces=faces, vertex_count=total_verts, face_count=len(faces))

def _build_scene(buildings, origin):
    meshes = [extrude_building(b.bin, b.geometry.coordinates, b.heightroof, b.groundelev, origin) for b in buildings]
    return SceneResponse(buildings=meshes, origin_utm=origin, count=len(meshes))

@app.post("/scene", response_model=SceneResponse)
async def scene(q: BuildingQuery):
    blds_resp = await get_buildings(q)
    ox, oy = _latlon_to_utm18n(q.lat, q.lon)
    return _build_scene(blds_resp.buildings, [ox, oy])

@app.get("/scene/dummy", response_model=SceneResponse)
async def scene_dummy():
    return _build_scene(_dummy_buildings(), DUMMY_ORIGIN_UTM)
