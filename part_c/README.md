# Part C: design rainfall under future climate

How much do climate-model projections change the rainfall extremes that drainage and dam design use, in
the two study areas of Parts A and B?

- **Floods side:** the daily rainfall with a 2-, 10-, 25-, 50- and 100-year return period, on the Lower
  Niger-Benue reach (Part A box) and in the Sokoto-Rima basin (Part B basin).
- **Drought side:** the longest run of days below 1 mm in June-September, Sokoto-Rima basin.
- **Engineering output:** an uplift factor, future return level divided by present, with its
  uncertainty, to multiply a present-day design value by.

## Data

| Data | Use | Access |
| :--- | :--- | :--- |
| CHIRPS v2.0 daily, 0.25° (Funk et al., 2015) | Present-day extremes, 1985-2014; reference for the models | data.chc.ucsb.edu, no login |
| NEX-GDDP-CMIP6 (Thrasher et al., 2022), 23 models, 0.25° | Historical 1950-1980 and 1985-2014; SSP2-4.5 and SSP5-8.5, 2041-2070 | Public AWS bucket `nex-gddp-cmip6`, no login |
| GHCN-Daily (Menne et al., 2012): Birni N'Konni, Maradi | Independent check of the models, 1950-1980 | Public AWS bucket `noaa-ghcn-pds` |
| HydroBASINS level 4 (Lehner & Grill, 2013) | Sokoto-Rima outline (unit 1040760290, as in Part B) | data.hydrosheds.org |

**Why CHIRPS is the reference and not gauges.** A search of every GHCN-Daily station in Nigeria and Niger
found none inside the Part A reach and two inside the Sokoto-Rima basin, both in Niger. Their records
are complete to 1980 and nearly empty afterwards; the Nigerian synoptic stations in GHCN report a median
of 1 to 15 days per rainy season after 1981. So no gauge overlaps CHIRPS (1981 onwards), and the planned
satellite-against-gauge test was not possible. The two Niger gauges are used where they do overlap: the
models' historical run, 1950-1980.

**Models.** One model per CMIP6 institution, preferring the physical model where an institution also
has an Earth-system variant, so no centre counts twice: ACCESS-CM2, ACCESS-ESM1-5, BCC-CSM2-MR, CESM2,
CMCC-CM2-SR5, CNRM-CM6-1, CanESM5, EC-Earth3, FGOALS-g3, GFDL-CM4, GISS-E2-1-G, HadGEM3-GC31-LL,
IITM-ESM, INM-CM5-0, IPSL-CM6A-LR, KACE-1-0-G, KIOST-ESM, MIROC6, MPI-ESM1-2-HR, MRI-ESM2-0, NESM3,
NorESM2-MM, TaiESM1. The newest file version on the bucket (v2.0, then v1.1) is used for each year.

## Method

1. Each 0.25° cell whose centre lies in a study area is kept (27 cells on the reach, 245 in the basin).
2. Per cell and year: annual maximum daily rainfall, and the longest June-September run below 1 mm.
   Model calendars (365, 366 or 360 days) are handled when finding June-September.
3. Per cell: GEV fitted by L-moments (Hosking, 1990), return levels for 2-100 years (`extremes.py`).
4. Per model: uplift factor = 2041-2070 return level / 1985-2014 return level, cell by cell, summarised
   by the median over the cells. A ratio within each model removes much of that model's remaining bias.
5. Uncertainty: 500 bootstrap resamples of the 30 years in each period, the same years for every cell,
   per model; draws pooled over models with equal weight; 5-95% reported. The spread of the models'
   point estimates (10-90%) and the number of models projecting an increase are reported too.
6. Design rainfall 2041-2070 = CHIRPS 1985-2014 return level x uplift factor.

## Run

```bash
pip install numpy scipy h5py pyshp shapely pyproj pytest
python part_c/scripts/c01_domains.py      # outlines and cells
python part_c/scripts/c02_nexgddp.py 10   # about 2,800 files, 500 GB streamed; 2 to 4 hours; resumable
python part_c/scripts/c03_chirps.py       # 44 files
python part_c/scripts/c04_gauges.py
python part_c/scripts/c05_analysis.py
python -m pytest part_c/tests
python tools/build_site_data.py           # copies results to docs/data/ for the website
```

Downloads are cut to the two study-area boxes and kept in `part_c/cache/` (not committed). Results:
`part_c/data/results.json`, `cells_results.json`, `model_table.csv`, `gauges.json`.

## Limits

- Daily rainfall only: no sub-daily intensity-duration-frequency curves.
- Rainfall design only: flow design needs discharge, which is not available.
- CHIRPS smooths and understates heavy daily rain and blends in some station data, so present-day design
  values are uncertain by tens of percent; apply the uplift factor to a gauge-based value where one exists.
- NEX-GDDP-CMIP6 is bias-corrected toward an observed dataset over the historical period, so agreement
  with CHIRPS partly reflects that correction.
- 50- and 100-year values extrapolate well beyond 30 years of data.
