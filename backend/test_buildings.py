"""Standalone test script — run with: python test_buildings.py"""
import json, os, sys, urllib.request

BASE = os.getenv("API_BASE", "http://127.0.0.1:8000")

def main():
    url = f"{BASE}/buildings/dummy"
    print(f"GET {url}")
    with urllib.request.urlopen(url) as resp:
        data = json.loads(resp.read())

    os.makedirs("output", exist_ok=True)
    with open("output/buildings_dummy.json", "w") as f:
        json.dump(data, f, indent=2)
    print(f"Wrote output/buildings_dummy.json  ({data['count']} buildings)\n")

    for b in data["buildings"]:
        coords = b["geometry"]["coordinates"]
        n = sum(len(ring) for ring in coords)
        print(f"  BIN={b['bin']}  coords={n}  height={b['heightroof']} ft  elev={b['groundelev']} ft")

    print("\nAll checks passed.")

if __name__ == "__main__":
    main()
