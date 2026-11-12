"""Part A, change detection: flood extent as water in a month that was not water in the same year's dry season.

Why: the Sentinel-2 check showed that radar 'water' in the dry season is mostly dry, bare ground that is dark
to the radar (a02_robustness.py, a03_dualpol.py). Such surfaces are dark in both the dry-season reference and
the flood month, so subtracting the reference removes them; permanent rivers cancel too. This is the usual
change-detection logic for SAR flood mapping (e.g. Clement et al., 2018) and, unlike the floodplain mask, it
uses no JRC data, so the comparison with JRC and with Sentinel-2 is not circular.

Water: both VH and VV below their thresholds (a03_dualpol.py). Dry-season reference: water in the February or
March median composite of the same year (the driest months). Flood extension in month m = water(m) and not
reference water. Checked against Sentinel-2: optical water in October-November 2022 that was not water in
February 2022.

Output: part_a/data/change.json, part_a/data/flood_extension_2022-10.png
"""
import json, os, sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import a01_flood_pc as a  # noqa: E402
from a02_robustness import px_area, s2_water  # noqa: E402

CACHE, OUT = a.CACHE, a.OUT


def main():
    A = px_area()
    D = json.load(open(os.path.join(OUT, "dualpol.json")))
    TVH, TVV = D["thresholds_db"]["vh"], D["thresholds_db"]["vv"]
    slope = np.load(os.path.join(CACHE, "slope.npy")); gentle = slope < a.SLOPE_MAX
    occ, ext = np.load(os.path.join(CACHE, "jrc_occurrence.npy")), np.load(os.path.join(CACHE, "jrc_extent.npy"))
    plain = (ext >= 0.5) & (occ < a.PERM)
    water = {}
    for y in range(2018, 2024):
        for m in range(1, 13):
            d = np.load(os.path.join(CACHE, f"dual_{y}_{m:02d}.npz"))
            water[(y, m)] = (d["vh"] < TVH) & (d["vv"] < TVV) & gentle
    rows = []
    for y in range(2018, 2024):
        ref = water[(y, 2)] | water[(y, 3)]
        for m in range(1, 13):
            ext_m = water[(y, m)] & ~ref
            rows.append({"year": y, "month": m, "extension_km2": round(float(A[ext_m].sum()), 1),
                         "extension_inside_jrc_floodplain_share": round(float(A[ext_m & plain].sum() / max(A[ext_m].sum(), 1e-9)), 3)})
    # Sentinel-2 check of the flood extension, 2022
    s2_dry, c_dry = s2_water("2022-02-01", "2022-02-28", 10)
    s2_wet, c_wet = s2_water("2022-10-15", "2022-11-30", 40)
    clear = c_dry & c_wet & gentle
    s2_ext = s2_wet & ~s2_dry & clear
    wet = np.load(os.path.join(CACHE, "dual_2022_10.npz")); wet11 = np.load(os.path.join(CACHE, "dual_2022_11.npz"))
    vh = np.nanmedian(np.stack([wet["vh"], wet11["vh"]]), axis=0); vv = np.nanmedian(np.stack([wet["vv"], wet11["vv"]]), axis=0)
    s1_ext = (vh < TVH) & (vv < TVV) & gentle & ~(water[(2022, 2)] | water[(2022, 3)]) & clear
    both = A[s1_ext & s2_ext].sum()
    check = {"s1_extension_km2": round(float(A[s1_ext].sum()), 1), "s2_extension_km2": round(float(A[s2_ext].sum()), 1),
             "s1_confirmed_by_s2": round(float(both / max(A[s1_ext].sum(), 1e-9)), 3),
             "s2_found_by_s1": round(float(both / max(A[s2_ext].sum(), 1e-9)), 3),
             # how much of the confirmed area a JRC-floodplain mask would have kept
             "confirmed_inside_jrc_floodplain_share": round(float(A[s1_ext & s2_ext & plain].sum() / max(both, 1e-9)), 3)}
    res = {"method": "dual-polarisation water minus same-year February-March water", "thresholds_db": {"vh": TVH, "vv": TVV},
           "monthly": rows, "sentinel2_check_2022": check}
    json.dump(res, open(os.path.join(OUT, "change.json"), "w"), indent=1)
    from PIL import Image
    e = water[(2022, 10)] & ~(water[(2022, 2)] | water[(2022, 3)])
    im = np.zeros((a.H, a.W, 4), dtype="uint8"); im[e] = (31, 86, 176, 235)
    im[(water[(2022, 2)] | water[(2022, 3)]) & water[(2022, 10)]] = (120, 120, 112, 160)
    Image.fromarray(im).save(os.path.join(OUT, "flood_extension_2022-10.png"), optimize=True)
    print(json.dumps(check, indent=1))
    import collections
    mm = collections.defaultdict(list)
    for r in rows: mm[r["month"]].append(r["extension_km2"])
    print({k: round(float(np.mean(v))) for k, v in mm.items()})


if __name__ == "__main__":
    main()
