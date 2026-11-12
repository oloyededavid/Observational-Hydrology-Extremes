"""Cut daily precipitation for the two study areas out of NASA NEX-GDDP-CMIP6.

NEX-GDDP-CMIP6 is downscaled and bias-corrected daily output of CMIP6 models at 0.25 degrees
(Thrasher et al., 2022). The files on the public AWS bucket hold one year each and are chunked one
global day per block, so a region cannot be read without downloading the whole file (170-200 MB).
This script downloads each file, keeps the two study-area boxes, and deletes the file.

Model choice: one model per CMIP6 institution, preferring the physical model over the Earth-system
variant where an institution has both, so that no centre is counted twice in the spread.

Output: part_c/cache/nexgddp/<model>_<scenario>_<year>.npz with pr in mm/day for each box.
Resumable: files already cut are skipped. Run: python part_c/scripts/c02_nexgddp.py [workers]
"""
import os, re, sys, time, tempfile, urllib.request, urllib.parse
from concurrent.futures import ProcessPoolExecutor, as_completed
import numpy as np
import h5py

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from domains import BOXES  # noqa: E402

BUCKET = "https://nex-gddp-cmip6.s3.us-west-2.amazonaws.com/"
OUT = os.path.join(ROOT, "cache", "nexgddp")
MODELS = {  # model: ensemble member available on the bucket
    "ACCESS-CM2": "r1i1p1f1", "ACCESS-ESM1-5": "r1i1p1f1", "BCC-CSM2-MR": "r1i1p1f1", "CESM2": "r4i1p1f1",
    "CMCC-CM2-SR5": "r1i1p1f1", "CNRM-CM6-1": "r1i1p1f2", "CanESM5": "r1i1p1f1", "EC-Earth3": "r1i1p1f1",
    "FGOALS-g3": "r3i1p1f1", "GFDL-CM4": "r1i1p1f1", "GISS-E2-1-G": "r1i1p1f2", "HadGEM3-GC31-LL": "r1i1p1f3",
    "IITM-ESM": "r1i1p1f1", "INM-CM5-0": "r1i1p1f1", "IPSL-CM6A-LR": "r1i1p1f1", "KACE-1-0-G": "r1i1p1f1",
    "KIOST-ESM": "r1i1p1f1", "MIROC6": "r1i1p1f1", "MPI-ESM1-2-HR": "r1i1p1f1", "MRI-ESM2-0": "r1i1p1f1",
    "NESM3": "r1i1p1f1", "NorESM2-MM": "r1i1p1f1", "TaiESM1": "r1i1p1f1",
}
PERIODS = {"historical": list(range(1950, 1981)) + list(range(1985, 2015)),
           "ssp245": list(range(2041, 2071)), "ssp585": list(range(2041, 2071))}


def listing(prefix):
    keys, tok = [], None
    while True:
        q = {"list-type": "2", "prefix": prefix}
        if tok:
            q["continuation-token"] = tok
        t = urllib.request.urlopen(BUCKET + "?" + urllib.parse.urlencode(q), timeout=120).read().decode()
        keys += re.findall(r"<Key>([^<]+)</Key>", t)
        m = re.search(r"<NextContinuationToken>([^<]+)", t)
        if not m:
            return keys
        tok = m.group(1)


def latest_files(model, scen, member):
    """Map year -> key of the newest version (v2.0 > v1.1 > unversioned)."""
    rank = {"": 0, "_v1.1": 1, "_v2.0": 2}
    best = {}
    for k in listing(f"NEX-GDDP-CMIP6/{model}/{scen}/{member}/pr/"):
        m = re.search(r"_(\d{4})(_v\d\.\d)?\.nc$", k)
        if not m:
            continue
        y, v = int(m.group(1)), m.group(2) or ""
        if y not in best or rank[v] > rank[best[y][1]]:
            best[y] = (k, v)
    return {y: kv[0] for y, kv in best.items()}


def cut(model, scen, year, key):
    out = os.path.join(OUT, f"{model}_{scen}_{year}.npz")
    if os.path.exists(out):
        return "skip"
    for attempt in range(4):
        try:
            with tempfile.NamedTemporaryFile(suffix=".nc", dir=OUT) as tmp:
                with urllib.request.urlopen(BUCKET + key, timeout=600) as r:
                    while True:
                        b = r.read(1 << 22)
                        if not b:
                            break
                        tmp.write(b)
                tmp.flush()
                with h5py.File(tmp.name, "r") as h:
                    lat, lon, pr = h["lat"][:], h["lon"][:], h["pr"]
                    res = {"version": os.path.basename(key)}
                    for name, (x0, x1, y0, y1) in BOXES.items():
                        j = np.where((lat >= y0) & (lat <= y1))[0]
                        i = np.where((lon >= x0) & (lon <= x1))[0]
                        res[f"{name}_pr"] = (pr[:, j[0]:j[-1] + 1, i[0]:i[-1] + 1] * 86400.0).astype(np.float32)
                        res[f"{name}_lat"], res[f"{name}_lon"] = lat[j], lon[i]
            np.savez_compressed(out + ".part.npz", **res)
            os.replace(out + ".part.npz", out)
            return "ok"
        except Exception as e:  # network hiccups: retry with backoff
            err = e
            time.sleep(5 * 2 ** attempt)
    return f"FAIL {err}"


def main(workers=6):
    os.makedirs(OUT, exist_ok=True)
    jobs = []
    for model, member in MODELS.items():
        for scen, years in PERIODS.items():
            files = latest_files(model, scen, member)
            for y in years:
                if y in files:
                    jobs.append((model, scen, y, files[y]))
                else:
                    print(f"missing {model} {scen} {y}", flush=True)
    print(f"{len(jobs)} files to cut", flush=True)
    done = 0
    # processes, not threads: h5py serialises HDF5 calls, so decompression needs separate processes
    with ProcessPoolExecutor(workers) as ex:
        futs = {ex.submit(cut, *j): j for j in jobs}
        for f in as_completed(futs):
            done += 1
            s = f.result()
            if s != "skip" or done % 200 == 0:
                print(f"{done}/{len(jobs)} {futs[f][:3]} {s}", flush=True)


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 10)
