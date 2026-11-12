"""Write the corrected v2 notebooks for Parts A and B. Run: python tools/make_notebooks.py"""
import json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def nb(cells):
    out = []
    for kind, src in cells:
        c = {"cell_type": kind, "metadata": {}, "source": src.strip("\n").splitlines(keepends=True)}
        if kind == "code":
            c.update(execution_count=None, outputs=[])
        out.append(c)
    return {"cells": out, "metadata": {"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
            "language_info": {"name": "python"}, "colab": {"provenance": []}}, "nbformat": 4, "nbformat_minor": 5}


SETUP = '''
# Set your own Earth Engine Cloud project here
GEE_PROJECT = "YOUR-EARTH-ENGINE-PROJECT"

import os, json
import ee
import numpy as np
import pandas as pd
from scipy import stats

try:
    ee.Initialize(project=GEE_PROJECT)
except Exception:
    ee.Authenticate()
    ee.Initialize(project=GEE_PROJECT)

OUT = "outputs"
os.makedirs(OUT, exist_ok=True)
print("Earth Engine ready; results will be written to", os.path.abspath(OUT))
'''

DOWNLOAD = '''
# In Colab: download the outputs folder, then commit its files to {path} in the repository.
import shutil
shutil.make_archive("{name}", "zip", OUT)
try:
    from google.colab import files
    files.download("{name}.zip")
except ImportError:
    print("Not in Colab: the results are in", os.path.abspath(OUT))
'''

part_a = nb([
    ("markdown", '''
# Part A, version 2: flood extent on the Lower Niger-Benue reach, computed from Sentinel-1

This notebook replaces the parts of `waves_niger_benue_hydrodynamics.ipynb` that a review in
November 2026 found unsupported. The original notebook is kept unchanged because the October 2026
report refers to it.

What changes:
1. **The seasonal flood curve is computed**, month by month for 2018-2023, from Sentinel-1 imagery. The
   original curve was twelve numbers typed into the notebook.
2. **The comparison with JRC Global Surface Water is computed** here. The report's 99.36% recall had no code.
3. **Each map and number states its basis**: a fixed -18 dB threshold on VH backscatter (sigma0, as
   Earth Engine serves Sentinel-1 GRD), slope below 5 degrees, and permanent water (JRC occurrence of 90%
   or more) removed from the flood area. The number of images behind each month is recorded.

Run every cell in order, then download `part_a_outputs.zip` (last cell) and commit its files to
`part_a/outputs/`. The website reads them from there.

Nothing here is validated against gauged discharge or mapped flood records, because none were found
for this reach.
'''),
    ("code", SETUP),
    ("code", '''
ROI = ee.Geometry.BBox(6.50, 5.80, 7.30, 8.00)   # Lokoja to Ogbaru, as in the original notebook
THRESHOLD_DB = -18.0                              # fixed VH threshold, as in the original notebook
SCALE = 30                                        # metres, for area sums

slope = ee.Terrain.slope(ee.Image("MERIT/Hydro/v1_0_1").select("elv"))
jrc = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
permanent = jrc.select("occurrence").unmask(0).gte(90)

s1 = (ee.ImageCollection("COPERNICUS/S1_GRD")
      .filterBounds(ROI)
      .filter(ee.Filter.eq("instrumentMode", "IW"))
      .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VH"))
      .select("VH"))

def water(img):
    """Water where smoothed VH is below the threshold on gentle slopes."""
    return img.focal_median(1.5, "circle", "pixels").lt(THRESHOLD_DB).And(slope.lt(5))

def area_km2(mask):
    v = mask.selfMask().multiply(ee.Image.pixelArea()).reduceRegion(
        reducer=ee.Reducer.sum(), geometry=ROI, scale=SCALE, maxPixels=1e11, tileScale=4).values().get(0)
    return ee.Number(ee.Algorithms.If(v, v, 0)).divide(1e6)
'''),
    ("markdown", "## 1. Monthly flood extent, 2018-2023 (replaces the typed-in curve)"),
    ("code", '''
rows = []
for year in range(2018, 2024):
    for month in range(1, 13):
        start = ee.Date.fromYMD(year, month, 1)
        col = s1.filterDate(start, start.advance(1, "month"))
        n = col.size().getInfo()
        if n == 0:
            rows.append(dict(year=year, month=month, n_images=0, water_km2=np.nan, flood_km2=np.nan))
            continue
        w = water(col.median())
        rows.append(dict(year=year, month=month, n_images=n,
                         water_km2=area_km2(w).getInfo(),
                         flood_km2=area_km2(w.And(permanent.Not())).getInfo()))
    print(year, "done")
monthly = pd.DataFrame(rows)
monthly.to_csv(f"{OUT}/flood_monthly_2018_2023.csv", index=False)
clim = monthly.groupby("month")["flood_km2"].agg(["mean", "min", "max", "count"]).reset_index()
clim.to_csv(f"{OUT}/flood_pulse_climatology.csv", index=False)
clim
'''),
    ("code", '''
import matplotlib.pyplot as plt
fig, ax = plt.subplots(figsize=(9, 4.5))
ax.fill_between(clim["month"], clim["min"], clim["max"], color="#9ecae1", alpha=0.6, label="range 2018-2023")
ax.plot(clim["month"], clim["mean"], color="#08519c", marker="o", label="mean 2018-2023")
ax.set_xticks(range(1, 13)); ax.set_xticklabels(list("JFMAMJJASOND"))
ax.set_ylabel("Flooded area outside permanent water (km²)")
ax.set_title("Monthly flood extent, Lokoja to Ogbaru, from Sentinel-1 (computed)")
ax.legend(frameon=False); ax.grid(alpha=0.3)
plt.tight_layout(); plt.savefig(f"{OUT}/flood_pulse_computed.png", dpi=200); plt.show()
'''),
    ("markdown", '''
## 2. Inundation frequency, August-November 2018-2023

Frequency is the share of wet-season images in which a pixel is water. It depends on how many images
cover each pixel, so that count is exported with it.
'''),
    ("code", '''
wet = s1.filter(ee.Filter.calendarRange(2018, 2023, "year")).filter(ee.Filter.calendarRange(8, 11, "month"))
freq = wet.map(lambda i: water(i).rename("w")).mean().multiply(100).rename("frequency")
count = wet.count().rename("n_images")
stats_freq = freq.addBands(count).reduceRegion(ee.Reducer.percentile([5, 50, 95]), ROI, 100, maxPixels=1e10).getInfo()
summary = {"n_wet_season_images": wet.size().getInfo(),
           "area_ever_water_km2": area_km2(freq.gt(0)).getInfo(),
           "area_water_half_the_time_km2": area_km2(freq.gte(50)).getInfo(),
           "percentiles": stats_freq}
summary
'''),
    ("markdown", '''
## 3. Comparison with JRC Global Surface Water (replaces the uncomputed 99.36% recall)

JRC Global Surface Water v1.4 (Pekel et al., 2016) maps water from Landsat, 1984-2021. Two checks:
- **Dry-season water**: Sentinel-1 water in January-March, 2018-2021, against JRC pixels that are water
  at least half the time (occurrence of 50% or more).
- **Largest extent**: pixels ever water in Sentinel-1, August-November 2018-2021, against JRC maximum extent.

Recall is the share of JRC water that Sentinel-1 also finds; precision is the share of Sentinel-1 water
that JRC also maps. JRC is another satellite product, not ground truth, so agreement is a consistency
check, not validation.
'''),
    ("code", '''
dry = s1.filterDate("2018-01-01", "2022-01-01").filter(ee.Filter.calendarRange(1, 3, "month"))
s1_dry = water(dry.median())
jrc_half = jrc.select("occurrence").unmask(0).gte(50)
wet21 = s1.filterDate("2018-01-01", "2022-01-01").filter(ee.Filter.calendarRange(8, 11, "month"))
s1_ever = wet21.map(lambda i: water(i).rename("w")).max()
jrc_max = jrc.select("max_extent").unmask(0).eq(1)

def agreement(s1_mask, jrc_mask):
    a_s1, a_jrc, a_both = (area_km2(m).getInfo() for m in (s1_mask, jrc_mask, s1_mask.And(jrc_mask)))
    return {"s1_km2": a_s1, "jrc_km2": a_jrc, "both_km2": a_both,
            "recall": a_both / a_jrc if a_jrc else None, "precision": a_both / a_s1 if a_s1 else None}

jrc_check = {"dry_season_vs_occurrence50": agreement(s1_dry, jrc_half),
             "wet_season_ever_vs_max_extent": agreement(s1_ever, jrc_max),
             "n_dry_images": dry.size().getInfo(), "n_wet_images": wet21.size().getInfo()}
json.dump({"settings": {"roi": [6.50, 5.80, 7.30, 8.00], "threshold_db": THRESHOLD_DB, "slope_max_deg": 5,
                        "permanent_water": "JRC occurrence >= 90", "scale_m": SCALE},
           "frequency": summary, "jrc": jrc_check}, open(f"{OUT}/part_a_results.json", "w"), indent=1)
jrc_check
'''),
    ("code", DOWNLOAD.format(path="part_a/outputs/", name="part_a_outputs")),
])

part_b = nb([
    ("markdown", '''
# Part B, version 2: drought index and rainfall-vegetation link in the Sokoto-Rima basin

This notebook replaces the parts of `sokoto_rima_drought.ipynb` that a review in November 2026 found
wrong. The original notebook is kept unchanged because the October 2026 report refers to it.

What changes:
1. **SPI is gamma-fitted** (McKee et al., 1993): a gamma distribution is fitted to annual rainfall totals
   and each year's probability is converted to a standard normal value. The original "SPI" was a z-score.
2. **The NDVI-rainfall correlation is reported raw, detrended and on year-to-year differences**, because
   both series rise with the Sahel recovery and a shared trend inflates a raw correlation.
3. **NDVI uses quality-screened MOD13Q1** (250 m, SummaryQA 0-1), averaged over the growing season
   (July-October) of complete years only. The original averaged every composite of the year without
   quality screening, and included the partial year 2000.
4. Years are calendar years, and the unused machine-learning imports are gone.

Run every cell, then download `part_b_outputs.zip` (last cell) and commit its files to `part_b/outputs/`.
'''),
    ("code", SETUP),
    ("code", '''
basin = ee.Feature(ee.FeatureCollection("WWF/HydroSHEDS/v1/Basins/hybas_4")
                   .filterBounds(ee.Geometry.Point([5.23, 13.06])).first())
print("HydroBASINS unit:", basin.get("HYBAS_ID").getInfo())   # expected 1040760290
GEOM = basin.geometry()
YEARS = list(range(2001, 2025))   # complete years of MODIS
'''),
    ("markdown", "## 1. Annual rainfall and gamma-fitted SPI (CHIRPS daily)"),
    ("code", '''
chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
rain = []
for y in range(1981, 2025):
    tot = chirps.filterDate(f"{y}-01-01", f"{y+1}-01-01").sum().reduceRegion(
        ee.Reducer.mean(), GEOM, 5566, maxPixels=1e10).get("precipitation").getInfo()
    rain.append(dict(year=y, rain_mm=tot))
rain = pd.DataFrame(rain)

def spi_gamma(x, ref):
    """SPI by McKee et al. (1993): gamma fitted to the reference years, then mapped to a standard normal."""
    a, loc, scale = stats.gamma.fit(ref, floc=0)
    return stats.norm.ppf(stats.gamma.cdf(x, a, loc=0, scale=scale)), (a, scale)

rain["spi"], (shape_, scale_) = spi_gamma(rain["rain_mm"], rain.loc[rain.year.between(1991, 2020), "rain_mm"])
rain["z_score_old_method"] = (rain["rain_mm"] - rain["rain_mm"].mean()) / rain["rain_mm"].std()
rain.to_csv(f"{OUT}/rain_spi_1981_2024.csv", index=False)
print(f"gamma shape {shape_:.1f}, scale {scale_:.2f}; reference 1991-2020")
rain.tail()
'''),
    ("markdown", "## 2. Growing-season NDVI (MOD13Q1, quality-screened)"),
    ("code", '''
def ndvi(img):
    return img.select("NDVI").updateMask(img.select("SummaryQA").lte(1)).multiply(0.0001).copyProperties(img, ["system:time_start"])

mod = ee.ImageCollection("MODIS/061/MOD13Q1").map(ndvi)
veg = []
for y in YEARS:
    gs = mod.filterDate(f"{y}-07-01", f"{y}-11-01").mean().reduceRegion(ee.Reducer.mean(), GEOM, 1000, maxPixels=1e10).get("NDVI").getInfo()
    yr = mod.filterDate(f"{y}-01-01", f"{y+1}-01-01").mean().reduceRegion(ee.Reducer.mean(), GEOM, 1000, maxPixels=1e10).get("NDVI").getInfo()
    veg.append(dict(year=y, ndvi_growing_season=gs, ndvi_annual_mean=yr))
veg = pd.DataFrame(veg)
veg.to_csv(f"{OUT}/ndvi_2001_2024.csv", index=False)
veg.tail()
'''),
    ("markdown", '''
## 3. Rainfall-NDVI correlation: raw, detrended and differenced

Detrending removes a straight-line trend from each series; differencing compares each year with the one
before. If the raw correlation is much stronger than the other two, most of it comes from the shared
trend rather than from year-to-year response of vegetation to rain.
'''),
    ("code", '''
from scipy.signal import detrend
m = rain.merge(veg, on="year")
x, y = m["rain_mm"].to_numpy(), m["ndvi_growing_season"].to_numpy()
def corr(a, b):
    r, p = stats.pearsonr(a, b); rho, ps = stats.spearmanr(a, b)
    return {"pearson_r": r, "pearson_p": p, "spearman_rho": rho, "spearman_p": ps, "n": len(a)}
result = {"years": [int(m.year.min()), int(m.year.max())],
          "raw": corr(x, y), "detrended": corr(detrend(x), detrend(y)), "differenced": corr(np.diff(x), np.diff(y)),
          "trend_rain_mm_per_year": stats.linregress(m.year, x).slope,
          "trend_ndvi_per_decade": 10 * stats.linregress(m.year, y).slope,
          "spi_reference": "1991-2020", "ndvi": "MOD13Q1 SummaryQA<=1, July-October mean"}
json.dump(result, open(f"{OUT}/part_b_results.json", "w"), indent=1, default=float)
pd.DataFrame({k: result[k] for k in ("raw", "detrended", "differenced")}).T
'''),
    ("code", DOWNLOAD.format(path="part_b/outputs/", name="part_b_outputs")),
])

json.dump(part_a, open(os.path.join(ROOT, "part_a", "niger_benue_flood_v2.ipynb"), "w"), indent=1)
json.dump(part_b, open(os.path.join(ROOT, "part_b", "sokoto_rima_drought_v2.ipynb"), "w"), indent=1)
print("written")
