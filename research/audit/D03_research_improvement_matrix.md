# D03 — Research Improvement Matrix

Scores 1–5 (5 = best). **Value** = expected scientific improvement; **Feasible** = data available and checked in
this audit; **Cost** = computation and effort (5 = cheap). Priority = rank used for implementation.
Every candidate was checked against the data actually reachable from this environment.

| Rank | Addition | Fixes | Value | Feasible | Cost | WAVES relevance | Decision |
| :--: | :--- | :--- | :--: | :--: | :--: | :--- | :--- |
| 1 | Threshold sensitivity (−16 to −22 dB) and a data-driven (Otsu) threshold for Part A | A-1, A-6 | 5 | 5 | 5 | EO uncertainty | **Implement** (cached composites) |
| 2 | Independent optical check: Sentinel-2 water on clear dry-season dates vs Sentinel-1 | A-2, A-3 | 5 | 4 | 3 | EO validation | **Implement** (needs one storage host) |
| 3 | Full-box vs floodplain results side by side; explicit JRC circularity statement | A-2 | 4 | 5 | 5 | Method honesty | **Implement** |
| 4 | GEV vs Gumbel uplift; L-moment diagram; return-level plots with intervals | C-3, C-5, C-8 | 5 | 5 | 4 | Extreme-value statistics | **Implement** |
| 5 | Uncertainty decomposition (sampling / model / scenario / distribution) | C-9 | 5 | 5 | 4 | Uncertainty analysis | **Implement** |
| 6 | Baseline-period sensitivity (1981–2010, 1985–2014, 1995–2024) | C-4 | 4 | 5 | 5 | Design practice | **Implement** |
| 7 | SPI-3/6/12 monthly and run-theory drought characteristics, with maps | B-1, B-2 | 5 | 5 | 4 | Drought hydrology | **Implement** |
| 8 | Model-performance heatmap and family-weighted ensemble | C-6, C-7 | 4 | 5 | 4 | Climate-model evaluation | **Implement** |
| 9 | Observation-coverage map; VV/VH comparison | A-4, A-5 | 3 | 5 | 4 | SAR practice | **Implement** |
| 10 | Floodplain cross-sections from Copernicus DEM with water frequency | Part A geomorphology | 3 | 5 | 4 | Floodplain hydraulics context | **Implement** |
| 11 | Per-cell NDVI anomaly maps and rainfall-zone stratification; growing-season rainfall | B-3, B-4 | 4 | 4 | 3 | Ecohydrology | **Implement** (re-read MODIS per cell) |
| 12 | Historical vs future distribution plots; dry-spell distribution comparison | C figures | 3 | 5 | 4 | Communication | **Implement** |
| 13 | Independent soil-moisture evidence (TerraClimate) | B-6 | 3 | 3 | 3 | Agricultural drought | **Evaluate first**: check access, period, resolution; add only if independent of CHIRPS and fit for purpose |
| 14 | Raw (non-downscaled) CMIP6 comparison for the extremes inflation | C-2 | 4 | 2 | 1 | Downscaling uncertainty | **Defer**: needs ESGF or Pangeo access not checked; state as limitation |
| 15 | Sub-daily IDF curves | C-10 | 4 | 1 | 1 | Urban drainage | **Not feasible**: no sub-daily gauge data |
| 16 | Flood hydrodynamic modelling (HEC-RAS, LISFLOOD) | — | 3 | 1 | 1 | — | **Rejected**: no discharge or channel survey; would manufacture boundary conditions |
| 17 | Machine-learning downscaling or flood prediction | — | 1 | — | — | — | **Rejected**: no research question it answers here |

## Implementation stages

1. **Stage 1 — Part A robustness** (ranks 1, 2, 3, 9, 10)
2. **Stage 2 — Part C reliability** (ranks 4, 5, 6, 8, 12)
3. **Stage 3 — Part B drought depth** (ranks 7, 11, then 13 after evaluation)
4. **Stage 4 — Framework, report and documentation reconciliation** (X-1 to X-4)
5. **Stage 5 — Website redesign as a research atlas** (only after Stages 1–4)
6. **Stage 6 — QA report, WAVES assessment and benchmark scores**

Each stage ends with tests, a re-run of the pipeline, and a commit; results on the website change only when the
authoritative outputs change.
