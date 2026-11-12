"""Collect the computed results into docs/data/ for the website. Every number on the site comes from here.

Inputs: part_b/data/rain_spi.json, part_c/data/{results,cells_results,gauges,cells}.json,
part_c/data/domains.geojson, and part_a/outputs/ and part_b/outputs/ once the v2 notebooks have been run.
Run: python tools/build_site_data.py
"""
import json, os, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs", "data")


def load(*p):
    path = os.path.join(ROOT, *p)
    return json.load(open(path)) if os.path.exists(path) else None


def main():
    os.makedirs(DOCS, exist_ok=True)
    site = {
        "part_b_rain": load("part_b", "data", "rain_spi.json"),
        "part_b_v2": load("part_b", "outputs", "part_b_results.json"),
        "part_a_v2": load("part_a", "outputs", "part_a_results.json"),
        "part_c": load("part_c", "data", "results.json"),
        "gauges": load("part_c", "data", "gauges.json"),
    }
    json.dump(site, open(os.path.join(DOCS, "site.json"), "w"), separators=(",", ":"))
    shutil.copy(os.path.join(ROOT, "part_c", "data", "domains.geojson"), os.path.join(DOCS, "domains.geojson"))
    cells = load("part_c", "data", "cells_results.json")
    if cells:
        json.dump(cells, open(os.path.join(DOCS, "cells.json"), "w"), separators=(",", ":"))
    spc = load("part_b", "data", "rain_spi_cells.json")
    if spc:
        json.dump(spc, open(os.path.join(DOCS, "spi_cells.json"), "w"), separators=(",", ":"))
    for f in ("model_table.csv",):
        src = os.path.join(ROOT, "part_c", "data", f)
        if os.path.exists(src):
            shutil.copy(src, os.path.join(DOCS, f))
    print("site data written:", sorted(os.listdir(DOCS)))


if __name__ == "__main__":
    main()
