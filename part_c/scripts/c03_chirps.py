"""Cut CHIRPS v2.0 daily rainfall (0.25-degree product, p25) for the two study areas, 1981-2024.

CHIRPS (Funk et al., 2015) is the rainfall used in Part B. The 0.25-degree daily files published by
the Climate Hazards Center are used here because they share the NEX-GDDP-CMIP6 grid, so observed and
modelled extremes are compared cell by cell at the same resolution.

Output: part_c/cache/chirps/<year>.npz with pr in mm/day for each box. Resumable.
"""
import os, sys, time, tempfile, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import h5py

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from domains import BOXES  # noqa: E402

URL = "https://data.chc.ucsb.edu/products/CHIRPS/v2.0/global_daily/netcdf/p25/chirps-v2.0.{}.days_p25.nc"
OUT = os.path.join(ROOT, "cache", "chirps")
YEARS = range(1981, 2025)


def cut(year):
    out = os.path.join(OUT, f"{year}.npz")
    if os.path.exists(out):
        return f"{year} skip"
    err = None
    for attempt in range(6):
        try:
            with tempfile.NamedTemporaryFile(suffix=".nc", dir=OUT) as tmp:
                req = urllib.request.Request(URL.format(year), headers={"User-Agent": "research-download"})
                with urllib.request.urlopen(req, timeout=900) as r:
                    while True:
                        b = r.read(1 << 22)
                        if not b:
                            break
                        tmp.write(b)
                tmp.flush()
                with h5py.File(tmp.name, "r") as h:
                    lat, lon, pr = h["latitude"][:], h["longitude"][:], h["precip"]
                    res = {}
                    for name, (x0, x1, y0, y1) in BOXES.items():
                        j = np.where((lat >= y0) & (lat <= y1))[0]
                        i = np.where((lon >= x0) & (lon <= x1))[0]
                        a = pr[:, j.min():j.max() + 1, i[0]:i[-1] + 1].astype(np.float32)
                        la = lat[j.min():j.max() + 1]
                        if la[0] > la[-1]:  # store south to north, like NEX-GDDP
                            a, la = a[:, ::-1, :], la[::-1]
                        a[a < 0] = np.nan  # fill value -9999
                        res[f"{name}_pr"], res[f"{name}_lat"], res[f"{name}_lon"] = a, la, lon[i]
            np.savez_compressed(out + ".part.npz", **res)
            os.replace(out + ".part.npz", out)
            return f"{year} ok"
        except Exception as e:  # the server rate-limits (HTTP 429): back off and retry
            err = e
            time.sleep(15 * 2 ** attempt)
    return f"{year} FAIL {err}"


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    with ThreadPoolExecutor(2) as ex:
        for s in ex.map(cut, YEARS):
            print(s, flush=True)
