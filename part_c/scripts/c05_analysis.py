"""Part C analysis: design rainfall and dry spells now and in 2041-2070, and how sure we can be.

Steps, per 0.25-degree cell of each study area:
1. Annual maximum daily rainfall (Rx1day) and, in the Sokoto-Rima basin, the longest run of days below
   1 mm in June-September, for CHIRPS 1985-2014 and for each model's historical run (1985-2014) and
   SSP2-4.5 / SSP5-8.5 runs (2041-2070).
2. GEV return levels by L-moments (part_c/extremes.py) for 2, 10, 25, 50 and 100 years.
3. Model check: each model's 1985-2014 statistics against CHIRPS, and its 1950-1980 statistics against
   the two Sokoto-Rima gauges (cell containing the gauge).
4. Change: for each model, future / historical return level in every cell (a ratio, so each model's
   remaining bias largely cancels), summarised as the median over the cells of the study area.
   Dry spells change in days.
5. Uncertainty: 500 bootstrap resamples of years per model and period (the same years for every cell),
   pooled over models with equal weight. The spread across models is also reported on its own.
6. Design uplift factor = that change ratio; design rainfall 2041-2070 = CHIRPS 1985-2014 return level x
   uplift factor.

Outputs: part_c/data/results.json (study-area summaries), part_c/data/cells_results.json (per cell,
for the explorer) and part_c/data/model_table.csv.
"""
import csv, json, os, sys, glob
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import extremes as ex  # noqa: E402
from scripts.c02_nexgddp import MODELS  # noqa: E402

TS = [2, 10, 25, 50, 100]
BASE, FUT, GAUGE = range(1985, 2015), range(2041, 2071), range(1950, 1981)
SCENS = ["ssp245", "ssp585"]
NB = 500
WET = 1.0
AREAS = ["niger_benue", "sokoto_rima"]
NEX, CH = os.path.join(ROOT, "cache", "nexgddp"), os.path.join(ROOT, "cache", "chirps")


def month_slices(ndays, year):
    """Day ranges of each month for the calendar implied by the year length (360, 365 or 366)."""
    if ndays == 360:
        lens = [30] * 12
    else:
        lens = [31, 29 if ndays == 366 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    edges = np.concatenate([[0], np.cumsum(lens)])
    return edges


def cell_index(lat, lon, cells):
    return [(int(np.argmin(np.abs(lat - c[1]))), int(np.argmin(np.abs(lon - c[0])))) for c in cells]


def yearly(arr, idx, ndays, year):
    """(Rx1day, Jun-Sep longest dry spell, annual total) for the listed cells."""
    x = np.stack([arr[:, j, i] for j, i in idx], axis=1)
    e = month_slices(ndays, year)
    core = x[e[5]:e[9]]
    return x.max(axis=0), ex.longest_dry_spell(core, WET), x.sum(axis=0)


def load(kind, cells, model=None, scen=None, years=()):
    out = {a: {"rx": [], "dry": [], "tot": [], "years": []} for a in AREAS}
    idxs = {}
    for y in years:
        f = os.path.join(CH, f"{y}.npz") if kind == "chirps" else os.path.join(NEX, f"{model}_{scen}_{y}.npz")
        if not os.path.exists(f):
            return None
        d = np.load(f)
        for a in AREAS:
            if a not in idxs:
                idxs[a] = cell_index(d[f"{a}_lat"], d[f"{a}_lon"], cells[a])
            arr = d[f"{a}_pr"]
            rx, dry, tot = yearly(arr, idxs[a], arr.shape[0], y)
            for k, v in zip(("rx", "dry", "tot"), (rx, dry, tot)):
                out[a][k].append(v)
            out[a]["years"].append(y)
    return {a: {k: np.array(v) for k, v in o.items()} for a, o in out.items()}


def summarise(draws):
    draws = np.asarray(draws)
    return {"median": float(np.median(draws)), "p05": float(np.percentile(draws, 5)), "p95": float(np.percentile(draws, 95))}


def main():
    cells = json.load(open(os.path.join(ROOT, "data", "cells.json")))
    gauges = json.load(open(os.path.join(ROOT, "data", "gauges.json")))
    rng = np.random.default_rng(20261112)
    obs = load("chirps", cells, years=BASE)
    res = {"settings": {"return_periods": TS, "baseline": [BASE[0], BASE[-1]], "future": [FUT[0], FUT[-1]],
                        "bootstrap": NB, "wet_day_mm": WET, "models": list(MODELS)}, "areas": {}}
    cells_out = {a: {"cells": cells[a], "chirps_rl": {}, "uplift": {s: {} for s in SCENS}} for a in AREAS}
    rows = []
    for a in AREAS:
        o = obs[a]
        rl_obs = ex.return_levels(o["rx"], TS)  # (T, cells)
        boot_obs = np.stack([np.median(ex.return_levels(o["rx"][ix], TS), axis=1) for ix in ex.boot_indices(len(BASE), NB, rng)])
        A = {"n_cells": len(cells[a]), "chirps": {
            "return_levels": {str(T): {"median_cells": float(np.median(rl_obs[i])), **{k: v for k, v in summarise(boot_obs[:, i]).items() if k != "median"}} for i, T in enumerate(TS)},
            "mean_annual_total": float(np.median(o["tot"].mean(axis=0))),
            "dry_spell_median": float(np.median(np.median(o["dry"], axis=0))),
            "dry_spell_p90": float(np.median(np.percentile(o["dry"], 90, axis=0)))}, "models": {}, "ensemble": {}}
        for i, T in enumerate(TS):
            cells_out[a]["chirps_rl"][str(T)] = [round(float(v), 1) for v in rl_obs[i]]
        pooled = {s: {"rl": [], "dry50": [], "dry90": [], "tot": []} for s in SCENS}
        point = {s: {"rl": [], "dry50": [], "dry90": [], "tot": []} for s in SCENS}
        for m in MODELS:
            h = load("nex", cells, m, "historical", BASE)
            if h is None:
                print("incomplete", m, "historical")
                continue
            h = h[a]
            rl_h = ex.return_levels(h["rx"], TS)
            mres = {"historical": {
                "rl_bias_vs_chirps": {str(T): float(np.median(rl_h[i]) / np.median(rl_obs[i])) for i, T in enumerate(TS)},
                "pattern_r": float(np.corrcoef(h["rx"].mean(axis=0), o["rx"].mean(axis=0))[0, 1]) if len(cells[a]) > 2 else None,
                "total_ratio_vs_chirps": float(np.median(h["tot"].mean(axis=0)) / np.median(o["tot"].mean(axis=0))),
                "dry_spell_median": float(np.median(np.median(h["dry"], axis=0)))}}
            g = load("nex", cells, m, "historical", GAUGE)
            if g is not None:
                # Null test: the same model's two historical periods, where no forced change is expected.
                # Its spread shows how much a single model's 30-year ratio moves by chance.
                rl_e = ex.return_levels(g[a]["rx"], TS)
                mres["historical"]["null_ratio"] = {str(T): float(np.median(rl_h[i] / rl_e[i])) for i, T in enumerate(TS)}
            if a == "sokoto_rima":
                if g is not None:
                    mres["gauge_check"] = {}
                    for sid, gv in gauges.items():
                        ci = int(np.argmin([(c[0] - gv["lon"]) ** 2 + (c[1] - gv["lat"]) ** 2 for c in cells[a]]))
                        yrs_rx = [int(y) for y in gv["rx1day"]]
                        yrs_ds = [int(y) for y in gv["dry_spell"]]
                        gy = list(g[a]["years"])
                        mod_rx = np.array([g[a]["rx"][gy.index(y), ci] for y in yrs_rx])
                        mod_ds = np.array([g[a]["dry"][gy.index(y), ci] for y in yrs_ds])
                        obs_rx = np.array(list(gv["rx1day"].values()))
                        obs_ds = np.array(list(gv["dry_spell"].values()))
                        mres["gauge_check"][sid] = {
                            "rx1day_median_ratio": float(np.median(mod_rx) / np.median(obs_rx)),
                            "rl25_ratio": float(ex.return_levels(mod_rx, [25])[0] / ex.return_levels(obs_rx, [25])[0]),
                            "dry_spell_median_diff": float(np.median(mod_ds) - np.median(obs_ds))}
            for s in SCENS:
                f = load("nex", cells, m, s, FUT)
                if f is None:
                    print("incomplete", m, s)
                    continue
                f = f[a]
                rl_f = ex.return_levels(f["rx"], TS)
                up = np.median(rl_f / rl_h, axis=1)  # (T,)
                d50 = float(np.median(np.median(f["dry"], axis=0) - np.median(h["dry"], axis=0)))
                d90 = float(np.median(np.percentile(f["dry"], 90, axis=0) - np.percentile(h["dry"], 90, axis=0)))
                tot = float(np.median(f["tot"].mean(axis=0) / h["tot"].mean(axis=0)))
                rxm = float(np.median(f["rx"].mean(axis=0) / h["rx"].mean(axis=0)))  # no curve fitting involved
                point[s].setdefault("rxm", []).append(rxm)
                mres[s] = {"uplift": {str(T): float(up[i]) for i, T in enumerate(TS)}, "rx1day_mean_ratio": rxm, "dry_spell_median_change": d50,
                           "dry_spell_p90_change": d90, "total_ratio": tot}
                point[s]["rl"].append(up); point[s]["dry50"].append(d50); point[s]["dry90"].append(d90); point[s]["tot"].append(tot)
                bh, bf = ex.boot_indices(len(BASE), NB, rng), ex.boot_indices(len(FUT), NB, rng)
                for b in range(NB):
                    pooled[s]["rl"].append(np.median(ex.return_levels(f["rx"][bf[b]], TS) / ex.return_levels(h["rx"][bh[b]], TS), axis=1))
                    pooled[s]["dry50"].append(np.median(np.median(f["dry"][bf[b]], axis=0) - np.median(h["dry"][bh[b]], axis=0)))
                    pooled[s]["dry90"].append(np.median(np.percentile(f["dry"][bf[b]], 90, axis=0) - np.percentile(h["dry"][bh[b]], 90, axis=0)))
                for i, T in enumerate(TS):
                    cells_out[a]["uplift"][s].setdefault(str(T), {})[m] = [round(float(v), 3) for v in (rl_f[i] / rl_h[i])]
                if a == "sokoto_rima":  # per-cell dry-spell change, days, for the dry-spell map
                    dc = cells_out[a].setdefault("dry_change", {s2: {"median": {}, "p90": {}} for s2 in SCENS})
                    dc[s]["median"][m] = [round(float(v), 1) for v in np.median(f["dry"], axis=0) - np.median(h["dry"], axis=0)]
                    dc[s]["p90"][m] = [round(float(v), 1) for v in np.percentile(f["dry"], 90, axis=0) - np.percentile(h["dry"], 90, axis=0)]
                rows.append([a, m, s] + [round(float(up[i]), 3) for i in range(len(TS))] + [round(d50, 1), round(d90, 1), round(tot, 3),
                            round(mres["historical"]["rl_bias_vs_chirps"]["25"], 3)])
            A["models"][m] = mres
            print(a, m, "done", flush=True)
        for s in SCENS:
            if not point[s]["rl"]:
                continue
            P, Q = np.array(point[s]["rl"]), np.array(pooled[s]["rl"])
            E = {"n_models": len(P), "uplift": {}, "design_rainfall": {}}
            for i, T in enumerate(TS):
                E["uplift"][str(T)] = {"models_median": float(np.median(P[:, i])), "models_p10": float(np.percentile(P[:, i], 10)),
                                       "models_p90": float(np.percentile(P[:, i], 90)), "models_above_1": int((P[:, i] > 1).sum()),
                                       "combined": summarise(Q[:, i])}
                base = A["chirps"]["return_levels"][str(T)]["median_cells"]
                E["design_rainfall"][str(T)] = {"baseline_mm": base, "future_mm_median": base * float(np.median(Q[:, i])),
                                                "future_mm_p05": base * float(np.percentile(Q[:, i], 5)),
                                                "future_mm_p95": base * float(np.percentile(Q[:, i], 95))}
            if a == "sokoto_rima":
                for k in ("dry50", "dry90"):
                    E[k] = {"models_median": float(np.median(point[s][k])), "models_p10": float(np.percentile(point[s][k], 10)),
                            "models_p90": float(np.percentile(point[s][k], 90)), "combined": summarise(pooled[s][k])}
            E["rx1day_mean_ratio"] = {"models_median": float(np.median(point[s]["rxm"])), "models_p10": float(np.percentile(point[s]["rxm"], 10)),
                                      "models_p90": float(np.percentile(point[s]["rxm"], 90))}
            E["total_ratio"] = {"models_median": float(np.median(point[s]["tot"])), "models_p10": float(np.percentile(point[s]["tot"], 10)),
                                "models_p90": float(np.percentile(point[s]["tot"], 90))}
            A["ensemble"][s] = E
        nul = [M["historical"]["null_ratio"] for M in A["models"].values() if "null_ratio" in M["historical"]]
        A["null_test"] = {str(T): {"median": float(np.median([n[str(T)] for n in nul])), "min": float(np.min([n[str(T)] for n in nul])),
                                   "max": float(np.max([n[str(T)] for n in nul])), "n_models": len(nul)} for T in TS}
        res["areas"][a] = A
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    json.dump(res, open(os.path.join(ROOT, "data", "results.json"), "w"), indent=1)
    json.dump(cells_out, open(os.path.join(ROOT, "data", "cells_results.json"), "w"), separators=(",", ":"))
    with open(os.path.join(ROOT, "data", "model_table.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["area", "model", "scenario"] + [f"uplift_{T}yr" for T in TS] + ["dry_spell_median_change_days", "dry_spell_p90_change_days", "annual_total_ratio", "hist_rl25_vs_chirps"])
        w.writerows(rows)


if __name__ == "__main__":
    main()
