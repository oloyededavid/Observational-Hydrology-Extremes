"""Reproduction step 4b: growing-season NDVI against rainfall, Sokoto-Rima, 2001-2024. Own code.

Inputs: cache/modis_composites.json (r03, MODIS MOD13Q1 v6.1 basin means per composite with the share of valid
pixels) and cache/monthly_basin.npy (r02, CHIRPS basin-mean monthly totals 1981-2024).

1. The published definition: mean of the July-October composites, a missing composite filled with that date's
   all-year mean shifted by the year's anomaly on its other dates; annual rainfall. Pearson r raw, after linear
   detrending of both series, and on first differences.
2. Robustness not in the published analysis:
   - composites with less than 80 % valid basin pixels treated as missing (cloud leaves the mean over a biased area)
   - growing-season (July-October) rainfall instead of the calendar year
   - Spearman rank correlation
   - effective sample size for lag-1 autocorrelation (Bretherton et al., 1999: n_eff = n (1 - r1 r2)/(1 + r1 r2),
     capped at n; lag-1 estimates from 23-24 points are themselves uncertain)
   - leave-one-year-out range of r
Output: out/ndvi_rain_compare.json
"""
import json
import os

import numpy as np
from scipy import stats
from scipy.signal import detrend

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = "/home/user/observational-hydrology-extremes"
YEARS = list(range(2001, 2025))
DOYS = [193, 209, 225, 241, 257, 273, 289]
comp = json.load(open(f"{HERE}/cache/modis_composites.json"))
mon = np.load(f"{HERE}/cache/monthly_basin.npy").reshape(44, 12)  # 1981-2024
rain_year = {1981 + i: float(mon[i].sum()) for i in range(44)}
rain_jaso = {1981 + i: float(mon[i, 6:10].sum()) for i in range(44)}
pub = json.load(open(f"{REPO}/part_b/data/ndvi.json"))


def growing_season(min_valid=0.0):
    per = {y: {int(d): v[0] for d, v in comp[str(y)].items() if v[0] is not None and v[1] >= min_valid} for y in YEARS}
    clim = {d: np.mean([per[y][d] for y in YEARS if d in per[y]]) for d in DOYS}
    gs, nfill = {}, 0
    for y in YEARS:
        have = [d for d in DOYS if d in per[y]]
        anom = np.mean([per[y][d] - clim[d] for d in have])
        gs[y] = float(np.mean([per[y][d] if d in per[y] else clim[d] + anom for d in DOYS]))
        nfill += len(DOYS) - len(have)
    return np.array([gs[y] for y in YEARS]), nfill


def r1(x):
    return float(np.corrcoef(x[:-1], x[1:])[0, 1])


def corr_block(x, v):
    out = {}
    for name, (a, b) in {"raw": (x, v), "detrended": (detrend(x), detrend(v)), "differenced": (np.diff(x), np.diff(v))}.items():
        r, p = stats.pearsonr(a, b)
        rho, ps = stats.spearmanr(a, b)
        n = len(a)
        ra, rb = r1(a), r1(b)
        neff = min(n, n * (1 - ra * rb) / (1 + ra * rb))  # capped at n: opposite-signed lag-1 terms would otherwise inflate it
        t = r * np.sqrt(max(neff - 2, 1) / (1 - r * r))
        p_adj = 2 * stats.t.sf(abs(t), max(neff - 2, 1))
        loo = [stats.pearsonr(np.delete(a, i), np.delete(b, i))[0] for i in range(n)]
        out[name] = {"pearson_r": round(float(r), 3), "p": float(f"{p:.2e}"), "spearman_rho": round(float(rho), 3),
                     "lag1_autocorr": [round(ra, 2), round(rb, 2)], "n": n, "n_eff": round(float(neff), 1), "p_autocorr_adjusted": float(f"{p_adj:.2e}"),
                     "leave_one_out_r_min_max": [round(float(min(loo)), 3), round(float(max(loo)), 3)]}
    return out


res = {}
x, nfill = growing_season()
ny = np.array([rain_year[y] for y in YEARS])
nj = np.array([rain_jaso[y] for y in YEARS])
pg = np.array([pub["ndvi_growing_season"][str(y)] for y in YEARS])
res["growing_season_ndvi_vs_published"] = {"max_abs_diff": round(float(np.abs(x - pg).max()), 4), "filled_composites": nfill,
                                           "published_filled": sum(len(v) for v in pub["filled_composites"].values())}
res["published"] = {k: pub[k] for k in ("raw", "detrended", "differenced")}
res["same_definition_annual_rain"] = corr_block(x, ny)
res["growing_season_rain_jul_oct"] = corr_block(x, nj)
x80, nfill80 = growing_season(0.8)
res["composites_below_80pct_valid_treated_missing"] = {"filled_composites": nfill80, **corr_block(x80, ny)}
tr_n, tr_r = stats.linregress(YEARS, x), stats.linregress(YEARS, ny)
res["trends_2001_2024"] = {"ndvi_per_decade": round(10 * tr_n.slope, 4), "ndvi_p": float(f"{tr_n.pvalue:.2e}"),
                           "rain_mm_per_decade": round(10 * tr_r.slope, 1), "rain_p": float(f"{tr_r.pvalue:.2e}")}
os.makedirs(f"{HERE}/out", exist_ok=True)
json.dump(res, open(f"{HERE}/out/ndvi_rain_compare.json", "w"), indent=1)
print(json.dumps(res, indent=1))
