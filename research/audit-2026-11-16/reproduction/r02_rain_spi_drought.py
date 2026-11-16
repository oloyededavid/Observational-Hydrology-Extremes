"""Reproduction steps 1-3 (Part B rainfall): basin-mean CHIRPS annual/monthly totals, gamma SPI-3/6/12, run-theory drought events.
Data: cache/chirps (CHIRPS v2.0 p25, own download r01). Own implementation of SPI (scipy gamma MLE, location 0, mixed
zero-probability distribution H = q + (1-q)G(x), totals < 0.5 mm count as zero; method definition read from the repo
docstrings, code not copied). Compared against part_b/data/rain_spi.json and drought.json.
Output: out/rain_spi_compare.json, cache/monthly_basin.npy"""
import json, numpy as np
from scipy import stats
from common import *
YEARS = list(range(1981, 2025)); REF = (1991, 2020)
cl = cells("sokoto_rima"); w = wts("sokoto_rima")
cell_month = []; cell_ann = []; nan_days = 0
for y in YEARS:
    x = load_year(y, "sokoto_rima"); nan_days += int(np.isnan(x).sum())
    e = month_edges(x.shape[0])
    cell_month.append(np.stack([np.nansum(x[e[k]:e[k+1]], axis=0) for k in range(12)]))
    cell_ann.append(np.nansum(x, axis=0))
cell_month = np.concatenate(cell_month)           # (528, cells)
cell_ann = np.array(cell_ann)                     # (44, cells)
ann = cell_ann @ w / w.sum(); mon = cell_month @ w / w.sum()
yrs = np.array(YEARS)
np.save(f"{HERE}/cache/monthly_basin.npy", mon)
pub = json.load(open(f"{REPO}/part_b/data/rain_spi.json")); dr = json.load(open(f"{REPO}/part_b/data/drought.json"))
res = {"nan_days_in_basin_cells": nan_days}
# 1 annual totals
pa = np.array([r["rain_mm"] for r in pub["years"]])
res["annual_rain_mm"] = {"n_years": 44, "max_abs_diff_vs_published_(rounded .1)": float(np.abs(ann - pa).max()), "mean_mm_pub": pub["mean_mm"], "mean_mm_new": float(ann.mean()),
    "cv_pub": pub["cv"], "cv_new": float(ann.std(ddof=1) / ann.mean()), "annual_new": {int(y): round(float(a), 2) for y, a in zip(yrs, ann)}}
# monthly climatology vs published
bclim = mon.reshape(44, 12)
res["monthly_climatology"] = {"published_mean": dr["climatology"]["mean"], "new_mean": [round(float(v), 1) for v in bclim.mean(0)],
    "max_abs_diff": float(np.abs(np.array(dr["climatology"]["mean"]) - bclim.mean(0)).max()),
    "wet_season_share_pub": dr["climatology"]["wet_season_share"], "wet_season_share_new": float(bclim[:, 4:10].sum() / bclim.sum())}
tr = stats.linregress(yrs, ann)
res["trend"] = {"pub_mm_per_decade": pub["trend_mm_per_decade"], "new": 10 * tr.slope, "pub_p": pub["trend_p"], "new_p": tr.pvalue,
                "slope_95ci_mm_per_decade": [10 * (tr.slope - 2.018 * tr.stderr), 10 * (tr.slope + 2.018 * tr.stderr)],
                "kendall_pub": pub["kendall_tau"], "kendall_new": stats.kendalltau(yrs, ann).statistic}
# 2a annual SPI
sel = (yrs >= REF[0]) & (yrs <= REF[1])
a, _, sc = stats.gamma.fit(ann[sel], floc=0)
spi_a = stats.norm.ppf(stats.gamma.cdf(ann, a, scale=sc))
ps = np.array([r["spi"] for r in pub["years"]])
ks = stats.kstest(ann[sel], "gamma", args=(a, 0, sc))
# Lilliefors-type parametric bootstrap p (params refitted each draw)
rng = np.random.default_rng(1); bs = []
for _ in range(1000):
    s = rng.gamma(a, sc, sel.sum()); aa, _, ss = stats.gamma.fit(s, floc=0); bs.append(stats.kstest(s, "gamma", args=(aa, 0, ss)).statistic)
res["annual_spi"] = {"gamma_shape_pub": pub["gamma_shape"], "gamma_shape_new": a, "gamma_scale_pub": pub["gamma_scale"], "gamma_scale_new": sc,
    "max_abs_diff_spi": float(np.abs(spi_a - ps).max()), "n_years_spi_differs_gt_0.01": int((np.abs(spi_a - ps) > 0.0101).sum()),
    "class_mismatches": int(sum((s <= -1) != (p <= -1) for s, p in zip(spi_a, ps))),
    "ks_stat": ks.statistic, "ks_p_naive": ks.pvalue, "ks_p_lilliefors_bootstrap": float(np.mean(np.array(bs) >= ks.statistic)),
    "shapiro_p_of_spi_ref": float(stats.shapiro(spi_a[sel]).pvalue), "spi_new": {int(y): round(float(s), 2) for y, s in zip(yrs, spi_a)}}
# 2b monthly SPI-k
def spi_k(series, k):
    n = len(series); acc = np.full(n, np.nan)
    for t in range(k - 1, n): acc[t] = series[t-k+1:t+1].sum()
    out = np.full(n, np.nan); diag = {}
    yy = np.repeat(YEARS, 12)
    for m in range(12):
        rows = np.arange(m, n, 12); ref = rows[(yy[rows] >= REF[0]) & (yy[rows] <= REF[1])]
        r = acc[ref]; r = r[np.isfinite(r)]; nz = r[r >= 0.5]; q = 1 - len(nz) / len(r)
        if q > 0.3 or len(nz) < 10 or np.median(r) < 10: diag[m + 1] = None; continue
        al, _, s_ = stats.gamma.fit(nz, floc=0)
        x = acc[rows]; H = q + (1 - q) * np.where(x >= 0.5, stats.gamma.cdf(x, al, scale=s_), 0.0)
        out[rows] = np.where(np.isfinite(x), stats.norm.ppf(np.clip(H, 1e-6, 1 - 1e-6)), np.nan)
        k_ = stats.kstest(nz, "gamma", args=(al, 0, s_)); diag[m + 1] = {"q_zero": round(q, 3), "shape": round(al, 2), "ks_stat": round(k_.statistic, 3), "ks_p_naive": round(k_.pvalue, 3), "n_nonzero": len(nz)}
    return out, diag
def runs(x, thr=-1.0):
    ev = []; st = None
    for t, v in enumerate(list(x) + [np.nan]):
        if np.isfinite(v) and v <= thr: st = t if st is None else st
        elif st is not None: ev.append((st, t - st, float(-np.sum(x[st:t])))); st = None
    return ev
res["spi_monthly"] = {}
for k in (3, 6, 12):
    s, diag = spi_k(mon, k)
    p = np.array([np.nan if v is None else v for v in dr["spi_basin"][str(k)]], dtype=float)
    both = np.isfinite(s) & np.isfinite(p)
    d = np.abs(s - p)[both]
    ev = runs(s); pev = [(int(e["start"][:4]) * 12 + int(e["start"][5:]) - 1 - 1981 * 12, e["months"], e["severity"]) for e in dr["events_basin"][str(k)]]
    res["spi_monthly"][f"SPI-{k}"] = {
        "defined_months_pub": int(np.isfinite(p).sum()), "defined_months_new": int(np.isfinite(s).sum()), "same_defined_mask": bool(np.array_equal(np.isfinite(s), np.isfinite(p))),
        "max_abs_diff": float(d.max()), "mean_abs_diff": float(d.mean()), "n_months_diff_gt_0.011": int((d > 0.011).sum()), "n_compared": int(both.sum()),
        "events_pub": len(pev), "events_new": len(ev), "events_identical_start_duration": bool([(a_, b_) for a_, b_, _ in ev] == [(a_, b_) for a_, b_, _ in pev]),
        "longest_pub": max(e[1] for e in pev), "longest_new": max(e[1] for e in ev),
        "mean_duration_pub": float(np.mean([e[1] for e in pev])), "mean_duration_new": float(np.mean([e[1] for e in ev])),
        "mean_severity_pub": float(np.mean([e[2] for e in pev])), "mean_severity_new": float(np.mean([e[2] for e in ev])),
        "max_severity_pub": max(e[2] for e in pev), "max_severity_new": max(e[2] for e in ev),
        "max_abs_severity_diff_matched_events": float(max([abs(a_[2] - b_[2]) for a_, b_ in zip(ev, pev)] or [0])),
        "events_new_list": [{"start": f"{1981 + st // 12}-{st % 12 + 1:02d}", "months": d_, "severity": round(sv, 2)} for st, d_, sv in ev],
        "ks_per_calendar_month": diag}
    if k == 12:
        # SPI-12 with a threshold sensitivity (not published) and event sensitivity to treating SPI-12 Dec = annual SPI
        res["spi12_december_vs_annual_spi_max_abs"] = float(np.max(np.abs(s[11::12] - spi_a)))
        res["spi12_event_sensitivity_threshold"] = {str(t): {"events": len(runs(s, t)), "longest": max([e[1] for e in runs(s, t)] or [0])} for t in (-0.5, -1.0, -1.5)}
        s12 = s
# 4 reference-period sensitivity of annual SPI (full 1981-2024 reference)
a2, _, sc2 = stats.gamma.fit(ann, floc=0); spi_full = stats.norm.ppf(stats.gamma.cdf(ann, a2, scale=sc2))
res["annual_spi_ref_sensitivity"] = {"years_spi<=-1_ref1991_2020": [int(y) for y, s in zip(yrs, spi_a) if s <= -1], "years_spi<=-1_ref1981_2024": [int(y) for y, s in zip(yrs, spi_full) if s <= -1],
    "reference_period_mean_mm": {"1981_1990": float(ann[yrs < 1991].mean()), "1991_2020": float(ann[sel].mean()), "2021_2024": float(ann[yrs > 2020].mean())}}
# SPI-12 series in the 1980s: duration of the 1982-85 event is sensitive to the 1991-2020 (wetter) reference
res["note_1982_event"] = "published SPI-12 event starting 1982-07 lasts 48 months; compare 'events_new_list' for SPI-12"
np.save(f"{HERE}/cache/spi12_new.npy", s12)
import os; os.makedirs(f"{HERE}/out", exist_ok=True)
json.dump(res, open(f"{HERE}/out/rain_spi_compare.json", "w"), indent=1, default=float)
print(json.dumps({k: v for k, v in res.items() if k not in ("annual_rain_mm",)}, indent=1, default=float)[:9000])
