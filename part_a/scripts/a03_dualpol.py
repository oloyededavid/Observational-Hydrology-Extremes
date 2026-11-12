"""Part A, dual-polarisation water: a pixel is water only if both VH and VV backscatter are below their thresholds.

Why: the Sentinel-2 check (a02_robustness.py) showed that VH alone flags large areas of dry, bare ground as
water in the dry season (February 2022: 15% of VH water confirmed by Sentinel-2; none outside the floodplain),
while VV separates those surfaces from water much better. Requiring both polarisations removes most false
positives without needing the JRC floodplain mask, so the result no longer depends on the dataset it is
compared with.

Thresholds: the median over 2018-2023 of each month's Otsu threshold on pixels within about 1 km of JRC water
(VH and VV separately), applied to every scene. Frequency is per scene (August-November); monthly area is
from the monthly median composites. The VH-only results of a01_flood_pc.py are kept for comparison.

Output: part_a/data/dualpol.json, part_a/data/dual_frequency.png, part_a/data/dual_water_2022-02.png,
part_a/data/dual_water_2022-10.png.
"""
import json, os, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import a01_flood_pc as a  # noqa: E402
from a02_robustness import otsu, px_area, s2_water  # noqa: E402

CACHE, OUT = a.CACHE, a.OUT


def scene_pair(item):
    out = []
    for pol in ("vh", "vv"):
        lin = a.to_grid(item.assets[pol].href, a.Resampling.average, decimate=8)
        lin[lin <= 0] = np.nan
        out.append(10 * np.log10(lin))
    return out


def month(y, m, pool):
    path = os.path.join(CACHE, f"dual_{y}_{m:02d}.npz")
    if os.path.exists(path):
        d = np.load(path); return d["vh"], d["vv"], [tuple(x) for x in d["scenes_idx"]] if "scenes_idx" in d else None
    scenes = list(pool.map(scene_pair, a.month_items(y, m)))
    vh = np.nanmedian(np.stack([s[0] for s in scenes]), axis=0).astype("float32")
    vv = np.nanmedian(np.stack([s[1] for s in scenes]), axis=0).astype("float32")
    extra = {}
    if 8 <= m <= 11:  # keep the scenes of the wet season for the frequency
        extra = {"svh": np.stack([s[0] for s in scenes]).astype("float16"), "svv": np.stack([s[1] for s in scenes]).astype("float16")}
    np.savez_compressed(path, vh=vh, vv=vv, **extra)
    return vh, vv, None


def main():
    A = px_area()
    occ, ext, slope = (np.load(os.path.join(CACHE, f)) for f in ("jrc_occurrence.npy", "jrc_extent.npy", "slope.npy"))
    perm, gentle = occ >= a.PERM, slope < a.SLOPE_MAX
    plain = (ext >= 0.5) & ~perm
    near = ndimage.binary_dilation(occ >= 50, iterations=9)
    pool = ThreadPoolExecutor(8)
    comps, t_vh, t_vv = {}, [], []
    for y in range(2018, 2024):
        for m in range(1, 13):
            vh, vv, _ = month(y, m, pool)
            comps[(y, m)] = (vh, vv)
            t_vh.append(otsu(vh[near & gentle])); t_vv.append(otsu(vv[near & gentle]))
        print("months", y, flush=True)
    TVH, TVV = float(np.median(t_vh)), float(np.median(t_vv))
    rows = []
    for (y, m), (vh, vv) in comps.items():
        w = (vh < TVH) & (vv < TVV) & gentle
        rows.append({"year": y, "month": m, "dual_km2": round(float(A[w & ~perm].sum()), 1),
                     "dual_inside_km2": round(float(A[w & plain].sum()), 1), "dual_outside_km2": round(float(A[w & ~plain & ~perm].sum()), 1),
                     "vh_only_km2": round(float(A[(vh < TVH) & gentle & ~perm].sum()), 1)})
    # per-scene frequency, August-November
    fs, fn = np.zeros((a.H, a.W)), np.zeros((a.H, a.W))
    for y in range(2018, 2024):
        for m in range(8, 12):
            d = np.load(os.path.join(CACHE, f"dual_{y}_{m:02d}.npz"))
            for svh, svv in zip(d["svh"].astype("float32"), d["svv"].astype("float32")):
                ok = np.isfinite(svh) & np.isfinite(svv)
                fs[ok] += ((svh < TVH) & (svv < TVV) & gentle)[ok]; fn[ok] += 1
    freq = np.where(fn > 0, 100 * fs / np.maximum(fn, 1), np.nan)
    # Sentinel-2 check of the dual rule
    check = {}
    for name, (key, s, e, cc) in {"dry_2022_02": ([(2022, 2)], "2022-02-01", "2022-02-28", 10),
                                  "wet_2022_10_11": ([(2022, 10), (2022, 11)], "2022-10-15", "2022-11-30", 40)}.items():
        s2w, clear = s2_water(s, e, cc)
        vh = np.nanmedian(np.stack([comps[k][0] for k in key]), axis=0); vv = np.nanmedian(np.stack([comps[k][1] for k in key]), axis=0)
        s1w = (vh < TVH) & (vv < TVV) & gentle & clear
        sw = s2w & gentle & clear
        both = A[s1w & sw].sum(); o = s1w & ~plain & ~perm
        check[name] = {"s1_km2": round(float(A[s1w].sum()), 1), "s2_km2": round(float(A[sw].sum()), 1),
                       "s1_confirmed_by_s2": round(float(both / max(A[s1w].sum(), 1e-9)), 3),
                       "s2_found_by_s1": round(float(both / max(A[sw].sum(), 1e-9)), 3),
                       "outside_floodplain_s1_km2": round(float(A[o].sum()), 1),
                       "outside_floodplain_confirmed_share": round(float(A[o & sw].sum() / max(A[o].sum(), 1e-9)), 3)}
        print(name, check[name], flush=True)
    res = {"thresholds_db": {"vh": round(TVH, 2), "vv": round(TVV, 2), "vh_monthly_range": [round(min(t_vh), 2), round(max(t_vh), 2)],
                             "vv_monthly_range": [round(min(t_vv), 2), round(max(t_vv), 2)]},
           "monthly": rows, "sentinel2_check": check,
           "frequency": {"area_ever_km2": round(float(A[(freq > 0) & ~perm].sum()), 1), "area_half_time_km2": round(float(A[(freq >= 50) & ~perm].sum()), 1),
                         "scenes_median": float(np.median(fn))}}
    json.dump(res, open(os.path.join(OUT, "dualpol.json"), "w"), indent=1)
    from PIL import Image
    ramp = [(1, 10, (222, 235, 247)), (10, 25, (158, 202, 225)), (25, 50, (66, 146, 198)), (50, 75, (8, 81, 156)), (75, 101, (8, 48, 107))]
    img = np.zeros((a.H, a.W, 4), dtype="uint8")
    for lo, hi, col in ramp:
        img[(freq >= lo) & (freq < hi)] = (*col, 230)
    Image.fromarray(img).save(os.path.join(OUT, "dual_frequency.png"), optimize=True)
    for (y, m) in ((2022, 2), (2022, 10)):
        vh, vv = comps[(y, m)]; w = (vh < TVH) & (vv < TVV) & gentle
        im = np.zeros((a.H, a.W, 4), dtype="uint8"); im[w & ~perm] = (31, 86, 176, 235); im[w & perm] = (17, 17, 17, 200)
        Image.fromarray(im).save(os.path.join(OUT, f"dual_water_{y}-{m:02d}.png"), optimize=True)
    print(json.dumps(res["thresholds_db"]))


if __name__ == "__main__":
    main()
