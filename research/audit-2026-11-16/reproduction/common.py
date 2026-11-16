"""Shared helpers for the reproduction (own code). Reads cache/chirps/<year>.npz written by r01_chirps_download.py."""
import json, os, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = "/home/user/observational-hydrology-extremes"
def cells(area): return json.load(open(f"{REPO}/part_c/data/cells.json"))[area]
def load_year(y, area):
    """Return daily array (days, ncells) at the repo's cell centres, picked by exact coordinate match."""
    d = np.load(f"{HERE}/cache/chirps/{y}.npz")
    lat, lon, pr = d["lat"], d["lon"], d["pr"]
    out = []
    for lo, la in cells(area):
        j = np.where(np.abs(lat - la) < 1e-3)[0]; i = np.where(np.abs(lon - lo) < 1e-3)[0]
        assert len(j) == 1 and len(i) == 1, (lo, la)
        out.append(pr[:, j[0], i[0]])
    return np.stack(out, axis=1)
def wts(area): return np.cos(np.radians([c[1] for c in cells(area)]))
def month_edges(ndays):
    lens = [31, 29 if ndays == 366 else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    return np.concatenate([[0], np.cumsum(lens)])
def cmp(pub, new):
    d = new - pub
    return {"published": pub, "recomputed": new, "abs_diff": d, "rel_diff": (d / pub if pub else None)}
