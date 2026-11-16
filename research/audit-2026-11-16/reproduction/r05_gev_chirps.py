"""Reproduction step 5: present-day design rainfall from CHIRPS, both study areas. Own code.

Annual maximum daily rainfall per 0.25-degree cell, 1985-2014 (calendar years, cells from part_c/data/cells.json),
from cache/chirps (r01). GEV fitted per cell by L-moments, written here from Hosking (1990) and Hosking & Wallis
(1997): unbiased probability-weighted moments b0, b1, b2; l1 = b0, l2 = 2b1 - b0, t3 = (6b2 - 6b1 + b0)/l2;
k from the rational approximation k = 7.8590c + 2.9554c^2 with c = 2/(3 + t3) - ln2/ln3;
alpha = l2 k / ((1 - 2^-k) Gamma(1 + k)); xi = l1 - alpha (1 - Gamma(1 + k)) / k;
x(F) = xi + alpha (1 - (-ln F)^k) / k.
Compared with part_c/data/results.json (median over cells). Cross-checks: scipy GEV maximum likelihood and Gumbel
(L-moments), and the baseline window 1995-2024.
Output: out/gev_compare.json
"""
import json
import os

import numpy as np
from scipy import stats
from scipy.special import gamma as G

from common import HERE, REPO, cells, load_year

TS = [2, 10, 25, 50, 100]


def lmom(x):
    x = np.sort(x)
    n = len(x)
    j = np.arange(1, n + 1)
    b0 = x.mean()
    b1 = np.sum((j - 1) / (n - 1) * x) / n
    b2 = np.sum((j - 1) * (j - 2) / ((n - 1) * (n - 2)) * x) / n
    l1, l2 = b0, 2 * b1 - b0
    return l1, l2, (6 * b2 - 6 * b1 + b0) / l2


def gev_lmom(x):
    l1, l2, t3 = lmom(x)
    c = 2 / (3 + t3) - np.log(2) / np.log(3)
    k = 7.8590 * c + 2.9554 * c * c
    a = l2 * k / ((1 - 2 ** -k) * G(1 + k))
    xi = l1 - a * (1 - G(1 + k)) / k
    return xi, a, k


def q_gev(p, T):
    xi, a, k = p
    F = 1 - 1 / np.asarray(T, float)
    return xi + a * (1 - (-np.log(F)) ** k) / k


def q_gumbel(x, T):
    l1, l2, _ = lmom(x)
    a = l2 / np.log(2)
    xi = l1 - 0.5772 * a
    return xi - a * np.log(-np.log(1 - 1 / np.asarray(T, float)))


def annual_max(area, years):
    return np.array([np.nanmax(load_year(y, area), axis=0) for y in years])  # (years, cells)


def main():
    pub = json.load(open(f"{REPO}/part_c/data/results.json"))
    out = {}
    for area in ("niger_benue", "sokoto_rima"):
        rx = annual_max(area, range(1985, 2015))
        rl = np.array([q_gev(gev_lmom(rx[:, c]), TS) for c in range(rx.shape[1])]).T  # (T, cells)
        mle = []
        for c in range(rx.shape[1]):
            sh, loc, sc = stats.genextreme.fit(rx[:, c])
            mle.append(stats.genextreme.ppf(1 - 1 / np.array(TS, float), sh, loc, sc))
        mle = np.array(mle).T
        gum = np.array([q_gumbel(rx[:, c], TS) for c in range(rx.shape[1])]).T
        rx2 = annual_max(area, range(1995, 2025))
        rl2 = np.array([q_gev(gev_lmom(rx2[:, c]), TS) for c in range(rx2.shape[1])]).T
        P = pub["areas"][area]["chirps"]["return_levels"]
        out[area] = {"cells": int(rx.shape[1]), "T": {}}
        for i, T in enumerate(TS):
            p = P[str(T)]["median_cells"]
            out[area]["T"][str(T)] = {"published_median_mm": round(p, 2), "lmoment_median_mm": round(float(np.median(rl[i])), 2),
                                      "rel_diff": round(float(np.median(rl[i]) / p - 1), 4),
                                      "mle_median_mm": round(float(np.median(mle[i])), 2), "gumbel_median_mm": round(float(np.median(gum[i])), 2),
                                      "baseline_1995_2024_median_mm": round(float(np.median(rl2[i])), 2)}
        ks = [gev_lmom(rx[:, c])[2] for c in range(rx.shape[1])]
        out[area]["gev_shape_k_median_and_range"] = [round(float(np.median(ks)), 3), round(float(np.min(ks)), 3), round(float(np.max(ks)), 3)]
    os.makedirs(f"{HERE}/out", exist_ok=True)
    json.dump(out, open(f"{HERE}/out/gev_compare.json", "w"), indent=1)
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
