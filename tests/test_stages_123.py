"""Consistency checks on the audit-stage outputs: Part A robustness and dual polarisation, Part B drought and
NDVI cells, Part C reliability. They test that the outputs are complete and internally consistent."""
import json, os
import numpy as np
import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda *p: json.load(open(os.path.join(ROOT, *p)))


def test_robustness_threshold_monotonic():
    R = J("part_a", "data", "robustness.json")
    assert len(R["monthly"]) == 72
    for row in R["monthly"]:
        # a lower (more negative) threshold can only shrink the water area
        assert all(a >= b - 0.1 for a, b in zip(row["inside"], row["inside"][1:]))
        assert all(a >= b - 0.1 for a, b in zip(row["outside"], row["outside"][1:]))
        assert -25 < row["otsu_db"] < -10


def test_sentinel2_check_fractions():
    R = J("part_a", "data", "robustness.json")
    for c in R["sentinel2_check"].values():
        for k in ("minus18", "otsu"):
            d = c[k]
            assert 0 <= d["s1_confirmed_by_s2"] <= 1 and 0 <= d["s2_found_by_s1"] <= 1
            assert abs(d["s1_confirmed_by_s2"] - d["both_km2"] / d["s1_km2"]) < 2e-3


@pytest.mark.skipif(not os.path.exists(os.path.join(ROOT, "part_a", "data", "dualpol.json")), reason="dual-pol not run")
def test_dualpol_is_subset_of_vh():
    D = J("part_a", "data", "dualpol.json")
    assert len(D["monthly"]) == 72
    for r in D["monthly"]:
        assert r["dual_km2"] <= r["vh_only_km2"] + 0.5
        assert abs(r["dual_km2"] - r["dual_inside_km2"] - r["dual_outside_km2"]) < 1.0


def test_drought_spi_and_events():
    D = J("part_b", "data", "drought.json")
    n = (D["years"][1] - D["years"][0] + 1) * 12
    for k in ("3", "6", "12"):
        s = D["spi_basin"][k]
        assert len(s) == n
        v = np.array([x for x in s if x is not None])
        assert abs(v.mean()) < 0.5 and 0.6 < v.std() < 1.6
        for e in D["events_basin"][k]:
            assert e["months"] >= 1 and e["severity"] >= e["months"] * 1.0 - 1e-6  # every month <= -1
    # SPI-3 is undefined in the dry season (January-April end months)
    s3 = D["spi_basin"]["3"]
    assert all(s3[i] is None for i in range(len(s3)) if i % 12 in (0, 1, 2, 3))


def test_terraclimate_check_period():
    T = J("part_b", "data", "drought.json")["terraclimate"]
    assert T["period"] == [1981, 2021] and T["annual_ppt_corr_with_chirps"]["n"] == 41
    assert len(T["soil_z"]) == 41


def test_ndvi_cells_shape():
    N = J("part_b", "data", "ndvi_cells.json")
    assert len(N["anomaly"]) == len(N["years"]) == 24 and len(N["cells"]) == 245
    assert all(len(r) == 245 for r in N["anomaly"])


def test_reliability_complete():
    R = J("part_c", "data", "reliability.json")
    for a, A in R["areas"].items():
        assert len(A["performance"]) == 23
        for T, d in A["decomposition"].items():
            s = sum(d[k] for k in ("sampling", "model", "scenario", "distribution"))
            assert abs(s - 1) < 0.01
        assert set(A["baseline"]) == {"1981-2010", "1985-2014", "1995-2024"}
        c = A["rl_curve_chirps"]
        assert all(lo <= m <= hi for lo, m, hi in zip(c["p05"], c["median"], c["p95"]))


def test_change_detection_outputs():
    C = J("part_a", "data", "change.json")
    assert len(C["monthly"]) == 72
    assert all(r["extension_km2"] >= 0 for r in C["monthly"])
    # the dry-season reference months have no extension by construction
    assert all(r["extension_km2"] == 0 for r in C["monthly"] if r["month"] in (2, 3))
    k = C["sentinel2_check_2022"]
    assert 0 <= k["s1_confirmed_by_s2"] <= 1 and 0 <= k["s2_found_by_s1"] <= 1
