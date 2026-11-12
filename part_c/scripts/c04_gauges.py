"""Daily rain-gauge records inside the study areas, from NOAA GHCN-Daily (Menne et al., 2012).

A search of GHCN-Daily found no station inside the Part A reach and two inside the Sokoto-Rima basin,
both in Niger: Birni N'Konni and Maradi. Their records are complete from the 1940s to 1980 and almost
empty afterwards, so they overlap the climate models' historical run (1950-2014) but not CHIRPS
(1981 onwards). They are used only to check the models, 1950-1980.

A season counts when it has no missing or flagged day (GHCN quality flag blank):
- annual maximum daily rainfall: the May-October rainy season;
- longest dry spell: June-September, the core of the monsoon.

Output: part_c/data/gauges.json
"""
import csv, io, json, os, sys, urllib.request
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import extremes as ex  # noqa: E402

URL = "https://noaa-ghcn-pds.s3.amazonaws.com/csv/by_station/{}.csv"
STATIONS = {"NG000001075": ("Birni N'Konni", 13.80, 5.25), "NG000001080": ("Maradi", 13.47, 7.08)}
YEARS = range(1950, 1981)


def series(sid):
    path = os.path.join(ROOT, "cache", "ghcn", sid + ".csv")
    if not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        urllib.request.urlretrieve(URL.format(sid), path)
    vals = {}
    for row in csv.reader(open(path)):
        if row[2] == "PRCP" and row[5] == "":  # blank quality flag only
            vals[row[1]] = int(row[3]) / 10.0  # tenths of mm
    return vals


def season(vals, y, m0, m1):
    import datetime as dt
    d, out = dt.date(y, m0, 1), []
    while d.month <= m1 and d.year == y:
        out.append(vals.get(d.strftime("%Y%m%d"), np.nan))
        d += dt.timedelta(days=1)
    return np.array(out)


def main():
    res = {}
    for sid, (name, lat, lon) in STATIONS.items():
        v = series(sid)
        rx, ds = {}, {}
        for y in YEARS:
            s = season(v, y, 5, 10)
            if not np.isnan(s).any():
                rx[y] = float(s.max())
            c = season(v, y, 6, 9)
            if not np.isnan(c).any():
                ds[y] = int(ex.longest_dry_spell(c))
        res[sid] = {"name": name, "lat": lat, "lon": lon, "rx1day": rx, "dry_spell": ds}
        print(name, len(rx), "complete rainy seasons,", len(ds), "complete core seasons")
    with open(os.path.join(ROOT, "data", "gauges.json"), "w") as f:
        json.dump(res, f, indent=1)


if __name__ == "__main__":
    main()
