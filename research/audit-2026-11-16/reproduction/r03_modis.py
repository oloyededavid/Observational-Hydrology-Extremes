"""Reproduction step 4a: basin-mean MODIS Terra MOD13Q1 v6.1 NDVI per 16-day composite (July-October starts, DOY 193-289),
2001-2024, tile h18v07, from Microsoft Planetary Computer STAC (collection modis-13Q1-061). Own code.
QA: pixel reliability 0 (good) or 1 (marginal); NDVI fill -3000 dropped; scale 1e-4. Read through the COG overview/decimation
at 1/4 resolution (1 km), basin = rasterised HydroBASINS polygon from part_c/data/domains.geojson (pixels whose centre is inside).
Writes cache/modis_composites.json: {year: {doy: [mean_ndvi, valid_share, item_id]}}."""
import json, os, numpy as np, rasterio
from rasterio import features
from rasterio.enums import Resampling
from shapely.geometry import shape, mapping
from shapely.ops import transform as shp_transform
from pyproj import Transformer
from concurrent.futures import ThreadPoolExecutor
import pystac_client, planetary_computer as pc
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = "/home/user/observational-hydrology-extremes"
DOYS = [193, 209, 225, 241, 257, 273, 289]
cat = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1", modifier=pc.sign_inplace)
basin = shape([f for f in json.load(open(f"{REPO}/part_c/data/domains.geojson"))["features"] if f["properties"]["id"] == "sokoto_rima"][0]["geometry"])
_mask = {}
def read(item):
    with rasterio.open(item.assets["250m_16_days_NDVI"].href) as src:
        shp = (src.height // 4, src.width // 4)
        nd = src.read(1, out_shape=shp, resampling=Resampling.average).astype("float32")
        tr = src.transform * rasterio.Affine.scale(src.width / shp[1], src.height / shp[0])
        if "m" not in _mask:
            t = Transformer.from_crs("EPSG:4326", src.crs, always_xy=True)
            g = shp_transform(t.transform, basin)
            _mask["m"] = features.rasterize([(mapping(g), 1)], out_shape=shp, transform=tr, all_touched=False).astype(bool)
    with rasterio.open(item.assets["250m_16_days_pixel_reliability"].href) as src:
        rel = src.read(1, out_shape=shp, resampling=Resampling.nearest)
    ok = _mask["m"] & (rel >= 0) & (rel <= 1) & (nd > -2000)
    return float(nd[ok].mean() * 1e-4) if ok.any() else None, float(ok.sum() / _mask["m"].sum()), item.id
def year(y):
    items = [i for i in cat.search(collections=["modis-13Q1-061"], bbox=[5, 13, 6, 14], datetime=f"{y}-06-15/{y}-11-15").items()
             if i.id.startswith("MOD13Q1") and "h18v07" in i.id]
    best = {}
    for i in items:
        d = int(i.id.split(".")[1][5:8])
        if d in DOYS and (d not in best or i.id.split(".")[-1] > best[d].id.split(".")[-1]): best[d] = i
    return y, {d: read(i) for d, i in best.items()}
if __name__ == "__main__":
    out = {}
    pool = ThreadPoolExecutor(4)
    for y, r in pool.map(year, range(2001, 2025)):
        out[y] = {str(d): list(v) for d, v in r.items()}; print(y, {d: (None if v[0] is None else round(v[0], 3), round(v[1], 2)) for d, v in r.items()}, flush=True)
    json.dump(out, open(f"{HERE}/cache/modis_composites.json", "w"))
