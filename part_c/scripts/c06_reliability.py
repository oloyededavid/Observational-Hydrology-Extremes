"""Part C reliability: how far the design-rainfall changes depend on choices, and how good the models are.

Reads the same cached CHIRPS and NEX-GDDP-CMIP6 cut-outs as c05_analysis.py.

1. Distribution sensitivity. Uplift factors with a Gumbel fit (GEV with shape 0, by L-moments) beside the GEV.
2. Baseline sensitivity. CHIRPS return levels for 1981-2010, 1985-2014 and 1995-2024.
3. Uncertainty decomposition of the uplift factor (variance shares): sampling (within-model bootstrap of
   years), model (spread of the 23 model estimates), scenario (SSP2-4.5 vs SSP5-8.5) and distribution
   (GEV vs Gumbel). A simplified form of the partition of Hawkins & Sutton (2009); the shares describe this
   ensemble, not every source of uncertainty (downscaling, internal variability beyond 30-year sampling and
   observational uncertainty are not included).
4. Model performance against CHIRPS, 1985-2014, per study area: 25-year return level, mean annual maximum,
   annual total, seasonal-cycle correlation, spatial-pattern correlation, median dry spell; plus the two gauges
   for Sokoto-Rima. NEX-GDDP is bias-corrected toward another observational dataset over the historical
   period, so this measures consistency with CHIRPS, not independent skill.
5. Model families. Models sharing an atmosphere model are grouped (after Kuma et al., 2023); a weighted median
   gives each family, not each model, equal weight.
6. Return-level curves with bootstrap 90% intervals (CHIRPS), L-moment ratios (GEV adequacy), and historical
   vs future distributions of the basin annual maximum and longest dry spell.

Output: part_c/data/reliability.json
"""
import json, os, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT); sys.path.insert(0, os.path.join(ROOT, "scripts"))
import extremes as ex  # noqa: E402
from c05_analysis import load, MODELS, BASE, FUT, AREAS, month_slices, cell_index, NEX, CH  # noqa: E402

TS = [2, 5, 10, 25, 50, 100]
SCENS = ["ssp245", "ssp585"]
NB = 300
FAMILY = {  # atmosphere-model families (Kuma et al., 2023); models not listed form their own family
    "HadGEM3-GC31-LL": "UM", "KACE-1-0-G": "UM", "ACCESS-CM2": "UM", "ACCESS-ESM1-5": "UM",
    "CESM2": "CAM", "NorESM2-MM": "CAM", "TaiESM1": "CAM", "CMCC-CM2-SR5": "CAM",
    "MPI-ESM1-2-HR": "ECHAM", "NESM3": "ECHAM", "GFDL-CM4": "GFDL", "KIOST-ESM": "GFDL",
    "EC-Earth3": "IFS", "CNRM-CM6-1": "IFS",
}


def gumbel_rl(x, Ts):
    l1, l2, _ = ex.lmoments(x)
    al = l2 / np.log(2); xi = l1 - ex.EULER * al
    return np.stack([xi - al * np.log(-np.log(1 - 1 / T)) for T in Ts])


def lmr(x):
    """L-skewness and L-kurtosis along axis 0."""
    x = np.sort(x, axis=0); n = x.shape[0]; j = np.arange(n).reshape((-1,) + (1,) * (x.ndim - 1))
    b0 = x.mean(0); b1 = (j / (n - 1) * x).mean(0); b2 = (j * (j - 1) / ((n - 1) * (n - 2)) * x).mean(0)
    b3 = (j * (j - 1) * (j - 2) / ((n - 1) * (n - 2) * (n - 3)) * x).mean(0)
    l2 = 2 * b1 - b0; l3 = 6 * b2 - 6 * b1 + b0; l4 = 20 * b3 - 30 * b2 + 12 * b1 - b0
    return l3 / l2, l4 / l2


def wmedian(v, w):
    o = np.argsort(v); v, w = np.asarray(v)[o], np.asarray(w)[o]; c = np.cumsum(w) / np.sum(w)
    return float(v[np.searchsorted(c, 0.5)])


def monthly_clim(kind, area, cells, model=None, scen=None, years=BASE):
    """Basin-mean monthly totals averaged over the years (mm/month)."""
    tot = np.zeros(12); idx = None
    for y in years:
        f = os.path.join(CH, f"{y}.npz") if kind == "chirps" else os.path.join(NEX, f"{model}_{scen}_{y}.npz")
        d = np.load(f); arr = d[f"{area}_pr"]
        if idx is None:
            idx = cell_index(d[f"{area}_lat"], d[f"{area}_lon"], cells[area])
        x = np.nanmean(np.stack([arr[:, j, i] for j, i in idx], axis=1), axis=1)
        e = month_slices(arr.shape[0], y)
        tot += np.array([x[e[k]:e[k + 1]].sum() for k in range(12)])
    return tot / len(years)


def main():
    cells = json.load(open(os.path.join(ROOT, "data", "cells.json")))
    rng = np.random.default_rng(20261113)
    out = {"settings": {"return_periods": TS, "bootstrap": NB, "families": FAMILY}, "areas": {}}
    for a in AREAS:
        A = {}
        obs = load("chirps", cells, years=BASE)[a]
        # 2. baseline sensitivity
        A["baseline"] = {}
        for w in [(1981, 2010), (1985, 2014), (1995, 2024)]:
            d = load("chirps", cells, years=range(w[0], w[1] + 1))[a]["rx"]
            A["baseline"][f"{w[0]}-{w[1]}"] = {str(T): round(float(np.median(v)), 1) for T, v in zip(TS, ex.return_levels(d, TS))}
        # 6. CHIRPS return-level curve with bootstrap interval (area median)
        Tc = [1.5, 2, 3, 5, 10, 20, 25, 50, 100, 200]
        boot = np.array([np.median(ex.return_levels(obs["rx"][ix], Tc), axis=1) for ix in ex.boot_indices(30, 500, rng)])
        A["rl_curve_chirps"] = {"T": Tc, "median": [round(float(v), 1) for v in np.median(ex.return_levels(obs["rx"], Tc), axis=1)],
                                "p05": [round(float(v), 1) for v in np.percentile(boot, 5, axis=0)], "p95": [round(float(v), 1) for v in np.percentile(boot, 95, axis=0)]}
        # empirical plotting positions of the area-median annual maximum (Gringorten)
        am = np.sort(np.median(obs["rx"], axis=1)); n = len(am)
        A["rl_points_chirps"] = {"T": [round(float(1 / (1 - (i + 1 - 0.44) / (n + 0.12))), 2) for i in range(n)], "mm": [round(float(v), 1) for v in am]}
        t3, t4 = lmr(obs["rx"])
        A["lmoment_ratios"] = {"chirps": {"t3": [round(float(v), 3) for v in t3], "t4": [round(float(v), 3) for v in t4]}}
        clim_obs = monthly_clim("chirps", a, cells)
        perf, up_gev, up_gum, boot_var, rl_curves = {}, {s: {} for s in SCENS}, {s: {} for s in SCENS}, {s: [] for s in SCENS}, {"historical": [], **{s: [] for s in SCENS}}
        dist = {"historical": {"rx": [], "dry": []}, **{s: {"rx": [], "dry": []} for s in SCENS}}
        mt3, mt4 = [], []
        for m in MODELS:
            h = load("nex", cells, m, "historical", BASE)[a]
            rl_h = ex.return_levels(h["rx"], [25])[0]
            clim_m = monthly_clim("nex", a, cells, m, "historical")
            p = {"rl25_ratio": float(np.median(rl_h) / np.median(ex.return_levels(obs["rx"], [25])[0])),
                 "rx_mean_ratio": float(np.median(h["rx"].mean(0)) / np.median(obs["rx"].mean(0))),
                 "total_ratio": float(np.median(h["tot"].mean(0)) / np.median(obs["tot"].mean(0))),
                 "season_r": float(np.corrcoef(clim_m, clim_obs)[0, 1]),
                 "pattern_r": float(np.corrcoef(h["rx"].mean(0), obs["rx"].mean(0))[0, 1]),
                 "dry_median_diff": float(np.median(np.median(h["dry"], 0)) - np.median(np.median(obs["dry"], 0))) if a == "sokoto_rima" else None}
            perf[m] = {k: (None if v is None else round(v, 3)) for k, v in p.items()}
            s3, s4 = lmr(h["rx"]); mt3 += list(s3[::4]); mt4 += list(s4[::4])
            rl_curves["historical"].append(np.median(ex.return_levels(h["rx"], Tc), axis=1))
            dist["historical"]["rx"] += list(np.median(h["rx"], 1)); dist["historical"]["dry"] += list(np.median(h["dry"], 1))
            for s in SCENS:
                f = load("nex", cells, m, s, FUT)[a]
                g = np.median(ex.return_levels(f["rx"], TS) / ex.return_levels(h["rx"], TS), axis=1)
                u = np.median(gumbel_rl(f["rx"], TS) / gumbel_rl(h["rx"], TS), axis=1)
                up_gev[s][m] = [round(float(v), 4) for v in g]; up_gum[s][m] = [round(float(v), 4) for v in u]
                bh, bf = ex.boot_indices(30, NB, rng), ex.boot_indices(30, NB, rng)
                bs = np.array([np.median(ex.return_levels(f["rx"][bf[b]], TS) / ex.return_levels(h["rx"][bh[b]], TS), axis=1) for b in range(NB)])
                boot_var[s].append(bs.var(axis=0))
                rl_curves[s].append(np.median(ex.return_levels(f["rx"], Tc), axis=1))
                dist[s]["rx"] += list(np.median(f["rx"], 1)); dist[s]["dry"] += list(np.median(f["dry"], 1))
            print(a, m, flush=True)
        A["performance"] = perf
        A["lmoment_ratios"]["models_sample"] = {"t3": [round(float(v), 3) for v in mt3], "t4": [round(float(v), 3) for v in mt4]}
        A["uplift_gev"], A["uplift_gumbel"] = up_gev, up_gum
        names = list(MODELS); fam = [FAMILY.get(m, m) for m in names]
        wts = np.array([1 / fam.count(f) for f in fam])
        A["ensemble"] = {}
        for s in SCENS:
            G = np.array([up_gev[s][m] for m in names]); U = np.array([up_gum[s][m] for m in names])
            A["ensemble"][s] = {"gev_median": [round(float(v), 3) for v in np.median(G, 0)], "gumbel_median": [round(float(v), 3) for v in np.median(U, 0)],
                                "gev_family_weighted": [round(wmedian(G[:, i], wts), 3) for i in range(len(TS))],
                                "gev_p10": [round(float(v), 3) for v in np.percentile(G, 10, 0)], "gev_p90": [round(float(v), 3) for v in np.percentile(G, 90, 0)]}
        # 3. decomposition of uplift variance per return period
        dec = {}
        for i, T in enumerate(TS):
            gev = {s: np.array([up_gev[s][m][i] for m in names]) for s in SCENS}
            gum = {s: np.array([up_gum[s][m][i] for m in names]) for s in SCENS}
            v_samp = float(np.mean([np.mean([bv[i] for bv in boot_var[s]]) for s in SCENS]))
            v_model = float(np.mean([gev[s].var(ddof=1) for s in SCENS]))
            v_scen = float(np.var([gev[s].mean() for s in SCENS], ddof=1))
            v_dist = float(np.mean([np.var([gev[s].mean(), gum[s].mean()], ddof=1) for s in SCENS]))
            # model spread already contains sampling noise; the model part is what remains after removing it
            v_model_net = max(v_model - v_samp, 0.0)
            tot = v_samp + v_model_net + v_scen + v_dist
            dec[str(T)] = {k: round(v / tot, 3) for k, v in (("sampling", v_samp), ("model", v_model_net), ("scenario", v_scen), ("distribution", v_dist))}
            dec[str(T)]["total_sd"] = round(float(np.sqrt(tot)), 3)
        A["decomposition"] = dec
        A["rl_curves_models"] = {k: {"T": Tc, "median": [round(float(v), 1) for v in np.median(np.array(c), 0)],
                                     "p10": [round(float(v), 1) for v in np.percentile(np.array(c), 10, 0)],
                                     "p90": [round(float(v), 1) for v in np.percentile(np.array(c), 90, 0)]} for k, c in rl_curves.items()}
        A["distributions"] = {k: {"rx": [round(float(v), 1) for v in d["rx"]], "dry": ([round(float(v), 1) for v in d["dry"]] if a == "sokoto_rima" else None)} for k, d in dist.items()}
        out["areas"][a] = A
    json.dump(out, open(os.path.join(ROOT, "data", "reliability.json"), "w"), separators=(",", ":"))
    for a in AREAS:
        A = out["areas"][a]
        print(a, "baseline", A["baseline"])
        for s in SCENS:
            e = A["ensemble"][s]; print(" ", s, "T50 gev", e["gev_median"][4], "gumbel", e["gumbel_median"][4], "family-weighted", e["gev_family_weighted"][4])
        print("  decomposition T50", A["decomposition"]["50"], "T100", A["decomposition"]["100"])


if __name__ == "__main__":
    main()
