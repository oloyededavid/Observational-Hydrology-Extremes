"""Part B drought depth: multi-timescale SPI, drought events, and an independent soil-moisture and rainfall check.

1. Monthly CHIRPS v2.0 (0.25 degrees, from the files cut by part_c/scripts/c03_chirps.py), 1981-2024, for every
   cell of the Sokoto-Rima basin and for the basin (cos-latitude weighted mean).
2. SPI-3, SPI-6 and SPI-12 (McKee et al., 1993): for each calendar month, a gamma distribution is fitted to the
   k-month totals of the 1991-2020 reference years, with the share of zero totals q treated separately
   (H = q + (1 - q) G(x)); totals under 0.5 mm count as zero, because CHIRPS records traces in the dry season.
   Where q > 0.3, fewer than 10 reference values are non-zero, or the reference median total is under 10 mm,
   SPI is not defined (dry-season SPI-3 and SPI-6 in this semi-arid basin) and is left empty rather than forced
   onto trace amounts.
3. Drought events by run theory (Yevjevich, 1967): a run of consecutive months with SPI <= -1. Per cell: number
   of events, mean and longest duration, mean severity (sum of -SPI over the event) and mean intensity
   (severity / duration). Meteorological drought only: these measure rainfall deficits, not soil or river water.
4. Independent check with TerraClimate (Abatzoglou et al., 2018; Microsoft Planetary Computer), monthly, 1/24
   degree, 1981-2021, averaged to the same 0.25-degree cells. Its precipitation comes from different inputs
   (CRU TS and JRA-55 with WorldClim climatology), so it can test the CHIRPS drought years; its soil moisture
   is a water-balance model estimate, used as an indicator of agricultural drought, not as an observation.

Output: part_b/data/drought.json
"""
import json, os
import numpy as np
from scipy import stats

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CH = os.path.join(ROOT, "part_c", "cache", "chirps")
CACHE = os.path.join(ROOT, "part_b", "cache")
YEARS = list(range(1981, 2025))
REF = (1991, 2020)
SCALES = (3, 6, 12)


def monthly_chirps(cells):
    path = os.path.join(CACHE, "chirps_monthly.npy")
    if os.path.exists(path):
        return np.load(path)
    out = []
    for y in YEARS:
        d = np.load(os.path.join(CH, f"{y}.npz"))
        lat, lon, pr = d["sokoto_rima_lat"], d["sokoto_rima_lon"], d["sokoto_rima_pr"]
        idx = [(int(np.argmin(np.abs(lat - c[1]))), int(np.argmin(np.abs(lon - c[0])))) for c in cells]
        x = np.stack([pr[:, j, i] for j, i in idx], axis=1)
        leap = pr.shape[0] == 366
        lens = [31, 29 if leap else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        e = np.concatenate([[0], np.cumsum(lens)])
        out.append(np.stack([np.nansum(x[e[k]:e[k + 1]], axis=0) for k in range(12)]))
    arr = np.concatenate(out)  # (months, cells)
    os.makedirs(CACHE, exist_ok=True); np.save(path, arr)
    return arr


def spi(series, k):
    """SPI-k for a monthly series (months,) or (months, cells), gamma per calendar month with zero handling."""
    s = np.asarray(series, dtype=float)
    two = s.ndim == 2
    s = s if two else s[:, None]
    n = s.shape[0]
    acc = np.full_like(s, np.nan)
    for t in range(k - 1, n):
        acc[t] = s[t - k + 1:t + 1].sum(axis=0)
    out = np.full_like(s, np.nan)
    yrs = np.repeat(YEARS, 12)[:n]
    for mo in range(12):
        rows = np.arange(mo, n, 12)
        ref = rows[(yrs[rows] >= REF[0]) & (yrs[rows] <= REF[1])]
        for c in range(s.shape[1]):
            r = acc[ref, c]; r = r[np.isfinite(r)]
            nz = r[r >= 0.5]; q = 1 - len(nz) / max(len(r), 1)
            if q > 0.3 or len(nz) < 10 or (len(r) and np.median(r) < 10):
                continue
            a, _, sc = stats.gamma.fit(nz, floc=0)
            x = acc[rows, c]
            h = q + (1 - q) * np.where(x >= 0.5, stats.gamma.cdf(x, a, loc=0, scale=sc), 0.0)
            out[rows, c] = stats.norm.ppf(np.clip(h, 1e-6, 1 - 1e-6))
    return out if two else out[:, 0]


def runs(x, thr=-1.0):
    """Drought events (runs of x <= thr); NaN ends a run. Returns list of (start, duration, severity)."""
    ev, start = [], None
    for t, v in enumerate(list(x) + [np.nan]):
        if np.isfinite(v) and v <= thr:
            start = t if start is None else start
        elif start is not None:
            seg = np.asarray(x[start:t]); ev.append((start, t - start, float(-seg.sum()))); start = None
    return ev


def characteristics(series):
    ev = runs(series)
    if not ev:
        return {"events": 0, "mean_duration": 0.0, "max_duration": 0, "mean_severity": 0.0, "mean_intensity": 0.0}
    d = np.array([e[1] for e in ev]); s = np.array([e[2] for e in ev])
    return {"events": len(ev), "mean_duration": round(float(d.mean()), 2), "max_duration": int(d.max()),
            "mean_severity": round(float(s.mean()), 2), "mean_intensity": round(float((s / d).mean()), 2)}


def terraclimate(cells):
    path = os.path.join(CACHE, "terraclimate.npz")
    if os.path.exists(path):
        d = np.load(path); return {k: d[k] for k in d.files}
    import planetary_computer as pc, xarray as xr
    tok = pc.sas.get_token("cpdataeuwest", "cpdata").token
    ds = xr.open_zarr("az://cpdata/terraclimate.zarr", consolidated=True, storage_options={"account_name": "cpdataeuwest", "credential": tok})
    lons = [c[0] for c in cells]; lats = [c[1] for c in cells]
    sub = ds[["ppt", "soil", "aet"]].sel(time=slice("1981-01-01", "2021-12-31"),
                                         lat=slice(max(lats) + 0.125, min(lats) - 0.125), lon=slice(min(lons) - 0.125, max(lons) + 0.125)).load()
    res = {}
    for v in ("ppt", "soil", "aet"):
        arr = sub[v].values  # (time, lat, lon)
        la, lo = sub.lat.values, sub.lon.values
        res[v] = np.stack([np.nanmean(arr[:, (np.abs(la - c[1]) < 0.125)][:, :, (np.abs(lo - c[0]) < 0.125)].reshape(arr.shape[0], -1), axis=1)
                           for c in cells], axis=1)
    os.makedirs(CACHE, exist_ok=True); np.savez_compressed(path, **res)
    return res


def wmean(arr, w):
    return np.nansum(arr * w, axis=-1) / np.sum(w)


def pr(a, b):
    ok = np.isfinite(a) & np.isfinite(b)
    r, p = stats.pearsonr(a[ok], b[ok]); return {"r": round(float(r), 3), "p": float(p), "n": int(ok.sum())}


def main():
    cells = json.load(open(os.path.join(ROOT, "part_c", "data", "cells.json")))["sokoto_rima"]
    w = np.cos(np.radians([c[1] for c in cells]))
    m = monthly_chirps(cells)                      # (528, 245)
    basin = wmean(m, w)                            # (528,)
    out = {"years": [YEARS[0], YEARS[-1]], "reference": list(REF), "cells": cells}
    clim = m.reshape(len(YEARS), 12, -1)
    bclim = basin.reshape(len(YEARS), 12)
    out["climatology"] = {"mean": [round(float(v), 1) for v in bclim.mean(0)], "p10": [round(float(v), 1) for v in np.percentile(bclim, 10, 0)],
                          "p90": [round(float(v), 1) for v in np.percentile(bclim, 90, 0)],
                          "wet_season_share": round(float(bclim[:, 4:10].sum() / bclim.sum()), 3)}
    out["spi_basin"], out["events_basin"], out["cell_stats"] = {}, {}, {}
    for k in SCALES:
        sb = spi(basin, k); sc = spi(m, k)
        out["spi_basin"][str(k)] = [None if not np.isfinite(v) else round(float(v), 2) for v in sb]
        ev = runs(sb)
        out["events_basin"][str(k)] = [{"start": f"{YEARS[0] + s // 12}-{s % 12 + 1:02d}", "months": d, "severity": round(sev, 2)} for s, d, sev in ev]
        chars = [characteristics(sc[:, c]) for c in range(sc.shape[1])]
        out["cell_stats"][str(k)] = {key: [ch[key] for ch in chars] for key in chars[0]}
        out["cell_stats"][str(k)]["defined_share"] = [round(float(np.isfinite(sc[:, c]).mean()), 3) for c in range(sc.shape[1])]
        print(f"SPI-{k}: basin events {len(ev)}, longest {max([d for _, d, _ in ev] or [0])} months", flush=True)
    # SPI-12 at December per cell and year for the drought-year maps (equals the calendar-year SPI)
    s12 = spi(m, 12)
    out["spi12_dec_cells"] = [[None if not np.isfinite(v) else round(float(v), 2) for v in s12[i * 12 + 11]] for i in range(len(YEARS))]
    # growing-season rainfall (July-October)
    gs = clim[:, 6:10].sum(axis=1); out["growing_season_rain_basin"] = [round(float(v), 1) for v in wmean(gs, w)]
    # TerraClimate check, 1981-2021
    tc = terraclimate(cells)
    ny = 41
    tb = {v: wmean(tc[v], w) for v in tc}                         # basin monthly series
    ann = {v: tb[v].reshape(ny, 12) for v in tb}
    ch_ann = bclim[:ny].sum(1); tc_ann = ann["ppt"].sum(1)
    spi12_tc = spi(np.concatenate([tb["ppt"], np.full(36, np.nan)]), 12)[:ny * 12]  # pad to 2024 for indexing
    sm_gs = ann["soil"][:, 6:10].mean(1)                            # July-October mean soil moisture
    sm_z = (sm_gs - sm_gs[10:40].mean()) / sm_gs[10:40].std(ddof=1)  # standardised on 1991-2020
    spi12_ch = np.array([out["spi_basin"]["12"][i * 12 + 11] for i in range(ny)], dtype=float)
    spi12_tcd = spi12_tc[11::12]
    out["terraclimate"] = {
        "period": [1981, 2021],
        "annual_ppt_corr_with_chirps": pr(ch_ann, tc_ann),
        "annual_ppt_mean_mm": {"chirps": round(float(ch_ann.mean()), 1), "terraclimate": round(float(tc_ann.mean()), 1)},
        "spi12_dec_corr": pr(spi12_ch, spi12_tcd),
        "drought_years_chirps": [YEARS[i] for i in range(ny) if spi12_ch[i] <= -1],
        "drought_years_terraclimate": [YEARS[i] for i in range(ny) if spi12_tcd[i] <= -1],
        "soil_moisture_dry_years": [YEARS[i] for i in range(ny) if sm_z[i] <= -1],
        "growing_season_rain_vs_soil": pr(wmean(gs, w)[:ny], sm_gs),
        "soil_z": [round(float(v), 2) for v in sm_z],
        "spi12_terraclimate_dec": [None if not np.isfinite(v) else round(float(v), 2) for v in spi12_tcd],
    }
    ndvi = json.load(open(os.path.join(ROOT, "part_b", "data", "ndvi.json")))
    yrs_n = [y for y in range(2001, 2022)]
    v = np.array([ndvi["ndvi_growing_season"][str(y)] for y in yrs_n]); smv = sm_gs[[y - 1981 for y in yrs_n]]
    gsr = wmean(gs, w)[[y - 1981 for y in yrs_n]]
    from scipy.signal import detrend
    out["ndvi_links_2001_2021"] = {"soil_raw": pr(smv, v), "soil_detrended": pr(detrend(smv), detrend(v)),
                                   "growing_season_rain_raw": pr(gsr, v), "growing_season_rain_detrended": pr(detrend(gsr), detrend(v))}
    json.dump(out, open(os.path.join(ROOT, "part_b", "data", "drought.json"), "w"), separators=(",", ":"))
    print(json.dumps({k: out["terraclimate"][k] for k in ("annual_ppt_corr_with_chirps", "annual_ppt_mean_mm", "spi12_dec_corr", "drought_years_chirps", "drought_years_terraclimate", "soil_moisture_dry_years", "growing_season_rain_vs_soil")}, indent=1))
    print(json.dumps(out["ndvi_links_2001_2021"], indent=1))


if __name__ == "__main__":
    main()
