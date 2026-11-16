"""Reproduction step 1a: download CHIRPS v2.0 daily p25 (0.25 deg) yearly NetCDF 1981-2024 and cut the window
lon 3.5-9.75, lat 5.5-16.5 (covers both study areas). Source: data.chc.ucsb.edu. Own code (requests + h5py).
Output: cache/chirps/<year>.npz (pr mm/day, lat ascending, lon; -9999 -> NaN). Raw files deleted after cutting."""
import os, sys, time, requests, h5py, numpy as np
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__))
URL = "https://data.chc.ucsb.edu/products/CHIRPS/v2.0/global_daily/netcdf/p25/chirps-v2.0.{}.days_p25.nc"
def get(y):
    out = f"{HERE}/cache/chirps/{y}.npz"
    if os.path.exists(out): return f"{y} skip"
    tmp = f"{HERE}/cache/dl/{y}.nc"
    for a in range(6):
        try:
            with requests.get(URL.format(y), stream=True, timeout=600) as r:
                r.raise_for_status()
                with open(tmp, "wb") as f:
                    for b in r.iter_content(1 << 22): f.write(b)
            with h5py.File(tmp, "r") as h:
                lat, lon = h["latitude"][:], h["longitude"][:]
                j = np.where((lat >= 5.5) & (lat <= 16.5))[0]; i = np.where((lon >= 3.5) & (lon <= 9.75))[0]
                a_ = h["precip"][:, j.min():j.max()+1, i.min():i.max()+1].astype("float32")
                la = lat[j.min():j.max()+1]; lo = lon[i.min():i.max()+1]
            if la[0] > la[-1]: a_, la = a_[:, ::-1, :], la[::-1]
            a_[a_ < 0] = np.nan
            np.savez_compressed(out, pr=a_, lat=la, lon=lo)
            os.remove(tmp); return f"{y} ok {a_.shape}"
        except Exception as e:
            err = e; time.sleep(10 * 2 ** a)
    return f"{y} FAIL {err}"
if __name__ == "__main__":
    with ThreadPoolExecutor(3) as ex:
        for s in ex.map(get, range(1981, 2025)): print(s, flush=True)
