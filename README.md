# Floods, drought and design rainfall where the gauges are missing (Nigeria)

**Author:** David Oloyede · **Website:** <https://oloyededavid.github.io/Observational-Hydrology-Extremes/> · **Licence:** MIT (code), CC BY 4.0 (derived data)

How far can open satellite records and climate models stand in for missing rain and river gauges in two Nigerian river systems? The study has three parts, each with its own question, data and independent check.

| Part | Question | Area | Main data | Independent check |
| :--- | :--- | :--- | :--- | :--- |
| A · Floods | When and how far does the reach flood? | Lower Niger–Benue reach (6.50–7.30 E, 5.80–8.00 N) | Sentinel-1 RTC radar, 2018–2023 | Sentinel-2 optical water, 2022 |
| B · Drought | How often and how badly has rainfall failed, and does vegetation follow? | Sokoto–Rima basin | CHIRPS rainfall 1981–2024; MODIS NDVI 2001–2024 | TerraClimate rainfall and soil moisture |
| C · Design rainfall | How much do climate models change the 25–100-year daily rainfall and the rainy-season dry spells by 2041–2070? | Both areas | NEX-GDDP-CMIP6 (23 models), CHIRPS | Two GHCN gauges, 1950–1980 |

Every number on the website is computed from the files in `docs/data/`, which [`tools/build_site_data.py`](tools/build_site_data.py) builds from the analysis outputs. No Earth Engine account is needed: all data are read from Microsoft Planetary Computer, the Climate Hazards Center, NASA's NEX-GDDP-CMIP6 bucket and NOAA's GHCN-Daily.

## Main results

**Part A.** Inside the floodplain, Sentinel-1 water rises from about 300 km² in the dry season to a September–October peak: 498 km² on average in October 2018–2023, at most 627 km² (October 2022), at a −18 dB VH threshold. A data-driven (Otsu) threshold has a median of −17.8 dB over the 72 months, so the choice of −18 dB is close to what the data support, but the same threshold also flags dry ground outside the floodplain as water in the dry season (901 km² on average in January–March 2018–2023, monthly values 283–1,602 km²), so areas are reported inside a floodplain mask only. In October–November 2022, Sentinel-2 optical imagery confirms 62 % of the radar water at −18 dB VH, and 71 % when water is required in both radar polarisations (VH and VV); radar finds 73–77 % of the Sentinel-2 water. Against JRC Global Surface Water, recall is 90–95 % and precision 37–51 %, but JRC also defines the floodplain mask, so that comparison is not independent.

**Part B.** SPI-3, -6 and -12 from gamma-fitted monthly CHIRPS (reference 1991–2020) place the longest drought in the early 1980s and show no drought of that length since. Growing-season NDVI follows rainfall: the published values are r = 0.70 raw, 0.76 after removing a linear trend from both series and 0.73 on year-to-year differences (2001–2024); an independent rebuild in November 2026 gave 0.65, 0.67 and 0.65, a difference not yet explained (it rests on which 16-day composites are filled). Rainfall itself has no significant trend over 2001–2024, so a shared trend does not explain the link. These are associations, not a demonstration that rainfall alone controls vegetation.

**Part C.** Present-day design rainfall from CHIRPS (GEV by L-moments, 1985–2014) is 68.8 mm for the 50-year day in the Lower Niger–Benue and 52.7 mm in the Sokoto–Rima. Under SSP5-8.5 the models' median 50-year uplift factor is 1.58 (10th–90th percentile of models 1.30–2.04) for the Lower Niger–Benue and 1.21 (1.01–1.46) for the Sokoto–Rima; under SSP2-4.5 it is 1.42 and 1.16. In the Sokoto–Rima the combined uncertainty (models and 30-year sampling) includes no change: 5–95 % range 0.92–1.69 under SSP5-8.5. The uplift factors are the more robust output: CHIRPS understates heavy days compared with the two gauges, and a 1995–2024 baseline instead of 1985–2014 raises the present-day 50-year value by 12 % in the Lower Niger–Benue.

## Limits that matter

- **No ground truth for floods.** There is no gauge, discharge or mapped flood record for the reach; flood areas are satellite estimates, checked against another satellite.
- **Threshold and mask.** Areas depend on the radar threshold (−16 to −22 dB changes the October area from 594 to 138 km²) and on how the 30 m JRC extent is aggregated to the 110 m grid (an independent rebuild in November 2026 gave a floodplain mask 9 % smaller, from aggregation alone, and October 2022 water 6 % lower, which also reflects a coarser radar overview and DEM).
- **Drought reference period.** Which years count as droughts depends on the SPI reference: against 1991–2020, 1985 and 2017 are drought years; against 1981–2024 they are not. The 1980s event lasts 35–74 months at thresholds from −1.5 to −0.5.
- **Vegetation coupling is sensitive to cloud handling.** Treating 16-day composites with less than 80 % clear pixels as missing changes the correlation to 0.78–0.84; an independent rebuild with the published definition gave 0.65–0.67. The link is positive in every version and significant in all but one (year-to-year differences against July–October rainfall, p = 0.06 after allowing for autocorrelation); its exact size is not fixed to two decimals.
- **Design rainfall.** 30-year samples make 100-year values extrapolations; the models are bias-corrected to observations over the historical period, so their agreement with CHIRPS is consistency, not independent skill; daily rainfall says nothing about sub-daily intensity or river discharge.

The full register of weaknesses and how each was treated is in [`research/audit/D02_scientific_loophole_register.md`](research/audit/D02_scientific_loophole_register.md); the November 2026 audit and independent reproduction are in [`research/audit-2026-11-16/`](research/audit-2026-11-16/).

## Repository

- `part_a/scripts/`, `part_b/scripts/`, `part_c/scripts/`: the current analysis, run in numbered order. Each script states its data source and output at the top.
- `part_*/data/`, `docs/data/`: analysis outputs and the website's data.
- `docs/`: the website (study page and explorer).
- `tests/`, `part_c/tests/`: checks on the outputs and the extreme-value code (`python3 -m pytest tests part_c/tests`).
- `research/audit/`: the November 2026 audit (D01–D03); `research/audit-2026-11-16/`: re-audit, independent reproduction and progress log.
- Superseded material, kept for the record: the Earth Engine notebooks (`part_a/*.ipynb`, `part_b/*.ipynb`), their figures (`part_a/figures/`, `part_b/figures/`, including a map titled "vulnerability hotspots" and a flood-pulse curve whose values were typed in, not computed) and the October 2026 PDF in `documents/`. Their figures and numbers are replaced by the scripts above.

## Reproduce

```bash
python3 -m pytest tests part_c/tests                       # checks on the stored outputs
python3 part_c/scripts/c03_chirps.py                        # downloads, then c05 and c06 for Part C
python3 part_a/scripts/a01_flood_pc.py                      # then a02-a04 for Part A
python3 part_b/scripts/b01_rain_spi.py                      # then b02-b04 for Part B
python3 tools/build_site_data.py                            # rebuild the website data
```

The download scripts write to `part_*/cache/` (not committed) and are resumable.
