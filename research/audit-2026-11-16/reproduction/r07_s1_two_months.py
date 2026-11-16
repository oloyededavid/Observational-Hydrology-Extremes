"""Reproduction step 8: Part A flood area for March 2022 (dry season) and October 2022 (flood peak). Own code.

Sentinel-1 RTC (gamma0, VH) scenes of each month over the Part A box (6.50-7.30 E, 5.80-8.00 N) from Microsoft
Planetary Computer, read at the 1/8 overview (about 80 m) and averaged onto a 0.001-degree grid in linear power;
monthly median in dB. Slope from Copernicus DEM GLO-90 (< 5 degrees kept). JRC Global Surface Water v1.3
occurrence and extent from Planetary Computer. Definitions follow the published method (part_a/scripts/a01, a02):
permanent water = occurrence >= 90 %; floodplain = extent >= 0.5 and not permanent; water = median VH below the
threshold on gentle slopes. Otsu threshold computed on gentle cells within about 1 km of JRC water (occurrence >= 50 %).

The floodplain mask and the Otsu sample both come from JRC, and JRC is also the agreement reference, so agreement
with JRC is not independent validation (D02, A-2).

Output: out/s1_compare.json
"""
import json
import os
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import planetary_computer as pc
import pystac_client
import rasterio
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.vrt import WarpedVRT
from scipy import ndimage

from common import HERE, REPO

X0, X1, Y0, Y1 = 6.50, 7.30, 5.80, 8.00
RES = 0.001
W, H = round((X1 - X0) / RES), round((Y1 - Y0) / RES)
GRID = dict(crs="EPSG:4326", transform=from_origin(X0, Y1, RES, RES), width=W, height=H)
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
cat = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1", modifier=pc.sign_inplace)


def warp(href, ovr=None, resampling=Resampling.average):
    kw = {"overview_level": ovr} if ovr is not None else {}
    with rasterio.open(href, **kw) as src, WarpedVRT(src, **GRID, resampling=resampling, src_nodata=src.nodata,
                                                      nodata=np.nan, dtype="float32") as v:
        return v.read(1)


def mosaic(items, asset, ovr=None):
    out = np.full((H, W), np.nan, "float32")
    for it in items:
        a = warp(it.assets[asset].href, ovr)
        out = np.where(np.isnan(out), a, out)
    return out


def otsu(v, lo=-30.0, hi=-5.0, bins=250):
    v = v[np.isfinite(v) & (v > lo) & (v < hi)]
    h, e = np.histogram(v, bins=bins, range=(lo, hi))
    c = (e[:-1] + e[1:]) / 2
    best, t = -1, None
    for i in range(1, bins):
        w0, w1 = h[:i].sum(), h[i:].sum()
        if w0 == 0 or w1 == 0:
            continue
        m0, m1 = (h[:i] * c[:i]).sum() / w0, (h[i:] * c[i:]).sum() / w1
        s = w0 * w1 * (m0 - m1) ** 2
        if s > best:
            best, t = s, (c[i - 1] + c[i]) / 2
    return float(t)


def month(y, m):
    end = f"{y + (m == 12)}-{1 if m == 12 else m + 1:02d}-01"
    items = list(cat.search(collections=["sentinel-1-rtc"], bbox=[X0, Y0, X1, Y1], datetime=f"{y}-{m:02d}-01/{end}").items())

    def one(it):
        lin = warp(it.assets["vh"].href, ovr=2)  # overview level 2 = 1/8 resolution
        lin[lin <= 0] = np.nan
        return 10 * np.log10(lin)

    with ThreadPoolExecutor(6) as p:
        stack = list(p.map(one, items))
    return np.nanmedian(np.stack(stack), axis=0), len(items)


def main():
    dem = mosaic(list(cat.search(collections=["cop-dem-glo-90"], bbox=[X0, Y0, X1, Y1]).items()), "data")
    lat = Y1 - (np.arange(H) + 0.5) * RES
    dy, dx = 110574 * RES, 111320 * RES * np.cos(np.radians(lat))[:, None]
    gy, gx = np.gradient(np.nan_to_num(dem), axis=(0, 1))
    slope = np.degrees(np.arctan(np.hypot(gx / dx, gy / dy)))
    jitems = list(cat.search(collections=["jrc-gsw"], bbox=[X0, Y0, X1, Y1]).items())
    occ, ext = mosaic(jitems, "occurrence"), mosaic(jitems, "extent")
    gentle = slope < 5
    perm = np.nan_to_num(occ) >= 90
    plain = (np.nan_to_num(ext) >= 0.5) & ~perm
    near = ndimage.binary_dilation(np.nan_to_num(occ) >= 50, iterations=9)
    A = (dx * dy / 1e6) * np.ones((1, W))
    pub_rows = {(int(r.split(",")[0]), int(r.split(",")[1])): r.strip().split(",") for r in open(f"{REPO}/part_a/data/flood_monthly.csv").readlines()[1:]}
    rob = {(m["year"], m["month"]): m for m in json.load(open(f"{REPO}/part_a/data/robustness.json"))["monthly"]}
    res = {"floodplain_km2": round(float(A[plain].sum()), 1), "permanent_km2": round(float(A[perm].sum()), 1),
           "published_floodplain_km2": json.load(open(f"{REPO}/part_a/data/results.json"))["floodplain_km2"]}
    for y, m in ((2022, 3), (2022, 10)):
        med, n = month(y, m)
        t_o = otsu(med[near & gentle])
        r = {"images": n, "published_images": int(pub_rows[(y, m)][2])}
        for name, t in (("minus18", -18.0), ("otsu", t_o)):
            w = (med < t) & gentle
            inside, outside = float(A[w & plain].sum()), float(A[w & ~plain & ~perm].sum())
            ref = plain  # agreement with the JRC floodplain itself
            r[name] = {"threshold_db": round(t, 2), "floodplain_water_km2": round(inside, 1), "outside_floodplain_km2": round(outside, 1)}
        r["published"] = {"minus18_floodplain_km2": float(pub_rows[(y, m)][6]), "minus18_outside_km2": float(pub_rows[(y, m)][7]),
                          "otsu_db": rob[(y, m)]["otsu_db"], "otsu_floodplain_km2": rob[(y, m)]["otsu_inside"]}
        res[f"{y}-{m:02d}"] = r
        print(y, m, json.dumps(r), flush=True)
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    json.dump(res, open(os.path.join(HERE, "out", "s1_compare.json"), "w"), indent=1)
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
