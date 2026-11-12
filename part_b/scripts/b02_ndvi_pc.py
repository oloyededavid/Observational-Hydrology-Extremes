"""Part B, recomputed without Earth Engine: growing-season NDVI for the Sokoto-Rima basin and its correlation
with rainfall, raw, detrended and year to year.

NDVI: MODIS Terra MOD13Q1 v6.1 (250 m, 16-day; Didan, 2021) from Microsoft Planetary Computer, tile h18v07,
which contains the whole basin. Pixels with pixel reliability 0 (good) or 1 (marginal) are kept; the tile is
read at 1 km from the files' overviews. Growing season: the composites starting in July-October; years
2001-2024 (2000 is partial). Basin: HydroBASINS unit 1040760290, as in Part B.
Rainfall: annual basin totals from part_b/data/rain_spi.json (CHIRPS v2.0).

Why detrend: both rainfall and NDVI rose over the period (Sahel recovery and re-greening), and a shared trend
alone produces a correlation. A linear trend is removed from each series, and year-to-year differences are
tested as a second check.

Output: part_b/data/ndvi.json
"""
import json, os
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import rasterio
from shapely.geometry import shape
from shapely import contains_xy
from pyproj import Transformer
from scipy import stats
from scipy.signal import detrend
import pystac_client, planetary_computer as pc

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
YEARS = range(2001, 2025)
DEC = 4  # 250 m -> 1 km
cat = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1", modifier=pc.sign_inplace)
basin = shape([f for f in json.load(open(os.path.join(ROOT, "part_c", "data", "domains.geojson")))["features"]
               if f["properties"]["id"] == "sokoto_rima"][0]["geometry"])
_mask = {}


def read(item):
    ndvi_href = item.assets["250m_16_days_NDVI"].href
    rel_href = item.assets["250m_16_days_pixel_reliability"].href
    with rasterio.open(ndvi_href) as src:
        shp = (src.height // DEC, src.width // DEC)
        nd = src.read(1, out_shape=shp, resampling=rasterio.enums.Resampling.average).astype("float32")
        tr = src.transform * rasterio.Affine.scale(src.width / shp[1], src.height / shp[0])
        if "m" not in _mask:
            cols, rows = np.meshgrid(np.arange(shp[1]) + 0.5, np.arange(shp[0]) + 0.5)
            xs, ys = rasterio.transform.xy(tr, rows.ravel() - 0.5, cols.ravel() - 0.5)
            lon, lat = Transformer.from_crs(src.crs, "EPSG:4326", always_xy=True).transform(np.array(xs), np.array(ys))
            _mask["m"] = contains_xy(basin, lon, lat).reshape(shp)
    with rasterio.open(rel_href) as src:
        rel = src.read(1, out_shape=shp, resampling=rasterio.enums.Resampling.nearest)
    ok = _mask["m"] & (rel >= 0) & (rel <= 1) & (nd > -2000)
    return float(np.mean(nd[ok]) * 1e-4), float(ok.sum() / _mask["m"].sum())


def composites(y, m0, m1):
    items = cat.search(collections=["modis-13Q1-061"], bbox=[5, 13, 6, 14], datetime=f"{y}-06-15/{y}-11-15").items()
    return sorted([i for i in items if i.id.startswith("MOD13Q1") and "h18v07" in i.id], key=lambda i: i.id)


def corr(a, b):
    r, p = stats.pearsonr(a, b); rho, ps = stats.spearmanr(a, b)
    return {"pearson_r": round(float(r), 3), "pearson_p": float(p), "spearman_rho": round(float(rho), 3), "spearman_p": float(ps), "n": int(len(a))}


def main():
    pool = ThreadPoolExecutor(6)
    DOYS = [193, 209, 225, 241, 257, 273, 289]  # composites starting in July-October
    per, cover = {}, {}
    for y in YEARS:
        newest = {}
        for i in composites(y, 7, 10):  # some composites exist in several processing versions: keep the newest
            doy = int(i.id.split(".")[1][5:8])
            if doy in DOYS and (doy not in newest or i.id.split(".")[-1] > newest[doy].id.split(".")[-1]):
                newest[doy] = i
        vals = dict(zip(newest, pool.map(read, newest.values())))
        per[y] = {d: v for d, (v, c) in vals.items() if c > 0.5}
        cover[y] = round(float(np.mean([c for _, c in vals.values()])), 3)
        print(y, sorted(per[y]), cover[y], flush=True)
    # a missing composite is filled with that date's mean over all years, shifted by the year's anomaly on its other dates
    clim = {d: float(np.mean([per[y][d] for y in YEARS if d in per[y]])) for d in DOYS}
    gs, filled = {}, {}
    for y in YEARS:
        have = [d for d in DOYS if d in per[y]]
        anom = float(np.mean([per[y][d] - clim[d] for d in have]))
        gs[y] = float(np.mean([per[y][d] if d in per[y] else clim[d] + anom for d in DOYS]))
        filled[y] = [d for d in DOYS if d not in per[y]]
    rain = {r["year"]: r["rain_mm"] for r in json.load(open(os.path.join(ROOT, "part_b", "data", "rain_spi.json")))["years"]}
    yrs = np.array(list(YEARS)); x = np.array([rain[y] for y in yrs]); v = np.array([gs[y] for y in yrs])
    res = {
        "source": "MODIS MOD13Q1 v6.1 via Planetary Computer, tile h18v07, pixel reliability 0-1, 1 km, July-October composites",
        "years": [int(yrs[0]), int(yrs[-1])],
        "ndvi_growing_season": {str(y): round(gs[y], 4) for y in yrs}, "valid_share": {str(y): cover[y] for y in yrs},
        "filled_composites": {str(y): filled[y] for y in yrs if filled[y]},
        "raw": corr(x, v), "detrended": corr(detrend(x), detrend(v)), "differenced": corr(np.diff(x), np.diff(v)),
        "trend_rain_mm_per_decade": round(float(10 * stats.linregress(yrs, x).slope), 1),
        "trend_ndvi_per_decade": round(float(10 * stats.linregress(yrs, v).slope), 4),
        "trend_ndvi_p": float(stats.linregress(yrs, v).pvalue),
    }
    json.dump(res, open(os.path.join(ROOT, "part_b", "data", "ndvi.json"), "w"), indent=1)
    print(json.dumps({k: res[k] for k in ("raw", "detrended", "differenced", "trend_ndvi_per_decade", "trend_ndvi_p")}, indent=1))


if __name__ == "__main__":
    main()
