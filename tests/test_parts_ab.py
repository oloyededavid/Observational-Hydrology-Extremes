"""Consistency checks on the recomputed Part A and Part B outputs and the website data built from them."""
import csv, json, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = json.load(open(os.path.join(ROOT, "part_a", "data", "results.json")))
B = json.load(open(os.path.join(ROOT, "part_b", "data", "ndvi.json")))
SITE = json.load(open(os.path.join(ROOT, "docs", "data", "site.json")))


def test_part_a_every_month_2018_2023():
    months = {(r["year"], r["month"]) for r in A["monthly"]}
    assert months == {(y, m) for y in range(2018, 2024) for m in range(1, 13)}
    assert all(r["n_images"] > 0 and r["coverage"] >= 0.9 for r in A["monthly"])


def test_part_a_areas_add_up():
    for r in A["monthly"]:
        # flood = water outside permanent water = inside floodplain + outside it
        assert abs(r["flood_km2"] - (r["flood_floodplain_km2"] + r["dark_outside_floodplain_km2"])) < 1.0
        assert r["flood_floodplain_km2"] <= A["floodplain_km2"] + 0.5
        assert r["water_km2"] >= r["flood_km2"]


def test_part_a_csv_matches_json():
    rows = list(csv.DictReader(open(os.path.join(ROOT, "part_a", "data", "flood_monthly.csv"))))
    assert len(rows) == 72 and float(rows[9]["flood_floodplain_km2"]) == A["monthly"][9]["flood_floodplain_km2"]


def test_part_a_agreement_fractions():
    for k in ("dry_season_vs_occurrence50", "wet_season_ever_vs_max_extent"):
        j = A["jrc"][k]
        assert abs(j["recall"] - j["both_km2"] / j["jrc_km2"]) < 1e-3 and abs(j["precision"] - j["both_km2"] / j["s1_km2"]) < 1e-3


def test_part_b_ndvi_series():
    v = B["ndvi_growing_season"]
    assert sorted(map(int, v)) == list(range(2001, 2025))
    assert all(0.1 < x < 0.7 for x in v.values())
    assert B["raw"]["n"] == 24 and B["differenced"]["n"] == 23


def test_part_b_correlations_recompute():
    from scipy import stats
    from scipy.signal import detrend
    rain = {r["year"]: r["rain_mm"] for r in json.load(open(os.path.join(ROOT, "part_b", "data", "rain_spi.json")))["years"]}
    yrs = sorted(map(int, B["ndvi_growing_season"]))
    x = np.array([rain[y] for y in yrs]); y = np.array([B["ndvi_growing_season"][str(k)] for k in yrs])
    assert abs(stats.pearsonr(x, y)[0] - B["raw"]["pearson_r"]) < 0.002
    assert abs(stats.pearsonr(detrend(x), detrend(y))[0] - B["detrended"]["pearson_r"]) < 0.002


def test_site_carries_parts_a_b():
    assert SITE["part_a"] == A and SITE["part_b_ndvi"] == B
    for f in ("frequency.png", "floodplain.png", "water_2022-02.png", "water_2022-10.png"):
        assert os.path.exists(os.path.join(ROOT, "docs", "data", "part_a", f))
