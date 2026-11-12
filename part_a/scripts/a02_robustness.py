"""Part A robustness: how much the Sentinel-1 water areas depend on the method, and an independent optical check.

Uses the monthly Sentinel-1 composites written by a01_flood_pc.py (part_a/cache/s1_YYYY_MM.npz) and reads
further data from Microsoft Planetary Computer.

1. Threshold sensitivity. Water area inside the floodplain and outside it for VH thresholds of -15 to -22 dB,
   every month 2018-2023.
2. Data-driven threshold. Otsu's (1979) method on each monthly composite, applied only to pixels within about
   1 km of JRC water (occurrence >= 50%), where the histogram holds both water and land; selecting such a
   sample is the usual way to make Otsu work on scenes that are mostly land (Martinis et al., 2015).
3. VV against VH. VV composites for February and October of each year, thresholded by Otsu in the same way.
4. Independent check with Sentinel-2. For February 2022 (dry season) and the clearest October-November 2022
   scenes, water from Sentinel-2 L2A (MNDWI > 0 on cloud- and shadow-free pixels, scene classification) is
   compared with Sentinel-1 water. Sentinel-2 is optical and shares nothing with Sentinel-1 or with JRC
   (which is built from Landsat), so it can test whether Sentinel-1 "water" on dry ground is water.
5. Observation coverage (wet-season Sentinel-1 images per cell) and three floodplain cross-sections from the
   Copernicus DEM with the observed inundation frequency along them.

Output: part_a/data/robustness.json and part_a/data/coverage.png.
"""
import json, os, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from scipy import ndimage
import pystac_client, planetary_computer as pc

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import a01_flood_pc as a  # noqa: E402  (grid, readers and paths)

CACHE, OUT = a.CACHE, a.OUT
THRESHOLDS = list(range(-15, -23, -1))
cat = a.cat


def px_area():
    lat = a.Y1 - (np.arange(a.H) + 0.5) * a.RES
    return (a.RES * 111.32 * np.cos(np.radians(lat)) * a.RES * 110.574)[:, None] * np.ones((1, a.W))


def otsu(values, lo=-30.0, hi=-5.0, bins=250):
    v = values[np.isfinite(values) & (values > lo) & (values < hi)]
    hist, edges = np.histogram(v, bins=bins, range=(lo, hi))
    mids = (edges[:-1] + edges[1:]) / 2
    w0 = np.cumsum(hist); w1 = w0[-1] - w0
    m0 = np.cumsum(hist * mids) / np.maximum(w0, 1)
    m1 = (np.sum(hist * mids) - np.cumsum(hist * mids)) / np.maximum(w1, 1)
    between = w0 * w1 * (m0 - m1) ** 2
    return float(mids[int(np.argmax(between))])


def dem():
    path = os.path.join(CACHE, "dem.npy")
    if os.path.exists(path):
        return np.load(path)
    out = np.full((a.H, a.W), np.nan, dtype="float32")
    for it in cat.search(collections=["cop-dem-glo-90"], bbox=[a.X0, a.Y0, a.X1, a.Y1]).items():
        part = a.to_grid(it.assets["data"].href, a.Resampling.bilinear, decimate=1)
        out = np.where(np.isnan(out), part, out)
    np.save(path, out)
    return out


def vv_month(y, m):
    path = os.path.join(CACHE, f"vv_{y}_{m:02d}.npy")
    if os.path.exists(path):
        return np.load(path)
    def one(item):
        lin = a.to_grid(item.assets["vv"].href, a.Resampling.average, decimate=8)
        lin[lin <= 0] = np.nan
        return 10 * np.log10(lin)
    with ThreadPoolExecutor(8) as ex:
        stack = np.stack(list(ex.map(one, a.month_items(y, m))))
    med = np.nanmedian(stack, axis=0).astype("float32")
    np.save(path, med)
    return med


def s2_water(start, end, max_cloud):
    """Median MNDWI water mask from Sentinel-2 L2A between two dates; NaN where never clear."""
    key = f"s2_{start}_{end}.npz"
    path = os.path.join(CACHE, key)
    if os.path.exists(path):
        d = np.load(path); return d["water"], d["clear"]
    items = list(cat.search(collections=["sentinel-2-l2a"], bbox=[a.X0, a.Y0, a.X1, a.Y1], datetime=f"{start}/{end}",
                            query={"eo:cloud_cover": {"lt": max_cloud}}).items())
    def one(it):
        g = a.to_grid(it.assets["B03"].href, a.Resampling.average, decimate=10)    # 10 m -> ~100 m
        sw = a.to_grid(it.assets["B11"].href, a.Resampling.average, decimate=5)    # 20 m -> ~100 m
        scl = a.to_grid(it.assets["SCL"].href, a.Resampling.mode, decimate=5)
        bad = np.isin(scl, [0, 1, 3, 8, 9, 10]) | np.isnan(scl)  # no data, saturated, shadow, cloud, cirrus
        mndwi = (g - sw) / (g + sw)
        mndwi[bad] = np.nan
        return mndwi
    with ThreadPoolExecutor(6) as ex:
        stack = np.stack(list(ex.map(one, items)))
    med = np.nanmedian(stack, axis=0)
    clear = np.isfinite(med)
    water = (med > 0) & clear
    np.savez_compressed(path, water=water, clear=clear, n=len(items))
    return water, clear


def main():
    A = px_area()
    occ, ext, slope = np.load(os.path.join(CACHE, "jrc_occurrence.npy")), np.load(os.path.join(CACHE, "jrc_extent.npy")), np.load(os.path.join(CACHE, "slope.npy"))
    perm = occ >= a.PERM
    plain = (ext >= 0.5) & ~perm
    gentle = slope < a.SLOPE_MAX
    near = ndimage.binary_dilation(occ >= 50, iterations=9)  # ~1 km around JRC water: sample for Otsu
    res = {"thresholds_db": THRESHOLDS, "monthly": []}

    # 1-2. threshold sensitivity and Otsu, every month
    for y in range(2018, 2024):
        for m in range(1, 13):
            med = np.load(os.path.join(CACHE, f"s1_{y}_{m:02d}.npz"))["med"]
            row = {"year": y, "month": m, "inside": [], "outside": []}
            for t in THRESHOLDS:
                w = (med < t) & gentle
                row["inside"].append(round(float(A[w & plain].sum()), 1))
                row["outside"].append(round(float(A[w & ~plain & ~perm].sum()), 1))
            t_o = otsu(med[near & gentle])
            w = (med < t_o) & gentle
            row["otsu_db"] = round(t_o, 2)
            row["otsu_inside"] = round(float(A[w & plain].sum()), 1)
            row["otsu_outside"] = round(float(A[w & ~plain & ~perm].sum()), 1)
            res["monthly"].append(row)
        print("thresholds", y, flush=True)
    ot = [r["otsu_db"] for r in res["monthly"]]
    res["otsu_summary"] = {"median_db": float(np.median(ot)), "min_db": float(np.min(ot)), "max_db": float(np.max(ot))}

    # 3. VV against VH, February and October
    vv = []
    for y in range(2018, 2024):
        for m in (2, 10):
            vh = np.load(os.path.join(CACHE, f"s1_{y}_{m:02d}.npz"))["med"]
            v = vv_month(y, m)
            t_vh, t_vv = otsu(vh[near & gentle]), otsu(v[near & gentle])
            wvh, wvv = (vh < t_vh) & gentle, (v < t_vv) & gentle
            vv.append({"year": y, "month": m, "otsu_vh_db": round(t_vh, 2), "otsu_vv_db": round(t_vv, 2),
                       "vh_inside": round(float(A[wvh & plain].sum()), 1), "vv_inside": round(float(A[wvv & plain].sum()), 1),
                       "vh_outside": round(float(A[wvh & ~plain & ~perm].sum()), 1), "vv_outside": round(float(A[wvv & ~plain & ~perm].sum()), 1),
                       "agreement_iou": round(float(A[wvh & wvv].sum() / max(A[wvh | wvv].sum(), 1e-9)), 3)})
            print("vv", y, m, vv[-1], flush=True)
    res["vv_vs_vh"] = vv

    # 4. independent check with Sentinel-2
    checks = {}
    for name, (y, m, s, e, cc) in {"dry_2022_02": (2022, 2, "2022-02-01", "2022-02-28", 10),
                                   "wet_2022_10_11": (2022, 10, "2022-10-15", "2022-11-30", 40)}.items():
        s2w, clear = s2_water(s, e, cc)
        vh = np.load(os.path.join(CACHE, f"s1_{y}_{m:02d}.npz"))["med"]
        if name.startswith("wet"):  # compare with the late-October/November radar water
            vh = np.nanmedian(np.stack([vh, np.load(os.path.join(CACHE, f"s1_{y}_11.npz"))["med"]]), axis=0)
        out = {"s2_clear_share": round(float(clear.mean()), 3)}
        for label, thr in (("minus18", -18.0), ("otsu", otsu(vh[near & gentle]))):
            s1w = (vh < thr) & gentle & clear
            sw = s2w & gentle & clear
            both = A[s1w & sw].sum()
            o = s1w & ~plain & ~perm  # Sentinel-1 water outside the floodplain
            out[label] = {"threshold_db": round(float(thr), 2), "s1_km2": round(float(A[s1w].sum()), 1), "s2_km2": round(float(A[sw].sum()), 1),
                          "both_km2": round(float(both), 1), "s1_confirmed_by_s2": round(float(both / max(A[s1w].sum(), 1e-9)), 3),
                          "s2_found_by_s1": round(float(both / max(A[sw].sum(), 1e-9)), 3),
                          "outside_floodplain_s1_km2": round(float(A[o].sum()), 1),
                          "outside_floodplain_confirmed_share": round(float(A[o & sw].sum() / max(A[o].sum(), 1e-9)), 3)}
        checks[name] = out
        print(name, json.dumps(out), flush=True)
    res["sentinel2_check"] = checks

    # 5. coverage and cross-sections
    d = np.load(os.path.join(CACHE, "frequency.npz")); n, freq = d["n"], d["freq"]
    res["coverage"] = {"min": int(n.min()), "median": float(np.median(n)), "p95": float(np.percentile(n, 95)), "max": int(n.max())}
    from PIL import Image
    cls = [(0, 70, (237, 237, 233)), (70, 120, (199, 199, 192)), (120, 180, (150, 150, 141)), (180, 1000, (92, 92, 85))]
    img = np.zeros((a.H, a.W, 4), dtype="uint8")
    for lo, hi, col in cls:
        img[(n >= lo) & (n < hi)] = (*col, 210)
    Image.fromarray(img).save(os.path.join(OUT, "coverage.png"), optimize=True)
    z = dem()
    sections = []
    for lat in (7.55, 7.05, 6.45):  # north of the confluence floodplain, mid-reach floodplain, south
        r = int(round((a.Y1 - lat) / a.RES))
        sections.append({"lat": lat, "lon": [round(a.X0 + (c + 0.5) * a.RES, 4) for c in range(0, a.W, 2)],
                         "elev_m": [None if np.isnan(z[r, c]) else round(float(z[r, c]), 1) for c in range(0, a.W, 2)],
                         "freq_pct": [None if np.isnan(freq[r, c]) else round(float(freq[r, c]), 1) for c in range(0, a.W, 2)],
                         "plain": [bool(plain[r, c]) for c in range(0, a.W, 2)]})
    res["sections"] = sections
    json.dump(res, open(os.path.join(OUT, "robustness.json"), "w"), separators=(",", ":"))
    print(json.dumps({k: res[k] for k in ("otsu_summary", "coverage")}, indent=1))


if __name__ == "__main__":
    main()
