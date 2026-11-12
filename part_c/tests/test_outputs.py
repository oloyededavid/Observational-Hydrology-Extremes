"""Checks on the committed Part C results and the website data built from them.
They test internal consistency, not whether the method suits these basins."""
import csv, json, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(ROOT)
R = json.load(open(os.path.join(ROOT, "data", "results.json")))
CELLS = json.load(open(os.path.join(ROOT, "data", "cells.json")))
CR = json.load(open(os.path.join(ROOT, "data", "cells_results.json")))
TS = [str(t) for t in R["settings"]["return_periods"]]


def test_every_model_complete():
    for a, A in R["areas"].items():
        assert set(A["models"]) == set(R["settings"]["models"]), a
        for s in ("ssp245", "ssp585"):
            assert A["ensemble"][s]["n_models"] == len(R["settings"]["models"])


def test_cell_counts_match_outlines():
    for a, A in R["areas"].items():
        assert A["n_cells"] == len(CELLS[a]) == len(CR[a]["cells"])
        for T in TS:
            assert len(CR[a]["chirps_rl"][T]) == len(CELLS[a])


def test_return_levels_increase_with_period():
    for A in R["areas"].values():
        rl = [A["chirps"]["return_levels"][T]["median_cells"] for T in TS]
        assert all(b > a for a, b in zip(rl, rl[1:]))
        for T in TS:
            q = A["chirps"]["return_levels"][T]
            assert q["p05"] <= q["median_cells"] * 1.05 and q["p95"] >= q["median_cells"] * 0.95


def test_intervals_contain_median():
    for A in R["areas"].values():
        for E in A["ensemble"].values():
            for T in TS:
                c = E["uplift"][T]["combined"]
                assert c["p05"] <= c["median"] <= c["p95"]
                assert 0 <= E["uplift"][T]["models_above_1"] <= E["n_models"]


def test_design_rainfall_is_baseline_times_uplift():
    for A in R["areas"].values():
        for E in A["ensemble"].values():
            for T in TS:
                d, u = E["design_rainfall"][T], E["uplift"][T]["combined"]
                assert np.isclose(d["baseline_mm"], A["chirps"]["return_levels"][T]["median_cells"])
                assert np.isclose(d["future_mm_median"], d["baseline_mm"] * u["median"])
                assert np.isclose(d["future_mm_p05"], d["baseline_mm"] * u["p05"])


def test_model_point_estimates_match_cells_file():
    # a model's area uplift is the median over cells of its per-cell ratios
    for a, A in R["areas"].items():
        for m, M in A["models"].items():
            for s in ("ssp245", "ssp585"):
                for T in TS:
                    cells = CR[a]["uplift"][s][T][m]
                    assert abs(np.median(cells) - M[s]["uplift"][T]) < 0.002, (a, m, s, T)


def test_model_table_matches_results():
    rows = list(csv.DictReader(open(os.path.join(ROOT, "data", "model_table.csv"))))
    assert len(rows) == 2 * 2 * len(R["settings"]["models"])
    for r in rows:
        M = R["areas"][r["area"]]["models"][r["model"]][r["scenario"]]
        assert abs(float(r["uplift_50yr"]) - M["uplift"]["50"]) < 0.001


def test_website_data_equals_results():
    site = json.load(open(os.path.join(REPO, "docs", "data", "site.json")))
    assert site["part_c"] == R
    assert site["part_b_rain"] == json.load(open(os.path.join(REPO, "part_b", "data", "rain_spi.json")))
    assert json.load(open(os.path.join(REPO, "docs", "data", "cells.json"))) == CR


def test_gauges_only_complete_seasons_1950_1980():
    g = json.load(open(os.path.join(ROOT, "data", "gauges.json")))
    assert set(g) == {"NG000001075", "NG000001080"}
    for v in g.values():
        assert all(1950 <= int(y) <= 1980 for y in v["rx1day"])
        assert len(v["rx1day"]) >= 20
