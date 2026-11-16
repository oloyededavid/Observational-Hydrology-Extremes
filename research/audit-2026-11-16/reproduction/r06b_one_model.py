"""Reproduction step 6b: the uplift comparison of r06 for MRI-ESM2-0 only, once its files are downloaded
(the second model, INM-CM5-0, downloads at about 4 minutes per year and is reported separately if it completes)."""
import json, os
import numpy as np
from r06_nexgddp_uplift import annual_max, HERE, REPO, TS, gev_lmom, q_gev
pub = json.load(open(f"{REPO}/part_c/data/results.json"))
res = {}
for area in ("niger_benue", "sokoto_rima"):
    m = "MRI-ESM2-0"
    h, f = annual_max(m, "historical", area), annual_max(m, "ssp585", area)
    up = np.median(np.array([q_gev(gev_lmom(f[:, c]), TS) / q_gev(gev_lmom(h[:, c]), TS) for c in range(h.shape[1])]), axis=0)
    P = pub["areas"][area]["models"][m]
    from r05_gev_chirps import annual_max as chirps_max
    rl_obs = np.array([q_gev(gev_lmom(x), TS) for x in chirps_max(area, range(1985, 2015)).T]).T
    rl_h = np.array([q_gev(gev_lmom(x), TS) for x in h.T]).T
    bias = np.median(rl_h, axis=1) / np.median(rl_obs, axis=1)
    res[area] = {"uplift_ssp585": {str(T): {"published": round(P["ssp585"]["uplift"][str(T)], 4), "recomputed": round(float(u), 4)} for T, u in zip(TS, up)},
                 "historical_rl_bias_vs_chirps": {str(T): {"published": round(P["historical"]["rl_bias_vs_chirps"][str(T)], 4), "recomputed": round(float(b), 4)} for T, b in zip(TS, bias)},
                 "rx1day_mean_ratio": {"published": round(P["ssp585"]["rx1day_mean_ratio"], 4), "recomputed": round(float(np.median(f.mean(0) / h.mean(0))), 4)}}
json.dump(res, open(os.path.join(HERE, "out", "uplift_compare_mri.json"), "w"), indent=1)
print(json.dumps(res, indent=1))
