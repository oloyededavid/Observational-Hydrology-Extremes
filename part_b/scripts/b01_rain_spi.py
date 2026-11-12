"""Part B, corrected rainfall index: annual rainfall and a gamma-fitted SPI for the Sokoto-Rima basin.

The original notebook standardised annual totals as z-scores and called them SPI. Here the Standardized
Precipitation Index follows McKee et al. (1993): a two-parameter gamma distribution (location fixed at 0)
is fitted to annual totals of the 1991-2020 reference period, and each year's cumulative probability is
converted to a standard normal value. Classes: <= -2 extreme, -2 to -1.5 severe, -1.5 to -1 moderate
drought; -1 to 1 near normal; >= 1 wet.

Rainfall: CHIRPS v2.0 daily, 0.25-degree product, averaged over the basin's 245 cells with cos(latitude)
weights, 1981-2024 (complete years). This needs no Earth Engine; it uses the CHIRPS files cut by
part_c/scripts/c03_chirps.py. The v2 notebook computes the same index from the 0.05-degree data in
Earth Engine; small differences between the two are expected.

Output: part_b/data/rain_spi.json (basin) and part_b/data/rain_spi_cells.json (each 0.25-degree cell:
annual rainfall, SPI fitted per cell to 1991-2020, and the coefficient of variation, 1981-2024).
"""
import json, os
import numpy as np
from scipy import stats

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CH = os.path.join(ROOT, "part_c", "cache", "chirps")
YEARS = range(1981, 2025)
REF = (1991, 2020)


def classify(s):
    if s <= -2: return "extreme drought"
    if s <= -1.5: return "severe drought"
    if s <= -1: return "moderate drought"
    if s < 1: return "near normal"
    return "wet"


def main():
    cells = json.load(open(os.path.join(ROOT, "part_c", "data", "cells.json")))["sokoto_rima"]
    tot, per_cell = [], []
    for y in YEARS:
        d = np.load(os.path.join(CH, f"{y}.npz"))
        lat, lon, pr = d["sokoto_rima_lat"], d["sokoto_rima_lon"], d["sokoto_rima_pr"]
        idx = [(int(np.argmin(np.abs(lat - c[1]))), int(np.argmin(np.abs(lon - c[0])))) for c in cells]
        annual = np.array([np.nansum(pr[:, j, i]) for j, i in idx])
        per_cell.append(annual)
        w = np.cos(np.radians([c[1] for c in cells]))
        tot.append(float(np.sum(annual * w) / np.sum(w)))
    tot = np.array(tot)
    yrs = np.array(list(YEARS))
    ref = tot[(yrs >= REF[0]) & (yrs <= REF[1])]
    a, _, scale = stats.gamma.fit(ref, floc=0)
    spi = stats.norm.ppf(stats.gamma.cdf(tot, a, loc=0, scale=scale))
    z_all = (tot - tot.mean()) / tot.std(ddof=1)
    z_0025 = np.full_like(tot, np.nan)
    m = yrs >= 2000
    z_0025[m] = (tot[m] - tot[m].mean()) / tot[m].std(ddof=1)
    trend = stats.linregress(yrs, tot)
    tau = stats.kendalltau(yrs, tot)
    out = {
        "source": "CHIRPS v2.0 daily p25, cos-latitude weighted mean of 245 basin cells",
        "reference": list(REF), "gamma_shape": a, "gamma_scale": scale,
        "mean_mm": float(tot.mean()), "cv": float(tot.std(ddof=1) / tot.mean()),
        "trend_mm_per_decade": 10 * trend.slope, "trend_p": trend.pvalue, "kendall_tau": tau.statistic, "kendall_p": tau.pvalue,
        "years": [
            {"year": int(y), "rain_mm": round(float(t), 1), "spi": round(float(s), 2), "class": classify(s),
             "z_score_2000_2024": None if np.isnan(z) else round(float(z), 2)}
            for y, t, s, z in zip(yrs, tot, spi, z_0025)
        ],
    }
    os.makedirs(os.path.join(ROOT, "part_b", "data"), exist_ok=True)
    pc = np.array(per_cell)  # (years, cells)
    spi_c = np.empty_like(pc)
    sel = (yrs >= REF[0]) & (yrs <= REF[1])
    for k in range(pc.shape[1]):
        ak, _, sk = stats.gamma.fit(pc[sel, k], floc=0)
        spi_c[:, k] = stats.norm.ppf(stats.gamma.cdf(pc[:, k], ak, loc=0, scale=sk))
    json.dump({"cells": cells, "years": [int(y) for y in yrs], "reference": list(REF),
               "rain_mm": [[round(float(v)) for v in row] for row in pc],
               "spi": [[round(float(v), 2) for v in row] for row in spi_c],
               "mean_mm": [round(float(v)) for v in pc.mean(axis=0)],
               "cv_pct": [round(float(v), 1) for v in 100 * pc.std(axis=0, ddof=1) / pc.mean(axis=0)]},
              open(os.path.join(ROOT, "part_b", "data", "rain_spi_cells.json"), "w"), separators=(",", ":"))
    json.dump(out, open(os.path.join(ROOT, "part_b", "data", "rain_spi.json"), "w"), indent=1)
    dry = [r for r in out["years"] if r["spi"] <= -1]
    print(f"mean {tot.mean():.0f} mm, CV {out['cv']:.2f}, trend {out['trend_mm_per_decade']:+.0f} mm/decade (p={trend.pvalue:.3f})")
    print("drought years (SPI <= -1):", [(r["year"], r["spi"]) for r in dry])
    # where the old z-score and the gamma SPI disagree on the class
    diff = [(r["year"], r["z_score_2000_2024"], r["spi"]) for r in out["years"]
            if r["z_score_2000_2024"] is not None and classify(r["z_score_2000_2024"]) != r["class"]]
    print("class changes vs z-score 2000-2024:", diff)


if __name__ == "__main__":
    main()
