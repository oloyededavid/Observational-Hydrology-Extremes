"""Part B vegetation, cell by cell: growing-season NDVI for each 0.25-degree cell of the Sokoto-Rima basin,
2001-2024, its anomalies, and its correlation with that cell's rainfall.

Same MODIS MOD13Q1 composites, quality screen (pixel reliability 0-1), growing season (composites starting
in July-October, newest processing version) and 1 km reading as b02_ndvi_pc.py; here the 1 km pixels are
averaged into the CHIRPS cells instead of the whole basin. A cell-year needs at least half its pixels valid in
at least four of the seven composites; otherwise it is left empty (no gap filling at cell level).

Rainfall: annual and July-October totals per cell from part_b/cache/chirps_monthly.npy (b03_drought.py).

Output: part_b/data/ndvi_cells.json
"""
import json, os, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import rasterio
from pyproj import Transformer
from scipy import stats
from scipy.signal import detrend

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from b02_ndvi_pc import composites, DEC, YEARS  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DOYS = [193, 209, 225, 241, 257, 273, 289]
_map = {}


def cell_means(item, cells):
    nd_h, rel_h = item.assets["250m_16_days_NDVI"].href, item.assets["250m_16_days_pixel_reliability"].href
    with rasterio.open(nd_h) as src:
        shp = (src.height // DEC, src.width // DEC)
        nd = src.read(1, out_shape=shp, resampling=rasterio.enums.Resampling.average).astype("float32")
        if "lab" not in _map:
            tr = src.transform * rasterio.Affine.scale(src.width / shp[1], src.height / shp[0])
            rows, cols = np.mgrid[0:shp[0], 0:shp[1]]
            xs, ys = rasterio.transform.xy(tr, rows.ravel(), cols.ravel())
            lon, lat = Transformer.from_crs(src.crs, "EPSG:4326", always_xy=True).transform(np.array(xs), np.array(ys))
            lab = np.full(lon.shape, -1)
            for k, (cx, cy) in enumerate(cells):
                lab[(np.abs(lon - cx) < 0.125) & (np.abs(lat - cy) < 0.125)] = k
            _map["lab"] = lab.reshape(shp)
    with rasterio.open(rel_h) as src:
        rel = src.read(1, out_shape=shp, resampling=rasterio.enums.Resampling.nearest)
    lab = _map["lab"]; ok = (rel >= 0) & (rel <= 1) & (nd > -2000) & (lab >= 0)
    n_all = np.bincount(lab[lab >= 0], minlength=len(cells))
    n_ok = np.bincount(lab[ok], minlength=len(cells))
    s = np.bincount(lab[ok], weights=nd[ok] * 1e-4, minlength=len(cells))
    mean = np.where(n_ok >= 0.5 * np.maximum(n_all, 1), s / np.maximum(n_ok, 1), np.nan)
    return mean


def main():
    cells = json.load(open(os.path.join(ROOT, "part_c", "data", "cells.json")))["sokoto_rima"]
    pool = ThreadPoolExecutor(6)
    cache = os.path.join(ROOT, "part_b", "cache", "ndvi_cells.npy")
    gs = np.load(cache) if os.path.exists(cache) else np.full((len(YEARS), len(cells)), np.nan)
    for i, y in enumerate(YEARS):
        if os.path.exists(cache):
            break
        newest = {}
        for it in composites(y, 7, 10):
            d = int(it.id.split(".")[1][5:8])
            if d in DOYS and (d not in newest or it.id.split(".")[-1] > newest[d].id.split(".")[-1]):
                newest[d] = it
        vals = np.stack(list(pool.map(lambda it: cell_means(it, cells), newest.values())))
        enough = np.sum(np.isfinite(vals), axis=0) >= 4
        gs[i] = np.where(enough, np.nanmean(vals, axis=0), np.nan)
        print(y, int(enough.sum()), "cells", flush=True)
    os.makedirs(os.path.dirname(cache), exist_ok=True); np.save(cache, gs)
    m = np.load(os.path.join(ROOT, "part_b", "cache", "chirps_monthly.npy")).reshape(-1, 12, len(cells))
    yi = [y - 1981 for y in YEARS]
    rain_ann, rain_gs = m[yi].sum(axis=1), m[yi][:, 6:10].sum(axis=1)
    mean = np.nanmean(gs, axis=0)
    anom = gs - mean
    r_raw, r_det, p_det = [], [], []
    for c in range(len(cells)):
        ok = np.isfinite(gs[:, c])
        if ok.sum() < 15:
            r_raw.append(None); r_det.append(None); p_det.append(None); continue
        x, v = rain_ann[ok, c], gs[ok, c]
        r_raw.append(round(float(stats.pearsonr(x, v)[0]), 3))
        rd, pd = stats.pearsonr(detrend(x), detrend(v)); r_det.append(round(float(rd), 3)); p_det.append(float(pd))
    rr = np.array([np.nan if v is None else v for v in r_det])
    out = {"years": list(YEARS), "cells": cells, "mean_ndvi": [None if not np.isfinite(v) else round(float(v), 4) for v in mean],
           "anomaly": [[None if not np.isfinite(v) else round(float(v), 4) for v in row] for row in anom],
           "r_raw": r_raw, "r_detrended": r_det, "p_detrended": p_det,
           "summary": {"cells_with_r": int(np.isfinite(rr).sum()), "median_r_detrended": round(float(np.nanmedian(rr)), 3),
                       "share_p_below_0_05": round(float(np.mean([p < 0.05 for p in p_det if p is not None])), 3)}}
    # where does vegetation respond? r against mean rainfall
    mr = rain_ann.mean(axis=0)
    ok = np.isfinite(rr)
    out["summary"]["r_vs_mean_rain_spearman"] = round(float(stats.spearmanr(mr[ok], rr[ok])[0]), 3)
    json.dump(out, open(os.path.join(ROOT, "part_b", "data", "ndvi_cells.json"), "w"), separators=(",", ":"))
    print(json.dumps(out["summary"]))


if __name__ == "__main__":
    main()
