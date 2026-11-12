"""Study-area outlines and the 0.25-degree cells that represent them.

- Sokoto-Rima: the HydroBASINS level-4 unit that contains Sokoto (HYBAS_ID 1040760290), the same unit
  the Part B notebook uses (WWF/HydroSHEDS/v1/Basins/hybas_4 in Earth Engine). It runs from the Rima
  and Sokoto valleys in Nigeria north into Niger.
- Lower Niger-Benue: the Part A reach box, Lokoja to Ogbaru, 6.50-7.30 E, 5.80-8.00 N. Part A studies a
  river reach, not a basin; Part C uses the same box so that its design rainfall applies to drainage
  structures along that reach.

A 0.25-degree cell belongs to a study area when its centre lies inside the outline (cell centres sit
on .125/.375/.625/.875, the grid shared by NEX-GDDP-CMIP6 and CHIRPS p25).

Output: part_c/data/domains.geojson (outlines simplified to about 1 km) and part_c/data/cells.json.
"""
import io, json, os, sys, zipfile, hashlib, urllib.request
import numpy as np
import shapefile
from shapely.geometry import shape, Point, box, mapping
from pyproj import Geod

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from domains import BOXES, PART_A_BOX  # noqa: E402

URL = "https://data.hydrosheds.org/file/HydroBASINS/standard/hybas_af_lev04_v1c.zip"
SHA256 = "60c84487460d4e5113408a66e5daed79a3089de4ebd9b5f9ef320417a2e8e6cd"
HYBAS_ID = 1040760290


def basin():
    path = os.path.join(ROOT, "cache", "hydrobasins", "lev04.zip")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        urllib.request.urlretrieve(URL, path)
    assert hashlib.sha256(open(path, "rb").read()).hexdigest() == SHA256, "HydroBASINS file changed"
    z = zipfile.ZipFile(path)
    stem = [n for n in z.namelist() if n.endswith(".shp")][0][:-4]
    r = shapefile.Reader(shp=io.BytesIO(z.read(stem + ".shp")), dbf=io.BytesIO(z.read(stem + ".dbf")))
    fields = [f[0] for f in r.fields[1:]]
    for sr in r.iterShapeRecords():
        rec = dict(zip(fields, sr.record))
        if rec["HYBAS_ID"] == HYBAS_ID:
            return shape(sr.shape.__geo_interface__), rec
    raise SystemExit("basin not found")


def cells(geom, bx):
    x0, x1, y0, y1 = bx
    out = []
    for lat in np.arange(np.floor(y0 * 4) / 4 + 0.125, y1, 0.25):
        for lon in np.arange(np.floor(x0 * 4) / 4 + 0.125, x1, 0.25):
            if geom.contains(Point(lon, lat)):
                out.append([round(float(lon), 3), round(float(lat), 3)])
    return out


def main():
    sr, rec = basin()
    nb = box(PART_A_BOX[0], PART_A_BOX[2], PART_A_BOX[1], PART_A_BOX[3])
    areas = {"sokoto_rima": sr, "niger_benue": nb}
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    feats = [
        {"type": "Feature", "properties": {"id": "sokoto_rima", "name": "Sokoto-Rima basin", "hybas_id": HYBAS_ID,
                                           "area_km2": round(rec["SUB_AREA"])},
         "geometry": mapping(sr.simplify(0.01, preserve_topology=True))},
        {"type": "Feature", "properties": {"id": "niger_benue", "name": "Lower Niger-Benue reach (Part A box)",
                                           "area_km2": round(abs(Geod(ellps="WGS84").geometry_area_perimeter(nb)[0]) / 1e6)},
         "geometry": mapping(nb)},
    ]
    with open(os.path.join(ROOT, "data", "domains.geojson"), "w") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f, separators=(",", ":"))
    cl = {k: cells(g, BOXES[k]) for k, g in areas.items()}
    with open(os.path.join(ROOT, "data", "cells.json"), "w") as f:
        json.dump(cl, f)
    for k, v in cl.items():
        print(k, len(v), "cells")
    print("Sokoto-Rima basin area", round(rec["SUB_AREA"]), "km2; bounds", [round(b, 2) for b in sr.bounds])


if __name__ == "__main__":
    main()
