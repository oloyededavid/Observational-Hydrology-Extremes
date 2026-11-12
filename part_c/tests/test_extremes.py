"""Software tests for part_c/extremes.py against scipy and hand-made series.
They test the code, not whether a GEV suits these basins."""
import os, sys
import numpy as np
from scipy.stats import genextreme

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import extremes as ex  # noqa: E402


def test_quantile_matches_scipy():
    for k in (-0.2, -0.05, 0.0, 0.1):
        p = (50.0, 12.0, k)
        for T in (2, 25, 50, 100):
            want = genextreme.ppf(1 - 1 / T, k, loc=50, scale=12)
            assert abs(float(ex.gev_quantile(p, T)) - want) < 1e-6


def test_lmoment_fit_recovers_parameters():
    rng = np.random.default_rng(1)
    for k in (-0.15, 0.0, 0.12):
        x = genextreme.rvs(k, loc=60, scale=15, size=200000, random_state=rng)
        xi, a, kk = ex.gev_fit(x)
        assert abs(xi - 60) < 0.5 and abs(a - 15) < 0.4 and abs(kk - k) < 0.02


def test_fit_is_vectorised_over_cells():
    rng = np.random.default_rng(2)
    x = rng.gumbel(40, 10, size=(30, 7))
    together = ex.return_levels(x, [25, 100])
    one = np.stack([ex.return_levels(x[:, i], [25, 100]) for i in range(7)], axis=1)
    assert np.allclose(together, one)


def test_lmoments_of_known_sample():
    # for 1..5: l1 = 3, l2 = 1 (uniform-like spacing), t3 = 0 (symmetric)
    l1, l2, t3 = ex.lmoments(np.arange(1.0, 6.0))
    assert abs(l1 - 3) < 1e-12 and abs(l2 - 1) < 1e-12 and abs(t3) < 1e-12


def test_longest_dry_spell():
    d = np.array([5, 0, 0, 0.5, 2, 0, 0, 0, 0, 3, 0.9])
    assert ex.longest_dry_spell(d) == 4
    two = np.stack([d, np.zeros_like(d)], axis=1)
    assert list(ex.longest_dry_spell(two)) == [4, 11]


def test_bootstrap_indices_shared_across_cells():
    idx = ex.boot_indices(30, 5, np.random.default_rng(0))
    assert idx.shape == (5, 30) and idx.min() >= 0 and idx.max() < 30
