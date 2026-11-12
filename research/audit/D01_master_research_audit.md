# D01 — Master Research Audit

Observational Hydrology Extremes · audit of commit `12ca9e2` (12 November 2026)

This audit records the actual state of the project, established by inspecting every file and by re-running
every analysis script, not from the README or the website. Status labels used throughout:

| Label | Meaning |
| :--- | :--- |
| **Completed** | Script runs, inputs available, outputs exist, re-run reproduces them exactly |
| **Executed, not validated** | Runs and reproduces, but no independent reference confirms the result |
| **Implemented, not executed** | Code exists; it has never been run to completion |
| **Requires correction** | Output exists but is wrong, misleading or superseded |
| **Proposed** | Not started |

## 1. How the audit was done

1. Listed every tracked file (93 files; the three largest are the two original notebooks with embedded images, 14.6 MB and 5.7 MB, and the original figures).
2. Backed up all outputs (`part_*/data`, `docs/data`) and re-ran every script from the cached inputs: `c01`, `c04`, `c05`, `b01`, `a01`, `b02`, `build_site_data`. Total 3 min 30 s. **`git status` afterwards was empty: every committed result is reproduced exactly by its script.**
3. Ran the test suites: 22 Python tests and the browser tests pass locally and against the live site.
4. Compared the live site with the repository: `site.json`, `cells.json`, `spi_cells.json`, both HTML pages, the script, the stylesheet and a map overlay are byte-identical. The live site shows the current results.
5. Ran diagnostics from the cached data to test specific concerns (threshold sensitivity, observation counts, gamma fit, lagged NDVI response, GEV adequacy, baseline and distribution sensitivity). Their numbers are in D02 as evidence.

## 2. Inventory

### 2.1 Analyses

| Analysis | Files | Status | Note |
| :--- | :--- | :--- | :--- |
| A0 Original flood mapping (Earth Engine, −18 dB VH, 2022 dual state, Aug–Nov frequency 2018–2023, vulnerability index) | `part_a/waves_niger_benue_hydrodynamics.ipynb`, `part_a/figures/` | **Requires correction** (superseded) | Not reproducible here (needs Earth Engine). Typed-in flood curve; vulnerability index uses no exposure data |
| A1 Monthly water extent 2018–2023, frequency, JRC agreement (Planetary Computer) | `part_a/scripts/a01_flood_pc.py`, `part_a/data/` | **Executed, not validated** | Reproduces; 1,065 Sentinel-1 RTC scenes; no independent flood reference |
| A2 Earth Engine version 2 notebook | `part_a/niger_benue_flood_v2.ipynb` | **Implemented, not executed** | Superseded by A1; owner's Earth Engine sign-in failed |
| B0 Original drought analysis (z-score "SPI", CV map, NDVI correlation) | `part_b/sokoto_rima_drought.ipynb`, `part_b/figures/` | **Requires correction** (superseded) | z-score labelled SPI; undetrended correlation; maps cut at 14.5° N |
| B1 Annual gamma-fitted SPI, basin and per cell, 1981–2024 | `part_b/scripts/b01_rain_spi.py`, `part_b/data/rain_spi*.json` | **Completed** | Annual (calendar-year) scale only |
| B2 Growing-season NDVI and rainfall correlation, raw/detrended/differenced | `part_b/scripts/b02_ndvi_pc.py`, `part_b/data/ndvi.json` | **Executed, not validated** | 16 of 168 composites filled; basin mean only (no NDVI maps) |
| B3 Earth Engine version 2 notebook | `part_b/sokoto_rima_drought_v2.ipynb` | **Implemented, not executed** | Superseded by B1–B2 |
| C1 Study areas and cells | `part_c/scripts/c01_domains.py` | **Completed** | HydroBASINS checked by SHA-256 |
| C2–C4 Data cut: NEX-GDDP (23 models, 2,783 files), CHIRPS p25, two GHCN gauges | `c02`–`c04` | **Completed** | Inputs cached (0.8 GB); full re-download ~550 GB streamed |
| C5 GEV return levels, uplift factors, dry spells, model check, null test, bootstrap | `part_c/extremes.py`, `c05_analysis.py`, `part_c/data/` | **Executed, not validated** | Future change cannot be validated by definition; historical checks are not independent of the bias correction |

### 2.2 Datasets

| Dataset | Version | Period | Used by | Committed? |
| :--- | :--- | :--- | :--- | :--- |
| CHIRPS daily, 0.25° | v2.0 | 1981–2024 | B1, B2, C5 | cache only |
| NEX-GDDP-CMIP6 | v2.0 files, 23 models | 1950–1980, 1985–2014, 2041–2070 | C5 | cache only |
| GHCN-Daily, 2 stations in Niger | — | 1950–1980 | C5 | `part_c/data/gauges.json` |
| Sentinel-1 RTC (VH; VV also available) | Planetary Computer | 2018–2023 | A1 | monthly composites cached |
| JRC Global Surface Water | v1.3 (1984–2020) | — | A1 (mask **and** reference) | cache only |
| Copernicus DEM | GLO-90 | — | A1 slope mask | cache only |
| MODIS MOD13Q1 | v6.1 | 2001–2024 | B2 | basin means only |
| HydroBASINS level 4 | v1c | — | all | outline committed |

### 2.3 Figures and maps (live site, 15 figures)

| # | Figure | Source | Status |
| :--- | :--- | :--- | :--- |
| 1 | Study areas (interactive) | C1 | Current |
| 2 | Reach setting: report map + MERIT DEM | Original | Current, historical source |
| 3 | Sentinel-1 dry vs flood 2022 (image) | A0 | Superseded by Fig. 4; panel title says γ⁰ |
| 4 | Water frequency / Feb / Oct 2022 (interactive) | A1 | Current, single threshold only |
| 5 | Monthly water inside/outside floodplain | A1 | Current, single threshold only |
| 6 | Frequency + "vulnerability hotspots" (image) | A0 | **Superseded**; image title says "Empirical Risks Hotspots" |
| 7 | Basin elevation and streams (image) | B0 | Current; cropped at 14.5° N (stated) |
| 8 | Annual SPI bars | B1 | Current |
| 9 | Drought map, SPI/mean/CV by year (interactive) | B1 | Current |
| 10 | NDVI vs rainfall standard scores | B2 | Current |
| 11 | Model check vs CHIRPS and gauges | C5 | Current |
| 12 | Uplift factors per model | C5 | Current |
| 13 | Uplift / today / agreement map | C5 | Current |
| 14 | Dry-spell change map | C5 | Current |
| 15 | Dry-spell change per model | C5 | Current |

Missing for a postgraduate standard: observation-coverage map, threshold sensitivity, any independent flood
reference, floodplain cross-sections, multi-timescale SPI and drought duration maps, NDVI anomaly maps,
GEV diagnostic plots (return-level curves with intervals, L-moment diagram), model-performance heatmap,
uncertainty decomposition, historical-vs-future distribution plots, a methods workflow diagram.

### 2.4 Completed corrections (since 11 November 2026)

1. Flood curve: typed-in values replaced by monthly measurements (A1).
2. JRC 99.36% recall replaced by computed recall and precision (A1).
3. "SPI" z-score replaced by gamma-fitted SPI (B1); basin polygon checked, full basin mapped.
4. NDVI correlation re-tested detrended and differenced with quality-screened NDVI (B2).
5. Figure captions corrected (γ⁰ label, six seasons, cropped maps); original PDF marked superseded.

### 2.5 Documentation that is out of date

| File | Problem |
| :--- | :--- |
| `README.md` lines 20–22, 43, 55, 63–65 | Still describes the original Earth Engine workflow, the z-score and the illustrative flood curve as the project; the new results are appended, not integrated |
| `data/README.md` line 3 | "reads public satellite datasets directly from Google Earth Engine" — no longer true for any current result |
| `documents/…A AND B.pdf` | Superseded on four points; no current report exists |
| `part_a/*_v2.ipynb`, `part_b/*_v2.ipynb` | Not executed; their status is not stated in the notebooks themselves |
| `CITATION.cff` | Version 0.2.0 predates the recomputed Parts A and B |
| Website Figs 3 and 6 | Earth Engine images superseded by A1 output |

## 3. Overall assessment

The project is **reproducible and honest about its corrections**, which is its main strength: every current number
on the website is computed by a committed script and re-runs identically, and the live site matches. Its main
scientific weaknesses are (i) Part A's dependence on one arbitrary threshold and on JRC for both masking and
comparison, (ii) Part B's single (annual) drought timescale and absence of spatial vegetation evidence, and (iii)
Part C's untested sensitivity to distribution, baseline and model dependence, with no figures that show fit quality.
These are listed with evidence in D02 and ranked for action in D03.
