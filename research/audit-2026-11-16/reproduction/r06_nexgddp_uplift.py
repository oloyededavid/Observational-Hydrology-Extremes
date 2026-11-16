"""Reproduction step 6: design-rainfall uplift for two climate models, own code.

NEX-GDDP-CMIP6 daily pr (kg m-2 s-1 -> mm/day), read with HTTP range requests (fsspec + h5py) from the public bucket
nex-gddp-cmip6.s3.us-west-2.amazonaws.com, window lon 3.5-9.75 E, lat 5.5-16.5 N, newest file version per year.
Models: MRI-ESM2-0 and INM-CM5-0 (r1i1p1f1), historical 1985-2014 and SSP5-8.5 2041-2070.
Uplift as defined in part_c/scripts/c05_analysis.py: per cell, GEV (L-moments, own code from r05) return level of
the future annual maxima divided by that of the historical annual maxima; median over the study area's cells.
Output: cache/nex/<model>_<scen>_<year>.npz and out/uplift_compare.json. Resumable.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

import fsspec
import h5py
import numpy as np

from common import HERE, REPO, cells
from r05_gev_chirps import TS, gev_lmom, q_gev  # own L-moment GEV (r05)

BUCKET = "https://nex-gddp-cmip6.s3.us-west-2.amazonaws.com/"
MODELS = {"MRI-ESM2-0": "r1i1p1f1", "INM-CM5-0": "r1i1p1f1"}
PERIODS = {"historical": range(1985, 2015), "ssp585": range(2041, 2071)}
OUT = os.path.join(HERE, "cache", "nex")
os.makedirs(OUT, exist_ok=True)


def keys(model, scen, member):
    rank = {"": 0, "_v1.1": 1, "_v2.0": 2}
    best, tok = {}, None
    while True:
        q = {"list-type": "2", "prefix": f"NEX-GDDP-CMIP6/{model}/{scen}/{member}/pr/"}
        if tok:
            q["continuation-token"] = tok
        t = urllib.request.urlopen(BUCKET + "?" + urllib.parse.urlencode(q), timeout=120).read().decode()
        for k in re.findall(r"<Key>([^<]+)</Key>", t):
            m = re.search(r"_(\d{4})(_v\d\.\d)?\.nc$", k)
            if m:
                y, v = int(m.group(1)), m.group(2) or ""
                if y not in best or rank[v] > rank[best[y][1]]:
                    best[y] = (k, v)
        m = re.search(r"<NextContinuationToken>([^<]+)", t)
        if not m:
            return {y: kv[0] for y, kv in best.items()}
        tok = m.group(1)


def fetch(model, scen, year, key):
    f = os.path.join(OUT, f"{model}_{scen}_{year}.npz")
    if os.path.exists(f):
        return
    fs = fsspec.filesystem("http", block_size=2 ** 20)
    for attempt in range(5):
        try:
            with fs.open(BUCKET + key, "rb", cache_type="readahead") as fh, h5py.File(fh, "r") as h:
                lat, lon = h["lat"][:], h["lon"][:]
                j = np.where((lat >= 5.5) & (lat <= 16.5))[0]
                i = np.where((lon >= 3.5) & (lon <= 9.75))[0]
                pr = h["pr"][:, j.min():j.max() + 1, i.min():i.max() + 1].astype("float32")
                pr = np.where(pr > 1e19, np.nan, pr) * 86400.0  # _FillValue 1e20 to NaN, then kg m-2 s-1 to mm/day
            np.savez_compressed(f, pr=pr, lat=lat[j.min():j.max() + 1], lon=lon[i.min():i.max() + 1])
            return
        except Exception as e:
            print(f"  retry {model} {scen} {year}: {str(e)[:100]}", flush=True)
            time.sleep(10 * (attempt + 1))
    sys.exit(f"failed {model} {scen} {year}")


def annual_max(model, scen, area):
    cl = cells(area)
    rx = []
    for y in PERIODS[scen]:
        d = np.load(os.path.join(OUT, f"{model}_{scen}_{y}.npz"))
        lat, lon, pr = d["lat"], d["lon"], d["pr"]
        col = []
        for lo, la in cl:
            jj = np.where(np.abs(lat - la) < 1e-3)[0]
            ii = np.where(np.abs(lon - lo) < 1e-3)[0]
            assert len(jj) == 1 and len(ii) == 1, (lo, la)
            col.append(np.nanmax(pr[:, jj[0], ii[0]]))
        rx.append(col)
    return np.array(rx)


def main():
    for m, mem in MODELS.items():
        for s, yrs in PERIODS.items():
            ks = keys(m, s, mem)
            for y in yrs:
                fetch(m, s, y, ks[y])
            print(f"{m} {s} downloaded", flush=True)
    pub = json.load(open(f"{REPO}/part_c/data/results.json"))
    res = {}
    for area in ("niger_benue", "sokoto_rima"):
        res[area] = {}
        for m in MODELS:
            h, f = annual_max(m, "historical", area), annual_max(m, "ssp585", area)
            up = []
            for c in range(h.shape[1]):
                up.append(q_gev(gev_lmom(f[:, c]), TS) / q_gev(gev_lmom(h[:, c]), TS))
            up = np.median(np.array(up), axis=0)
            P = pub["areas"][area]["models"][m]["ssp585"]["uplift"]
            res[area][m] = {str(T): {"published": round(P[str(T)], 4), "recomputed": round(float(u), 4),
                                     "rel_diff": round(float(u / P[str(T)] - 1), 4)} for T, u in zip(TS, up)}
            res[area][m]["rx1day_mean_ratio"] = {"published": round(pub["areas"][area]["models"][m]["ssp585"]["rx1day_mean_ratio"], 4),
                                                 "recomputed": round(float(np.median(f.mean(0) / h.mean(0))), 4)}
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    json.dump(res, open(os.path.join(HERE, "out", "uplift_compare.json"), "w"), indent=1)
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
