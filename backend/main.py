import os, math
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="NYC Building Footprints API")

SODA_BASE = os.getenv("SODA_BASE", "https://data.cityofnewyork.us/resource/5zhs-2jue.json")
SODA_APP_TOKEN = os.getenv("SODA_APP_TOKEN", "")


# --- UTM Zone 18N projection (pure Python, no native deps) ---

def _wgs84_to_utm18n(lon: float, lat: float) -> tuple[float, float]:
    """Convert WGS84 (lon, lat) to UTM Zone 18N (EPSG:32618) easting/northing."""
    a = 6378137.0
    f = 1 / 298.257223563
    e2 = 2 * f - f * f
    e_prime2 = e2 / (1 - e2)
    k0 = 0.9996
    lon0 = -75.0  # central meridian for UTM zone 18

    lat_r = math.radians(lat)
    lon_r = math.radians(lon)
    lon0_r = math.radians(lon0)

    sin_lat = math.sin(lat_r)
    cos_lat = math.cos(lat_r)
    tan_lat = math.tan(lat_r)

    N = a / math.sqrt(1 - e2 * sin_lat ** 2)
    T = tan_lat ** 2
    C = e_prime2 * cos_lat ** 2
    A = (lon_r - lon0_r) * cos_lat

    M = a * (
        (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * lat_r
        - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * math.sin(2 * lat_r)
        + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * math.sin(4 * lat_r)
        - (35 * e2 ** 3 / 3072) * math.sin(6 * lat_r)
    )

    x = k0 * N * (
        A + (1 - T + C) * A ** 3 / 6
        + (5 - 18 * T + T ** 2 + 72 * C - 58 * e_prime2) * A ** 5 / 120
    ) + 500000.0

    y = k0 * (
        M + N * tan_lat * (
            A ** 2 / 2
            + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24
            + (61 - 58 * T + T ** 2 + 600 * C - 330 * e_prime2) * A ** 6 / 720
        )
    )
    if lat < 0:
        y += 10000000.0

    return round(x, 3), round(y, 3)


def reproject_polygon(coords_rings):
    result = []
    for ring in coords_rings:
        result.append([list(_wgs84_to_utm18n(lon, lat)) for lon, lat in ring])
    return result


class BuildingRequest(BaseModel):
    lat: float
    lon: float
    radius: float = Field(default=500, description="Search radius in meters")


def format_building(raw: dict) -> dict:
    geom = raw.get("the_geom", {})
    coords = geom.get("coordinates", [])
    geom_type = geom.get("type", "Polygon")

    if geom_type == "MultiPolygon":
        projected_coords = [reproject_polygon(poly) for poly in coords]
    else:
        projected_coords = reproject_polygon(coords)

    return {
        "bin": raw.get("bin", ""),
        "heightroof": float(raw.get("heightroof", 0)),
        "groundelev": float(raw.get("groundelev", 0)),
        "geometry": {
            "type": geom_type,
            "coordinates": projected_coords,
            "crs": "EPSG:32618",
        },
    }


DUMMY_BUILDINGS = [
    {
        "bin": "1234567",
        "heightroof": 45.0,
        "groundelev": 2.5,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [583960.0, 4507523.0],
                [583980.0, 4507523.0],
                [583980.0, 4507543.0],
                [583960.0, 4507543.0],
                [583960.0, 4507523.0],
            ]],
            "crs": "EPSG:32618",
        },
    },
    {
        "bin": "2345678",
        "heightroof": 78.5,
        "groundelev": 5.0,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [583900.0, 4507600.0],
                [583930.0, 4507600.0],
                [583930.0, 4507635.0],
                [583900.0, 4507635.0],
                [583900.0, 4507600.0],
            ]],
            "crs": "EPSG:32618",
        },
    },
    {
        "bin": "3456789",
        "heightroof": 95.2,
        "groundelev": 8.3,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [584010.0, 4507480.0],
                [584050.0, 4507480.0],
                [584050.0, 4507520.0],
                [584010.0, 4507520.0],
                [584010.0, 4507480.0],
            ]],
            "crs": "EPSG:32618",
        },
    },
]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/buildings/dummy")
def buildings_dummy():
    return {"buildings": DUMMY_BUILDINGS, "count": len(DUMMY_BUILDINGS), "crs": "EPSG:32618"}


@app.post("/buildings")
async def buildings(req: BuildingRequest):
    where = f"within_circle(the_geom, {req.lat}, {req.lon}, {req.radius})"
    params = {
        "$where": where,
        "$select": "bin, heightroof, groundelev, the_geom",
        "$limit": 5000,
    }
    if SODA_APP_TOKEN:
        params["$$app_token"] = SODA_APP_TOKEN

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(SODA_BASE, params=params)
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail=f"NYC Open Data returned {resp.status_code}: {resp.text[:500]}")
        data = resp.json()

    results = []
    for row in data:
        if "the_geom" in row:
            try:
                results.append(format_building(row))
            except Exception:
                continue

    return {"buildings": results, "count": len(results), "crs": "EPSG:32618"}
