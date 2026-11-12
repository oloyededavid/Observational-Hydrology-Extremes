"""Extreme-value tools for Part C: GEV return levels by L-moments, dry spells, bootstrap.

GEV parameters follow Hosking (1985, 1990): location xi, scale alpha, shape k, with quantile
    x(F) = xi + alpha / k * (1 - (-ln F) ** k)      (k != 0)
    x(F) = xi - alpha * ln(-ln F)                    (k == 0, Gumbel)
k > 0 is bounded above, k < 0 is heavy-tailed. scipy.stats.genextreme uses the same sign (c = k).
L-moment fitting is used because it is less erratic than maximum likelihood for samples of about
30 annual maxima (Hosking & Wallis, 1997).

All functions work along the first axis, so a (years, cells) array is fitted cell by cell at once.
"""
import numpy as np
from scipy.special import gamma

EULER = 0.5772156649015329


def lmoments(x):
    """First two L-moments and L-skewness along axis 0 (unbiased probability-weighted moments)."""
    x = np.sort(np.asarray(x, dtype=float), axis=0)
    n = x.shape[0]
    j = np.arange(n).reshape((-1,) + (1,) * (x.ndim - 1))
    b0 = x.mean(axis=0)
    b1 = (j / (n - 1) * x).mean(axis=0)
    b2 = (j * (j - 1) / ((n - 1) * (n - 2)) * x).mean(axis=0)
    l1, l2, l3 = b0, 2 * b1 - b0, 6 * b2 - 6 * b1 + b0
    return l1, l2, l3 / l2


def gev_fit(x):
    """GEV (xi, alpha, k) by L-moments, using Hosking's (1985) approximation for k."""
    l1, l2, t3 = lmoments(x)
    c = 2.0 / (3.0 + t3) - np.log(2) / np.log(3)
    k = 7.8590 * c + 2.9554 * c ** 2
    small = np.abs(k) < 1e-6
    ks = np.where(small, 1.0, k)
    alpha = np.where(small, l2 / np.log(2), l2 * ks / ((1 - 2.0 ** -ks) * gamma(1 + ks)))
    xi = np.where(small, l1 - EULER * alpha, l1 - alpha * (1 - gamma(1 + ks)) / ks)
    return xi, alpha, k


def gev_quantile(params, T):
    """Return level for return period T years (annual non-exceedance probability 1 - 1/T)."""
    xi, alpha, k = (np.asarray(p, dtype=float) for p in params)
    y = -np.log(1.0 - 1.0 / np.asarray(T, dtype=float))
    small = np.abs(k) < 1e-6
    ks = np.where(small, 1.0, k)
    return np.where(small, xi - alpha * np.log(y), xi + alpha / ks * (1 - y ** ks))


def return_levels(x, Ts):
    """Return levels (len(Ts), ...) from annual maxima x (years, ...)."""
    p = gev_fit(x)
    return np.stack([gev_quantile(p, T) for T in Ts])


def longest_dry_spell(daily, wet_threshold=1.0):
    """Longest run of consecutive days below wet_threshold (mm) along axis 0. NaN days break nothing:
    the caller passes only complete seasons."""
    dry = np.asarray(daily) < wet_threshold
    run = np.zeros(dry.shape[1:], dtype=int)
    best = np.zeros(dry.shape[1:], dtype=int)
    for d in dry:
        run = np.where(d, run + 1, 0)
        best = np.maximum(best, run)
    return best


def boot_indices(n_years, n_boot, rng):
    """Resampled year indices (n_boot, n_years). The same years are drawn for every cell, which keeps
    the spatial dependence between cells."""
    return rng.integers(0, n_years, size=(n_boot, n_years))
