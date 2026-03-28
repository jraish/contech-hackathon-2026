import os, math
import httpx
import pvlib
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

app = FastAPI(title="UMBRA — NYC Building Solar API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SODA_BASE      = os.getenv("SODA_BASE", "https://data.cityofnewyork.us/resource/5zhs-2jue.json")
SODA_APP_TOKEN = os.getenv("SODA_APP_TOKEN", "")


# =============================================================================
# UTM Zone 18N projection (pure Python, no native deps)
# =============================================================================

def _wgs84_to_utm18n(lon: float, lat: float) -> tuple[float, float]:
    a = 6378137.0
    f = 1 / 298.257223563
    e2 = 2 * f - f * f
    e_prime2 = e2 / (1 - e2)
    k0 = 0.9996
    lon0 = -75.0

    lat_r  = math.radians(lat)
    lon_r  = math.radians(lon)
    lon0_r = math.radians(lon0)

    sin_lat = math.sin(lat_r)
    cos_lat = math.cos(lat_r)
    tan_lat = math.tan(lat_r)

    N = a / math.sqrt(1 - e2 * sin_lat ** 2)
    T = tan_lat ** 2
    C = e_prime2 * cos_lat ** 2
    A = (lon_r - lon0_r) * cos_lat

    M = a * (
        (1 - e2/4 - 3*e2**2/64 - 5*e2**3/256)   * lat_r
      - (3*e2/8 + 3*e2**2/32 + 45*e2**3/1024)   * math.sin(2*lat_r)
      + (15*e2**2/256 + 45*e2**3/1024)           * math.sin(4*lat_r)
      - (35*e2**3/3072)                          * math.sin(6*lat_r)
    )

    x = k0 * N * (
        A + (1-T+C)*A**3/6
          + (5-18*T+T**2+72*C-58*e_prime2)*A**5/120
    ) + 500000.0

    y = k0 * (
        M + N * tan_lat * (
            A**2/2
          + (5-T+9*C+4*C**2)*A**4/24
          + (61-58*T+T**2+600*C-330*e_prime2)*A**6/720
        )
    )
    if lat < 0:
        y += 10000000.0

    return round(x, 3), round(y, 3)


def reproject_ring(ring):
    return [list(_wgs84_to_utm18n(lon, lat)) for lon, lat in ring]


# =============================================================================
# Target building detection
# Find the building whose footprint centroid is closest to the query point.
# =============================================================================

def _find_target_bin(data: list, origin_x: float, origin_y: float) -> str:
    """Return the BIN of the building whose footprint is closest to the query origin."""
    best_bin  = None
    best_dist = float("inf")

    for row in data:
        if "the_geom" not in row:
            continue
        try:
            geom   = row["the_geom"]
            gtype  = geom.get("type", "Polygon")
            coords = geom.get("coordinates", [])

            if gtype == "MultiPolygon":
                ring = coords[0][0]
            else:
                ring = coords[0]

            utm_ring = reproject_ring(ring)
            cx = sum(p[0] for p in utm_ring) / len(utm_ring)
            cy = sum(p[1] for p in utm_ring) / len(utm_ring)

            dist = math.sqrt((cx - origin_x) ** 2 + (cy - origin_y) ** 2)
            if dist < best_dist:
                best_dist = dist
                best_bin  = row.get("bin", "")
        except Exception:
            continue

    return best_bin


# =============================================================================
# Mesh generation
# =============================================================================

def extrude_footprint(ring_2d, base_z, roof_z, origin_x, origin_y, is_target=False):
    """
    Extrude a 2-D UTM ring into 3-D face dicts for the frontend.
    All coords are translated so query origin = (0,0,0). Z = up.

    is_target: if True, marks all faces so the frontend can highlight them.
    """
    pts = ring_2d[:-1] if (len(ring_2d) > 1 and ring_2d[0] == ring_2d[-1]) else ring_2d
    n   = len(pts)
    if n < 3:
        return []

    local = [[p[0] - origin_x, p[1] - origin_y] for p in pts]
    faces = []

    # ── Roof ──────────────────────────────────────────────────────────────────
    roof_verts   = [[p[0], p[1], roof_z] for p in local]
    roof_indices = []
    for i in range(1, n - 1):
        roof_indices += [0, i, i + 1]
    faces.append({
        "face_type":    "roof",
        "vertices":     roof_verts,
        "indices":      roof_indices,
        "normal":       [0, 0, 1],
        "sun_hours":    0,
        "sun_fraction": 0,
        "is_target":    is_target,
    })

    # ── Floor ─────────────────────────────────────────────────────────────────
    floor_verts   = [[p[0], p[1], base_z] for p in local]
    floor_indices = []
    for i in range(1, n - 1):
        floor_indices += [0, i + 1, i]
    faces.append({
        "face_type":    "floor",
        "vertices":     floor_verts,
        "indices":      floor_indices,
        "normal":       [0, 0, -1],
        "sun_hours":    0,
        "sun_fraction": 0,
        "is_target":    is_target,
    })

    # ── Walls ─────────────────────────────────────────────────────────────────
    for i in range(n):
        j  = (i + 1) % n
        p0 = local[i]
        p1 = local[j]

        verts = [
            [p0[0], p0[1], base_z],
            [p1[0], p1[1], base_z],
            [p1[0], p1[1], roof_z],
            [p0[0], p0[1], roof_z],
        ]

        dx     = p1[0] - p0[0]
        dy     = p1[1] - p0[1]
        length = math.sqrt(dx*dx + dy*dy) or 1.0
        normal = [round(dy / length, 4), round(-dx / length, 4), 0]

        faces.append({
            "face_type":    "wall",
            "vertices":     verts,
            "indices":      [0, 1, 2, 0, 2, 3],
            "normal":       normal,
            "sun_hours":    0,
            "sun_fraction": 0,
            "is_target":    is_target,
        })

    return faces


# =============================================================================
# Request models
# =============================================================================

class SceneRequest(BaseModel):
    lat:    float
    lon:    float
    radius: float = Field(default=500)
    date:   Optional[str] = "2024-06-21"

class SolarRequest(BaseModel):
    lat:      float
    lon:      float
    date:     str = "2024-06-21"
    timezone: str = "America/New_York"

class AnalyzeRequest(BaseModel):
    lat:    float
    lon:    float
    radius: float = Field(default=500)
    date:   str   = "2024-06-21"

class BuildingRequest(BaseModel):
    lat:    float
    lon:    float
    radius: float = Field(default=500)


# =============================================================================
# Shared helpers
# =============================================================================

async def _fetch_buildings_raw(lat, lon, radius):
    where  = f"within_circle(the_geom, {lat}, {lon}, {radius})"
    params = {
        "$where":  where,
        "$select": "bin, height_roof, ground_elevation, the_geom",
        "$limit":  5000,
    }
    if SODA_APP_TOKEN:
        params["$$app_token"] = SODA_APP_TOKEN

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(SODA_BASE, params=params)
        if resp.status_code != 200:
            print(f"NYC Open Data error {resp.status_code}: {resp.text[:500]}", flush=True)
            raise HTTPException(502, f"NYC Open Data error {resp.status_code}: {resp.text[:300]}")
    return resp.json()


def _min_elevation(data: list) -> float:
    """Find the minimum ground elevation across all buildings for Z normalisation."""
    min_elev = float("inf")
    for row in data:
        try:
            min_elev = min(min_elev, float(row.get("ground_elevation", 0)))
        except Exception:
            continue
    return 0.0 if min_elev == float("inf") else min_elev


def _sun_vectors(lat, lon, date, timezone):
    times = pd.date_range(date, periods=24, freq="h", tz=timezone)
    sp    = pvlib.solarposition.get_solarposition(times, lat, lon)
    above = sp[sp["apparent_elevation"] > 0]

    results = []
    for ts, row in above.iterrows():
        az  = math.radians(row["azimuth"])
        el  = math.radians(row["apparent_elevation"])
        vec = [
            round(math.sin(az) * math.cos(el), 4),
            round(math.cos(az) * math.cos(el), 4),
            round(math.sin(el), 4),
        ]
        results.append({
            "hour":      ts.hour,
            "azimuth":   round(float(row["azimuth"]), 2),
            "elevation": round(float(row["apparent_elevation"]), 2),
            "vector":    vec,
        })
    return results


# =============================================================================
# Endpoints
# =============================================================================

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/buildings/dummy")
def buildings_dummy():
    return {"buildings": DUMMY_BUILDINGS, "count": len(DUMMY_BUILDINGS)}


@app.post("/buildings")
async def buildings(req: BuildingRequest):
    data = await _fetch_buildings_raw(req.lat, req.lon, req.radius)
    results = []
    for row in data:
        if "the_geom" not in row:
            continue
        try:
            geom   = row["the_geom"]
            gtype  = geom.get("type", "Polygon")
            coords = geom.get("coordinates", [])
            ring   = coords[0][0] if gtype == "MultiPolygon" else coords[0]
            results.append({
                "bin":             row.get("bin", ""),
                "height_roof":     float(row.get("height_roof", 0)),
                "ground_elevation": float(row.get("ground_elevation", 0)),
                "geometry":        {"type": gtype, "coordinates": reproject_ring(ring), "crs": "EPSG:32618"},
            })
        except Exception:
            continue
    return {"buildings": results, "count": len(results)}


@app.post("/scene")
async def scene(req: SceneRequest):
    origin_x, origin_y = _wgs84_to_utm18n(req.lon, req.lat)
    data     = await _fetch_buildings_raw(req.lat, req.lon, req.radius)
    min_elev = _min_elevation(data)
    target_bin = _find_target_bin(data, origin_x, origin_y)

    buildings_out = []
    for row in data:
        if "the_geom" not in row:
            continue
        try:
            geom   = row["the_geom"]
            gtype  = geom.get("type", "Polygon")
            coords = geom.get("coordinates", [])
            ground = float(row.get("ground_elevation", 0))
            base   = ground - min_elev
            height = float(row.get("height_roof", 10)) - ground  # actual building height in feet
            if height <= 0:
                height = 10
            roof = base + height

            ring_lonlat = coords[0][0] if gtype == "MultiPolygon" else coords[0]
            ring_utm    = reproject_ring(ring_lonlat)
            bin_        = row.get("bin", "")
            is_target   = (bin_ == target_bin)

            faces = extrude_footprint(ring_utm, base, roof, origin_x, origin_y, is_target=is_target)
            buildings_out.append({"bin": bin_, "meshes": faces, "is_target": is_target})
        except Exception:
            continue

    return {
        "center":     {"lat": req.lat, "lon": req.lon},
        "target_bin": target_bin,
        "buildings":  buildings_out,
    }


@app.post("/solar")
def solar(req: SolarRequest):
    try:
        return _sun_vectors(req.lat, req.lon, req.date, req.timezone)
    except Exception as e:
        raise HTTPException(400, f"Solar calculation failed: {e}")


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    origin_x, origin_y = _wgs84_to_utm18n(req.lon, req.lat)
    data       = await _fetch_buildings_raw(req.lat, req.lon, req.radius)
    min_elev   = _min_elevation(data)
    sun_vecs   = _sun_vectors(req.lat, req.lon, req.date, "America/New_York")
    max_hours  = len(sun_vecs)
    target_bin = _find_target_bin(data, origin_x, origin_y)

    # Midday sun direction for stub estimation (south in NYC)
    midday_vec = np.array([0.0, -1.0, 0.0])

    buildings_out = []
    for row in data:
        if "the_geom" not in row:
            continue
        try:
            geom   = row["the_geom"]
            gtype  = geom.get("type", "Polygon")
            coords = geom.get("coordinates", [])
            ground = float(row.get("ground_elevation", 0))
            base   = ground - min_elev
            height = float(row.get("height_roof", 10)) - ground  # actual building height in feet
            if height <= 0:
                height = 10
            roof = base + height
            ring_lonlat = coords[0][0] if gtype == "MultiPolygon" else coords[0]
            ring_utm    = reproject_ring(ring_lonlat)
            bin_        = row.get("bin", "")
            is_target   = (bin_ == target_bin)

            faces = extrude_footprint(ring_utm, base, roof, origin_x, origin_y, is_target=is_target)

            for face in faces:
                if face["face_type"] == "wall":
                    n   = np.array(face["normal"])
                    dot = float(np.dot(n, midday_vec))
                    face["sun_fraction"] = round(max(0.0, dot), 3)
                    face["sun_hours"]    = round(face["sun_fraction"] * max_hours, 1)
                elif face["face_type"] == "roof":
                    face["sun_fraction"] = 1.0
                    face["sun_hours"]    = float(max_hours)

            buildings_out.append({"bin": bin_, "meshes": faces, "is_target": is_target})
        except Exception:
            continue

    return {
        "center":     {"lat": req.lat, "lon": req.lon},
        "target_bin": target_bin,
        "buildings":  buildings_out,
    }


# =============================================================================
# Dummy data
# =============================================================================

DUMMY_BUILDINGS = [
    {
        "bin": "1234567", "height_roof": 45.0, "ground_elevation": 2.5,
        "geometry": {"type": "Polygon", "coordinates": [[
            [583960.0, 4507523.0], [583980.0, 4507523.0],
            [583980.0, 4507543.0], [583960.0, 4507543.0], [583960.0, 4507523.0],
        ]], "crs": "EPSG:32618"},
    },
    {
        "bin": "2345678", "height_roof": 78.5, "ground_elevation": 5.0,
        "geometry": {"type": "Polygon", "coordinates": [[
            [583900.0, 4507600.0], [583930.0, 4507600.0],
            [583930.0, 4507635.0], [583900.0, 4507635.0], [583900.0, 4507600.0],
        ]], "crs": "EPSG:32618"},
    },
    {
        "bin": "3456789", "height_roof": 95.2, "ground_elevation": 8.3,
        "geometry": {"type": "Polygon", "coordinates": [[
            [584010.0, 4507480.0], [584050.0, 4507480.0],
            [584050.0, 4507520.0], [584010.0, 4507520.0], [584010.0, 4507480.0],
        ]], "crs": "EPSG:32618"},
    },
]