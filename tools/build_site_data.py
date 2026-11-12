"""Collect the computed results into docs/data/ for the website. Every number on the site comes from here.

Inputs (all written by the analysis scripts; nothing is typed in):
  Part A  part_a/data/{results,robustness,dualpol,change}.json and the PNG overlays
  Part B  part_b/data/{rain_spi,rain_spi_cells,ndvi,drought,ndvi_cells}.json
  Part C  part_c/data/{results,cells_results,gauges,reliability}.json, domains.geojson, model_table.csv
Outputs: docs/data/site.json (summary for the study page), a.json, b.json, c.json, cells.json (Part C per
cell), b_cells.json (Part B per cell), domains.geojson, part_a/*.png and the CSV downloads.
Run: python tools/build_site_data.py
"""
import json, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs", "data")


def load(*p):
    path = os.path.join(ROOT, *p)
    return json.load(open(path)) if os.path.exists(path) else None


def dump(obj, name):
    json.dump(obj, open(os.path.join(DOCS, name), "w"), separators=(",", ":"))


def main():
    os.makedirs(os.path.join(DOCS, "part_a"), exist_ok=True)
    rob = load("part_a", "data", "robustness.json")
    a = {"vh": load("part_a", "data", "results.json"), "robustness": {k: v for k, v in rob.items()},
         "dualpol": load("part_a", "data", "dualpol.json"), "change": load("part_a", "data", "change.json")}
    b = {"rain": load("part_b", "data", "rain_spi.json"), "ndvi": load("part_b", "data", "ndvi.json")}
    dr = load("part_b", "data", "drought.json")
    b["drought"] = {k: v for k, v in dr.items() if k not in ("cells", "cell_stats", "spi12_dec_cells")}
    c = {"results": load("part_c", "data", "results.json"), "reliability": load("part_c", "data", "reliability.json"),
         "gauges": load("part_c", "data", "gauges.json")}
    spc, nc = load("part_b", "data", "rain_spi_cells.json"), load("part_b", "data", "ndvi_cells.json")
    assert spc["cells"] == dr["cells"] == nc["cells"], "Part B cell lists differ"
    b_cells = {"cells": spc["cells"], "years": spc["years"], "spi12": dr["spi12_dec_cells"], "rain_mm": spc["rain_mm"],
               "mean_mm": spc["mean_mm"], "cv_pct": spc["cv_pct"], "events": dr["cell_stats"],
               "ndvi_years": nc["years"], "ndvi_anomaly": nc["anomaly"], "ndvi_mean": nc["mean_ndvi"],
               "ndvi_r_detrended": nc["r_detrended"], "ndvi_p_detrended": nc["p_detrended"]}
    dump(a, "a.json"); dump(b, "b.json"); dump(c, "c.json"); dump(b_cells, "b_cells.json")
    dump(load("part_c", "data", "cells_results.json"), "cells.json")
    # the study page's own summary file (kept for links and the existing tests)
    dump({"part_a": a["vh"], "part_b_rain": b["rain"], "part_b_ndvi": b["ndvi"], "part_c": c["results"], "gauges": c["gauges"]}, "site.json")
    shutil.copy(os.path.join(ROOT, "part_c", "data", "domains.geojson"), os.path.join(DOCS, "domains.geojson"))
    for f in ("frequency.png", "floodplain.png", "water_2022-02.png", "water_2022-10.png", "dual_frequency.png",
              "dual_water_2022-02.png", "dual_water_2022-10.png", "flood_extension_2022-10.png", "coverage.png", "flood_monthly.csv"):
        src = os.path.join(ROOT, "part_a", "data", f)
        if os.path.exists(src):
            shutil.copy(src, os.path.join(DOCS, "part_a", f))
    shutil.copy(os.path.join(ROOT, "part_c", "data", "model_table.csv"), os.path.join(DOCS, "model_table.csv"))
    for old in ("spi_cells.json",):  # superseded by b_cells.json
        p = os.path.join(DOCS, old)
        if os.path.exists(p):
            os.remove(p)
    print("site data:", {f: os.path.getsize(os.path.join(DOCS, f)) // 1024 for f in sorted(os.listdir(DOCS)) if f.endswith(".json")}, "KB")


if __name__ == "__main__":
    main()
