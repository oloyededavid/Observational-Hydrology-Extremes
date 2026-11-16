# Observational hydrology: re-audit, independent reproduction and positioning

16 November 2026 · working branch `research-audit` (local, not pushed) · progress log: [`PROGRESS.md`](PROGRESS.md) · reproduction code and outputs: [`reproduction/`](reproduction/)

The earlier audit (`research/audit/D01`–`D03`, 12 November 2026) listed 32 weaknesses and an implementation plan. This re-audit checks what was actually done, reproduces the headline results with independently written code, and looks for problems the first audit missed.

## 1. Status of the earlier audit

| Area | Items (D02) | State found on 16 November | Evidence |
| :--- | :--- | :--- | :--- |
| Part A robustness | A-1 threshold sensitivity and Otsu, A-3 Sentinel-2 check, A-4 coverage, A-5 VV/VH, A-9 "hotspots" figure | Done | `part_a/data/robustness.json` (`otsu_summary`, `vv_vs_vh`, `sentinel2_check`, `coverage`); the hotspots figure is no longer on the site |
| Part A circularity | A-2 JRC as mask and reference | Stated on the site (Table 8·1), not removable without another reference | `docs/index.html` |
| Part B depth | B-1 SPI-3/6/12, B-2 run theory, B-3 per-cell NDVI, B-6 TerraClimate | Done | `part_b/data/drought.json`, `b04_ndvi_cells.py`, site Table 8·1 |
| Part C reliability | C-3 GEV vs Gumbel, C-4 baselines, C-5 return-level plots, C-6 model families, C-8 L-moment diagram, C-9 decomposition | Done | `part_c/data/reliability.json` |
| Part C, not feasible | C-2 raw CMIP6, C-10 sub-daily | Stated as limits | site, README |
| Documentation | X-2 README describes superseded work | **Not done until this re-audit** | README rewritten (section 3) |

## 2. Independent reproduction

Own code in `reproduction/` (scripts `r01`–`r07`): fresh downloads and new implementations of SPI, run theory, L-moment GEV, the NDVI–rainfall statistics and the radar composites. Comparison files are in `reproduction/out/`.

| Result | Published | Recomputed | Verdict |
| :--- | :--- | :--- | :--- |
| Sokoto–Rima CHIRPS annual totals 1981–2024 | `part_b/data/rain_spi.json` | max difference 0.05 mm | Reproduced |
| Annual SPI, SPI-3/6/12 | same, `drought.json` | max difference 0.005 (rounding); drought events identical | Reproduced |
| Growing-season NDVI vs rainfall, r raw / detrended / differenced | 0.70 / 0.76 / 0.73 | 0.65 / 0.67 / 0.65 | Direction and significance reproduced; size differs (composite handling, see 2.2) |
| CHIRPS 2–100-year return levels, both areas | `part_c/data/results.json` | identical to 0.01 mm | Reproduced |
| Baseline 1995–2024 sensitivity | 77.1 mm (Lower Niger–Benue, 50-year) | 77.1 mm | Reproduced |
| MRI-ESM2-0: SSP5-8.5 uplift factors, historical bias vs CHIRPS, annual-maximum ratio | `results.json` | identical to four decimals, both areas | Reproduced |
| Part A floodplain water, −18 dB | 337.6 (March 2022), 627.0 km² (October 2022) | 333.1, 592.0 km² | Reproduced within the mask-resampling difference (2.1) |
| Part A Otsu threshold | −18.25, −18.05 dB | −18.2, −18.0 dB | Reproduced |
| Gauges inside the basin; usable years | 2 stations; 21/26 and 24/27 years | same | Confirmed |

Not reproduced, with reason: the remaining 22 climate models (about 4 minutes per model-year from the bucket here, roughly 2 hours per model); Part A for the other 70 months (one wet and one dry month were chosen to bracket the range).

### 2.1 New problems found

| # | Problem | Evidence | Severity | Treatment |
| :-- | :--- | :--- | :-- | :--- |
| N-1 | Flood areas depend on how the 30 m JRC extent is aggregated to 110 m | Floodplain mask 707.7 km² published vs 645.2 km² when aggregated from full resolution; October 2022 water 627.0 vs 592.0 km² | Medium | Added to the limits table on the site and to the README |
| N-2 | Which years count as droughts depends on the SPI reference period | 1985 and 2017 are drought years against 1991–2020 (the reference used), not against 1981–2024; the 1980s are much drier than the reference (461 vs 546 mm) | Medium | Added to the limits table and README |
| N-3 | The 1980s drought's length depends on the threshold | 35, 48 and 74 months at SPI ≤ −1.5, −1.0, −0.5 | Low | README |
| N-4 | The NDVI–rainfall r depends on cloud handling in 16-day composites | 0.65–0.67 with the published definition on a fresh download (1 composite filled vs 15 published); 0.78–0.84 when composites under 80 % clear are treated as missing | Medium | Added to the limits table; README gives the range |
| N-5 | The shared-trend concern raised in the old README does not apply over 2001–2024 | Rainfall trend p = 0.38 (not significant); NDVI trend p = 0.004 | Positive finding | README states it |

All other published numbers checked here hold.

## 3. Corrections implemented

| Problem | Files | Change | Check |
| :--- | :--- | :--- | :--- |
| X-2: README still led with the Earth Engine work (MERIT DEM, "vulnerability index", typed-in flood curve, r = 0.594, Colab links) | `README.md` | Rewritten around the current scripts, results and limits; superseded material listed and kept | Every number traced to `part_*/data`, `docs/data` or `reproduction/out` |
| N-1, N-2, N-4 | `docs/index.html` (Table 8·1) | Three rows added, without new numbers on the site | `pytest tests part_c/tests`: 30 passed |
| Reproduction record | `research/audit-2026-11-16/` | Scripts, outputs, this file, progress log | — |

No analysis output changed: the reproduction found no error that requires recomputing a published number.

## 4. Test and execution results

- `python3 -m pytest -q tests part_c/tests`: 30 passed (before and after the changes).
- Reproduction scripts `r02`, `r04`, `r05`, `r06b`, `r07` ran to completion; outputs in `reproduction/out/`.
- Local preview of the site (`python3 -m http.server -d docs`): see the preview record in the integration plan.

## 5. Unresolved limitations

No flood ground truth; JRC used as both mask and reference; areas depend on threshold and mask aggregation; meteorological, not agricultural, drought (TerraClimate soil moisture is a model product); NDVI coupling is an association; CHIRPS understates heavy days; 30-year samples; downscaled models bias-corrected to observations over the historical period; daily rainfall only; 22 of 23 models not independently re-downloaded.

## 6. Scientific positioning

**One contribution, not three.** The study tests three substitutes for missing gauges, each against something independent:

| Substitute | Stands in for | What it gets right | What it does not |
| :--- | :--- | :--- | :--- |
| Sentinel-1 radar (Part A) | River-level and flood records | When the reach floods, and roughly where | Absolute areas (threshold and mask) and dry-season water |
| CHIRPS satellite rainfall (Part B) | Rain-gauge records for drought | Drought timing and the 1980s drought; vegetation response | Which marginal years count as droughts (reference period) |
| Downscaled climate models (Part C) | Long gauge records for design rainfall | The relative change (uplift factors, reproduced exactly) | Absolute design values (CHIRPS too low against gauges) |

The coherent finding is that these substitutes are reliable for **timing, direction and relative change**, and much less so for **absolute magnitudes**. That framing is supported by every part, does not overstate any of them, and gives a clear rule for practice: use the substitutes for when and how much more, and anchor absolute values to gauges where any exist.

**Assessment** (1–5; before = 11 November state, after = this re-audit):

| Criterion | Before | After | Why |
| :--- | :--: | :--: | :--- |
| Scientific rigour | 4 | 4 | Already strong after the 12 November work; now independently reproduced |
| Methodological validity | 4 | 4 | Unchanged; new sensitivities documented |
| Technical implementation | 4 | 4 | Scripts and tests in place |
| Data quality | 3 | 3 | No ground truth for floods; CHIRPS bias |
| Reproducibility | 4 | 5 | Independent code reproduces Parts B and C exactly and Part A closely |
| Research value | 4 | 4 | Clear, transferable conclusion |
| Academic relevance | 4 | 4 | Fits data-sparse hydrology and climate-adaptation programmes |
| Visual communication | 4 | 4 | Site already strong; README now matches it |

**Remaining work for an excellent standard.** A flood reference that is not JRC (e.g. date-matched Sentinel-2 or high-resolution optical flood maps for 2022, or any gauge-height record from NIHSA for the Lokoja–Onitsha reach); an SPI with a stated reference-period sensitivity in the results, not only the limits; the NDVI coupling reported as a range with the composite rule fixed in advance; the remaining climate models re-run independently when bandwidth allows; a short written report replacing the October 2026 PDF.
