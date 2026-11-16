# Progress log: research audit, 16 November 2026

Working branch: `research-audit` (local only; nothing is pushed). Original files are kept; changes are recorded here.

## Log
- Phase 1 started. Read README.md and research/audit/D01-D03. Stages 1-3 of D03 were implemented on
  12 November 2026 (git log). Stage 4 (documentation reconciliation) was not: README.md still describes the
  superseded Earth Engine/Colab work.
- `pytest tests part_c/tests`: 30 passed (checks stored outputs, not recomputation). Data caches
  (`part_*/cache/`) are not in this checkout, so recomputation needs fresh downloads.
- Reproduction (own code, research/audit-2026-11-16/reproduction/; scripts r01-r03 were written by a helper agent
  that stopped at a usage limit, then reviewed and run here; r04-r05 written here):
  - Part B rainfall (r02): CHIRPS 1981-2024 basin totals match within 0.05 mm; annual SPI and SPI-3/6/12 within
    0.005 (rounding); drought events identical in start and length. New: the drought years depend on the SPI
    reference period (1985 and 2017 are drought years against 1991-2020, not against 1981-2024; the 1980s are
    drier than the reference), and the 48-month 1980s event is 35-74 months at thresholds -1.5 to -0.5.
    Gamma fit: KS p 0.78 naive, 0.38 with parameters re-estimated (Lilliefors bootstrap).
  - Part B NDVI (r04): published r 0.70 raw / 0.76 detrended / 0.73 differenced. Recomputed 0.65 / 0.67 / 0.65
    (same definition; 1 filled composite here vs 15 published), significant after a lag-1 autocorrelation
    adjustment (n_eff 11-27); leave-one-out r never below 0.49. Treating composites under 80 % valid pixels as
    missing raises r to 0.78 / 0.84 / 0.81. Rainfall has no significant 2001-2024 trend (p = 0.38), so a shared
    trend cannot explain the link. July-October rainfall gives a weaker r (0.61 / 0.58 / 0.55).
  - Part C present-day design rainfall (r05): own L-moment GEV reproduces all published CHIRPS return levels
    exactly (both areas, 2-100 years); MLE within 4 %; baseline 1995-2024 values match the published sensitivity.
  - Part A (r07; own reading of Sentinel-1 RTC overviews, Copernicus GLO-90 and JRC GSW v1.3 from Planetary
    Computer, March and October 2022 only): image counts identical (15, 16). Floodplain water at -18 dB:
    333.1 vs 337.6 km2 (March), 592.0 vs 627.0 km2 (October, -5.6 %). Otsu: -18.2 vs -18.25 dB (March),
    -18.0 vs -18.05 dB (October). The floodplain mask itself is 645.2 vs 707.7 km2: it depends on how the
    30 m JRC extent is aggregated to the 110 m grid (published: 1/2 overview then average; here: full
    resolution average). Flood areas therefore carry about 5-10 % resampling uncertainty that is not stated.
    (A first run counted JRC zeros as no data and inflated the mask to 1,055 km2; that bug was in the
    reproduction code and is fixed.)
  - Gauges (c04, read-only): both stations lie inside the Sokoto-Rima polygon; usable years 21 and 26
    (annual maxima), 24 and 27 (dry spells), 1950-1980, as stated.
  - README.md: numbers agree with the outputs (October floodplain mean 497.6 km2, max 627.0; JRC recall
    0.90-0.95, precision 0.37-0.51; NDVI r 0.70/0.76/0.73), but the text still leads with the superseded Earth
    Engine work (MERIT DEM, "vulnerability index", typed-in flood-pulse curve, r = 0.594, Colab links) and shows
    the legacy figures.
  - Part C climate models (r06, r06b; own HTTP-range reader of NEX-GDDP-CMIP6 and own L-moment GEV):
    MRI-ESM2-0, historical 1985-2014 and SSP5-8.5 2041-2070, both areas. Uplift factors (2-100 years), historical
    return-level bias against CHIRPS and the annual-maximum mean ratio all match the published values to four
    decimals. The second model (INM-CM5-0) was stopped: the bucket served about 4 minutes per model-year here,
    about 2 hours for one model; one exact match confirms the pipeline.
- Scientific review (separate agent) received; all findings addressed: positioning narrowed; n_eff capped at n
  (r04 rerun: all versions significant except differenced Jul-Oct rainfall, p = 0.059); README gives published and
  rebuilt NDVI r; site row on SPI reference corrected; "1.17" -> 1.16; dry-season false water from flood_monthly.csv
  (mean 901 km2, months 283-1,602); reproduction described as a re-implementation; reproducibility score 4.
- Second review round: MODIS reader fixed, reproduction code fixes, wording and score corrections, site numbering and phone navigation, Erasmus scorecard. See AUDIT_AND_REPAIR.md sections 8-9.
