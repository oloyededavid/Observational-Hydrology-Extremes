# Observational hydrology: re-audit, re-implementation and positioning

16 November 2026 · working branch `research-audit` (local, not pushed) · progress log: [`PROGRESS.md`](PROGRESS.md) · reproduction code and outputs: [`reproduction/`](reproduction/)

The earlier audit (`research/audit/D01`–`D03`, 12 November 2026) listed 32 weaknesses and an implementation plan. This re-audit checks what was actually done, re-implements the headline calculations in separately written code (an independent re-implementation of the same method and cell lists, not an independent analysis), and looks for problems the first audit missed.

## 1. Status of the earlier audit

| Area | Items (D02) | State found on 16 November | Evidence |
| :--- | :--- | :--- | :--- |
| Part A robustness | A-1 threshold sensitivity and Otsu, A-3 Sentinel-2 check, A-4 coverage, A-5 VV/VH, A-9 "hotspots" figure | Done | `part_a/data/robustness.json` (`otsu_summary`, `vv_vs_vh`, `sentinel2_check`, `coverage`); the hotspots figure is no longer on the site |
| Part A circularity | A-2 JRC as mask and reference | Stated on the site (Table 9·1, Table 8·1 before renumbering), not removable without another reference | `docs/index.html` |
| Part B depth | B-1 SPI-3/6/12, B-2 run theory, B-3 per-cell NDVI, B-6 TerraClimate | Done | `part_b/data/drought.json`, `b04_ndvi_cells.py`, site Table 8·1 |
| Part C reliability | C-3 GEV vs Gumbel, C-4 baselines, C-5 return-level plots, C-6 model families, C-8 L-moment diagram, C-9 decomposition | Done | `part_c/data/reliability.json` |
| Part C, not feasible | C-2 raw CMIP6, C-10 sub-daily | Stated as limits | site, README |
| Documentation | X-2 README describes superseded work | **Not done until this re-audit** | README rewritten (section 3) |

## 2. Re-implementation of the main results

Own code in `reproduction/` (scripts `r01`–`r07`): fresh downloads and new implementations of SPI, run theory, L-moment GEV, the NDVI–rainfall statistics and the radar composites. Comparison files are in `reproduction/out/`.

| Result | Published | Recomputed | Verdict |
| :--- | :--- | :--- | :--- |
| Sokoto–Rima CHIRPS annual totals 1981–2024 | `part_b/data/rain_spi.json` | max difference 0.05 mm | Reproduced |
| Annual SPI, SPI-3/6/12 | same, `drought.json` | max difference 0.005 (rounding); drought events identical | Reproduced |
| Growing-season NDVI vs rainfall, r raw / detrended / differenced | 0.70 / 0.76 / 0.73 | 0.66 / 0.69 / 0.67 | Direction and significance reproduced; size differs, cause not identified (composite selection, see N-4) |
| CHIRPS 2–100-year return levels, both areas | `part_c/data/results.json` | identical to 0.01 mm | Reproduced |
| Baseline 1995–2024 sensitivity | 77.1 mm (Lower Niger–Benue, 50-year) | 77.1 mm | Reproduced |
| MRI-ESM2-0: SSP5-8.5 uplift factors, historical bias vs CHIRPS, annual-maximum ratio | `results.json` | identical to four decimals, both areas | Reproduced |
| Part A floodplain water, −18 dB | 337.6 (March 2022), 627.0 km² (October 2022) | 333.1, 592.0 km² | Close, not like-for-like: the rebuilt mask is 9 % smaller (2.1) |
| Part A Otsu threshold | −18.25, −18.05 dB | −18.2, −18.0 dB | Reproduced |
| Gauges inside the basin; usable years | 2 stations; 21/26 and 24/27 years | same | Confirmed |

Not reproduced, with reason: the remaining 22 climate models (about 4 minutes per model-year from the bucket here, roughly 2 hours per model); Part A for the other 70 months (one wet and one dry month were chosen to bracket the range).

### 2.1 New problems found

| # | Problem | Evidence | Severity | Treatment |
| :-- | :--- | :--- | :-- | :--- |
| N-1 | Flood areas depend on how the 30 m JRC extent is aggregated to 110 m | Floodplain mask 707.7 km² published vs 645.2 km² when aggregated from full resolution; October 2022 water 627.0 vs 592.0 km² | Medium | Added to the limits table on the site and to the README. The 9 % mask difference is from aggregation; both versions use the 1/8 radar overview and the GLO-90 DEM, so the rest of the 6 % water difference is unexplained |
| N-2 | Which years count as droughts depends on the SPI reference period | 1985 and 2017 are drought years against 1991–2020 (the reference used), not against 1981–2024; the 1980s are much drier than the reference (461 vs 546 mm) | Medium | Added to the limits table and README |
| N-3 | The 1980s drought's length depends on the threshold | 35, 48 and 74 months at SPI ≤ −1.5, −1.0, −0.5 | Low | README |
| N-4 | The NDVI–rainfall r depends on cloud handling in 16-day composites | 0.66–0.69 with the published definition on a fresh download (1 composite filled vs 15 published); 0.79–0.84 when composites under 80 % clear are treated as missing. A first version of the reader `r03` averaged NDVI to 1 km before masking fill and cloud (0.65–0.67); fixed after the code review, the gap to the published values narrowed but remains unexplained. With the effective sample size capped at n, every version is significant except year-to-year differences against July–October rainfall (p = 0.051) | Medium | Added to the limits table; README gives both the published and rebuilt values |
| N-5 | The shared-trend concern raised in the old README does not apply over 2001–2024 | Rainfall trend p = 0.38, NDVI trend p = 0.003; a non-significant trend does not show there is none, but the detrended and differenced correlations remove any shared trend and are as strong as the raw one | Positive finding | README states it |

All other published numbers checked here hold.

## 3. Corrections implemented

| Problem | Files | Change | Check |
| :--- | :--- | :--- | :--- |
| X-2: README still led with the Earth Engine work (MERIT DEM, "vulnerability index", typed-in flood curve, r = 0.594, Colab links) | `README.md` | Rewritten around the current scripts, results and limits; superseded material listed and kept | Every number traced to `part_*/data`, `docs/data` or `reproduction/out` |
| N-1, N-2, N-4 | `docs/index.html` (Table 9·1, Table 8·1 before renumbering) | Three rows added, without new results on the site | `pytest tests part_c/tests`: 30 passed |
| Reproduction record | `research/audit-2026-11-16/` | Scripts, outputs, this file, progress log | — |

No analysis output changed: the reproduction found no error that requires recomputing a published number.

## 4. Test and execution results

- `python3 -m pytest -q tests part_c/tests`: 30 passed (before and after the changes).
- Reproduction scripts `r02`, `r04`, `r05`, `r06b`, `r07` ran to completion; outputs in `reproduction/out/`.
- Local preview of the site (`python3 -m http.server -d docs`): no overflow, broken images, bad anchors or console errors at 320, 390, 768 and 1440 px (16 November, after the second review round).

## 5. Unresolved limitations

No flood ground truth; JRC used as both mask and reference; areas depend on threshold and mask aggregation; meteorological, not agricultural, drought (TerraClimate soil moisture is a model product); NDVI coupling is an association; CHIRPS understates heavy days; 30-year samples; downscaled models bias-corrected to observations over the historical period; daily rainfall only; 22 of 23 models not independently re-downloaded.

## 6. Scientific positioning

**One contribution, not three.** The study tests three substitutes for missing gauges, each against something else:

| Substitute | Stands in for | What the evidence supports | What it does not |
| :--- | :--- | :--- | :--- |
| Sentinel-1 radar (Part A) | River-level and flood records | A September–October flood season every year, agreeing in part with Sentinel-2 | Absolute areas (threshold and mask); flood timing has no gauge reference here |
| CHIRPS satellite rainfall (Part B) | Rain-gauge records for drought | The prolonged early-1980s drought; vegetation following rainfall | Which marginal years count as droughts (reference period); CHIRPS and the gauges do not overlap in time |
| Downscaled climate models (Part C) | Long gauge records for design rainfall | A projected increase in the Lower Niger–Benue across nearly all models | Absolute design values (CHIRPS too low against gauges); in the Sokoto–Rima the combined range includes no change |

The defensible common finding is narrower than "reliable for timing and relative change": each substitute gives a usable answer about **whether and roughly when** something happens, and the relative outputs (uplift factors) are **less sensitive to the absolute bias** of the reference data than the absolute values are. Whether the projected changes are right cannot be tested here; reproducing the calculation (exactly, for one model) shows only that the code does what it says.

**Assessment** (1–5; before = 11 November state, after = this re-audit):

| Criterion | Before | After | Why |
| :--- | :--: | :--: | :--- |
| Scientific rigour | 4 | 4 | Already strong after the 12 November work; main results now re-implemented in separate code |
| Methodological validity | 4 | 4 | Unchanged; new sensitivities documented |
| Technical implementation | 4 | 4 | Scripts and tests in place |
| Data quality | 3 | 3 | No ground truth for floods; CHIRPS bias |
| Reproducibility | 4 | 3 | Re-implemented code reproduces Parts B and C exactly (C for 1 of 23 models) and Part A closely (2 of 72 months); NDVI not exactly |
| Research value | 4 | 4 | Clear, transferable conclusion |
| Academic relevance | 4 | 4 | Fits data-sparse hydrology and climate-adaptation programmes |
| Visual communication | 4 | 4 | Site already strong; README now matches it |

**Remaining work for an excellent standard.** A flood reference that is not JRC (e.g. date-matched Sentinel-2 or high-resolution optical flood maps for 2022, or any gauge-height record from NIHSA for the Lokoja–Onitsha reach); an SPI with a stated reference-period sensitivity in the results, not only the limits; the NDVI coupling reported as a range with the composite rule fixed in advance; the remaining climate models re-run independently when bandwidth allows; a short written report replacing the October 2026 PDF.

## 7. Independent review and changes made after it

A scientific review (separate agent, read-only, 16 November) found: the positioning claimed reliability for direction and relative change that computational reproduction cannot show (narrowed in section 6); the effective sample size could exceed n when the two lag-1 autocorrelations have opposite signs (capped in `reproduction/r04_ndvi_rain.py`; one result is then not significant, now stated); the README led with r values the rebuild did not reproduce (both now given); the site row on the SPI reference period also claimed a drought-length effect that was only computed for the threshold (row corrected); N-1 mixed causes (wording corrected); "1.17" should be 1.16 and "900–1,000 km²" matched no stored value (both corrected from `part_c/data/results.json` and `part_a/data/flood_monthly.csv`); "independent" and the reproducibility score overstated what was done (both corrected). The Sokoto–Rima combined uncertainty range (0.92–1.69 under SSP5-8.5) is now in the README.

## 8. Second review round (16 November, six separate reviewers) and changes made

- **"Independent" used for a re-implementation of the same method and cells.** Replaced by "re-implementation" throughout this file, the README and the site row; the site no longer calls TerraClimate and CHIRPS independent (their station inputs may overlap; not checked).
- **Reproducibility scored 4 while the NDVI values were not reproduced and Parts A and C were checked for 2 of 72 months and 1 of 23 models.** Lowered to 3.
- **The MODIS reader averaged before masking** (fill and cloudy 250 m pixels entered the 1 km means). Fixed: full-resolution read and mask, then mean. r rose from 0.65/0.67/0.65 to 0.66/0.69/0.67; the published 0.70/0.76/0.73 are still not matched.
- **The 6 % flood-area difference was put down to a coarser overview and DEM.** Both versions use the same; the cause is now stated as unidentified.
- **Code:** repository path derived from the script folder; `r05` analysis moved into `main()` (importing it reran it); the drought event count was overwritten by the event list; guards for a year with no valid composite, the NEX fill value and JRC no-data. `r05` output unchanged byte for byte; drought events unchanged.
- **Site:** two sections were both numbered 7 (renumbered); the section links were hidden on phones (a scrollable phone row added, as on the other study sites).

## 9. Scorecard as a candidate Erasmus Mundus project

No programme or track has been chosen, so programme fit and eligibility cannot be scored. Scores follow the five-dimension rule (each at least 4.5, no averaging).

| Dimension | Score | Evidence | Pass |
| :--- | :--: | :--- | :--: |
| Scientific value | not yet scoreable | No literature review done for this question | — |
| Feasibility | 4.5 | All inputs opened and processed in this session; main results re-implemented (`reproduction/out/`) | Yes |
| Independent validation | 3.0 | Sentinel-2 checks radar water in part; no flood ground truth; CHIRPS and the two gauges do not overlap in time; model agreement with CHIRPS is consistency, not skill | No |
| Programme fit | not yet scoreable | No programme chosen | — |
| Differentiation | not yet scoreable | Not compared with published work | — |

Hard gates: eligibility not assessed; data access verified; no ethics issues identified. **Decision: REDESIGN.** Largest uncertainty: flood validation. One action: obtain a gauge-height record for the Lokoja–Onitsha reach (NIHSA) or date-matched high-resolution optical flood maps for 2022.
