# D02 — Scientific Loophole Register

Severity: **Critical** (a headline result could be wrong or misread) · **High** (a result is fragile or its
uncertainty is understated) · **Medium** (weakens rigour or interpretation) · **Low** (presentation or documentation).
Evidence is from files in the repository or from diagnostics run on the cached data during this audit (D01 §1).

## Part A — Flood observation (Lower Niger–Benue)

| ID | Weakness | Evidence | Severity | Consequence | Correction |
| :--- | :--- | :--- | :--- | :--- | :--- |
| A-1 | The −18 dB VH threshold is fixed and arbitrary, and results depend strongly on it | Dry-ground "water" outside the floodplain in March: 4,401 km² at −16 dB, 1,172 at −18, 163 at −20, 6 at −22 (means 2018–2023, `part_a/cache/s1_*.npz`). Floodplain water, October: 594 / 498 / 390 / 138 km² | **Critical** | Every flood area on the site holds only for −18 dB; the dry-season false positives are largely a threshold artefact | Report a sensitivity range (−16 to −22 dB); derive a data-driven threshold (bimodal histogram / Otsu on the monthly composites) and show both |
| A-2 | JRC is used to define the floodplain and permanent water **and** as the comparison reference | `a01_flood_pc.py`: `plain = (ext >= 0.5) & ~permanent`; agreement computed against the same JRC layers | **Critical** | The floodplain curve cannot show flooding beyond JRC's 1984–2020 maximum extent, and JRC agreement is not independent validation of a JRC-bounded result | Say so explicitly; report full-box and floodplain results side by side; add an independent optical check (date-matched Sentinel-2 water) |
| A-3 | No independent reference at all | No gauge, discharge or mapped flood record found for the reach | High | Results are internally consistent only | Sentinel-2 MNDWI on clear dates as an independent satellite check; state the absence of ground truth |
| A-4 | Observation counts differ threefold across the box | Wet-season images per 110 m cell: 60 (median) to 235 (max), where orbits overlap | Medium | Frequency precision varies spatially; orbit geometry may differ between areas | Publish a coverage map; test whether frequency differs by orbit |
| A-5 | Only VH is used | VV is available in every RTC scene | Medium | Missed cross-check: VV separates smooth water from dry sand differently | VV/VH comparison at the same thresholds for dry and wet months |
| A-6 | γ⁰ (RTC) used with a threshold set for σ⁰ (original Earth Engine) | Site says "about 1 dB"; on flat ground γ⁰ = σ⁰/cos θ, i.e. +0.6 to +1.6 dB for θ = 30–46° | Medium | The original and recomputed areas are not strictly comparable | State the conversion with its formula; covered by A-1's sensitivity range |
| A-7 | Floodplain cells on slopes > 5° are dropped by the slope mask | 180 cells of the JRC extent fall on > 5° slopes (GLO-90 at 110 m) | Low | Small under-count at steep banks | Report the count; keep mask |
| A-8 | A straight linear artefact crosses the reach in every water map | Visible in `part_a/data/*.png` and in the original radar figure | Low | Small spurious "water" line | Identify (likely a linear corridor); mask or state |
| A-9 | Superseded Earth Engine figures still shown, including a map titled "Empirical Risks Hotspots" | `docs/index.html` Fig. 6; `part_a/figures/` | High (terminology) | Implies a risk assessment with no exposure data | Remove from the narrative; keep in an archive section labelled historical |
| A-10 | "Flood frequency" from monthly medians vs per-scene masks | Frequency uses per-scene masks; monthly curve uses monthly median composites | Low | Two definitions | Name them distinctly: observed inundation frequency (per scene) and monthly median water extent |

## Part B — Meteorological drought and vegetation (Sokoto–Rima)

| ID | Weakness | Evidence | Severity | Consequence | Correction |
| :--- | :--- | :--- | :--- | :--- | :--- |
| B-1 | SPI at one timescale only (calendar-year totals) | `b01_rain_spi.py` | High | Within-season droughts, the ones that matter for crops, are invisible | SPI-3, -6, -12 from monthly CHIRPS (44 years cached) |
| B-2 | No drought characteristics | — | High | Frequency, duration and severity not quantified | Run theory on monthly SPI: events, duration, severity, intensity; per-cell maps |
| B-3 | Vegetation evidence is a basin mean only | `ndvi.json` holds one value per year | Medium | Cannot show where vegetation responds; north is near-desert (40 of 245 cells < 250 mm/yr) | Per-cell NDVI anomaly maps and per-cell correlation; stratify by rainfall zone |
| B-4 | Correlation uses annual rainfall, not growing-season rainfall | `b02_ndvi_pc.py` | Medium | Mixes off-season rain into the predictor | Test July–October rainfall too; previous-year rain gives r = −0.04 (no lag) |
| B-5 | Gap filling of NDVI composites | 16 of 168 July–October composites filled (cloud or missing) | Low | Small; stated on site | Sensitivity: correlation without filled years |
| B-6 | Meteorological vs agricultural drought not separated | Site text | Medium | SPI measures rainfall deficit only | Use the terms precisely; add soil-moisture evidence if a suitable independent dataset exists (TerraClimate is a candidate: monthly, ~4 km, not built on CHIRPS) |
| B-7 | Trend significance | OLS and Mann–Kendall on 44 years; lag-1 autocorrelation 0.12 | Low | p-values reasonable | State autocorrelation; report Sen's slope |
| B-8 | Gamma fit not shown | Shape 70 (near-normal), KS p = 0.78, SPI Shapiro p = 0.74 | Low | Fit is adequate but undocumented | Add a diagnostic figure |

## Part C — Future design rainfall and dry spells

| ID | Weakness | Evidence | Severity | Consequence | Correction |
| :--- | :--- | :--- | :--- | :--- | :--- |
| C-1 | Present-day design rainfall rests on CHIRPS, which disagrees strongly with gauges | Typical wettest day ~55 mm at Birni N'Konni and Maradi vs 30 mm for a CHIRPS cell; models are 0.65 × gauges but 1.60 × CHIRPS (Sokoto–Rima) | **Critical** | "Today" values in Table 2 could be far too low | Already stated; lead with uplift factors, present absolute values as indicative; add areal-reduction discussion |
| C-2 | Projected rise in extremes exceeds thermodynamic expectation, cause untested | Mean annual maximum +33% (NB) and +30% (SR) vs annual total +9% / +16%, SSP5-8.5 | High | Uplift may be inflated by the statistical downscaling | Compare raw CMIP6 (not downscaled) for a model subset if obtainable; otherwise keep as stated limitation |
| C-3 | Distribution choice changes the answer | Sokoto–Rima SSP5-8.5 50-yr uplift: GEV 1.21 vs Gumbel 1.29 (per-model correlation 0.90) | High | Uplift uncertainty understated | Report GEV and Gumbel side by side; L-moment ratio diagram |
| C-4 | Baseline choice changes present-day values | CHIRPS 50-yr rainfall, Lower Niger–Benue: 68.8 mm (1985–2014) vs 77.1 mm (1995–2024); Sokoto–Rima 52.7 vs 54.8 | High | 12% change from the window alone | Baseline sensitivity table; note the observed recent increase |
| C-5 | Return-period extrapolation from 30 years | One cell: 90% interval width 30% of the median at 25 years, 45% at 100 years; null test 0.66–1.71 for single models | High | 100-year values are weakly constrained | Return-level plots with intervals; recommend 25–50 years as the main design use; label 100-year values extrapolated |
| C-6 | Model dependence | One per institution, but shared atmospheres: UK Met Office UM (HadGEM3, KACE, ACCESS-CM2, ACCESS-ESM1-5), NCAR CAM (CESM2, NorESM2-MM, TaiESM1, CMCC-CM2-SR5), ECHAM (MPI-ESM1-2-HR, NESM3), GFDL (GFDL-CM4, KIOST-ESM) | Medium | Some families weigh 2–4 × | Family-weighted ensemble as sensitivity (Kuma et al., 2023) |
| C-7 | Historical evaluation not independent | NEX-GDDP is bias-corrected to an observational dataset over the historical period | Medium | Agreement partly built in | Stated; present evaluation as consistency, not skill |
| C-8 | GEV adequacy not shown | L-kurtosis vs GEV-implied: median difference −0.007 (NB) and +0.020 (SR), RMS 0.06–0.07, comparable to sampling noise; shape k ≈ 0 | Low | Fit adequate but undocumented | L-moment diagram and return-level plot |
| C-9 | Uncertainty sources mixed in one interval | Combined interval = model spread + sampling | Medium | Reader cannot tell what drives the range | Decompose: sampling, model, scenario (and distribution from C-3) |
| C-10 | Daily rainfall vs design needs | Site states daily only, no discharge | Low | Correctly stated | Add a short engineering note on sub-daily intensity and discharge |

## Cross-cutting

| ID | Weakness | Evidence | Severity | Correction |
| :--- | :--- | :--- | :--- | :--- |
| X-1 | Three parts lack an explicit framework and research questions | Site intro | High | Overarching question, objectives, per-part questions, conceptual diagram |
| X-2 | Documentation describes superseded work | `README.md`, `data/README.md`, PDF | High | Reconcile all documents to one authoritative version; archive superseded material |
| X-3 | No current report | Only the October 2026 PDF | High | Write and render an updated report |
| X-4 | Two Earth Engine v2 notebooks never executed | `*_v2.ipynb` | Low | Mark them as not executed and superseded |
