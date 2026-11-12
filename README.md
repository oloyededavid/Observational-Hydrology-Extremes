# Cloud-Native Observational Hydrology in Data-Sparse Catchments

![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)
![Google Earth Engine](https://img.shields.io/badge/Google%20Earth%20Engine-Cloud%20API-4285F4?logo=googleearth&logoColor=white)
![Geospatial Stack](https://img.shields.io/badge/GIS-Rasterio%20%7C%20GeoPandas%20%7C%20SciPy-success)
![Platform](https://img.shields.io/badge/Execution-Google%20Colab-F9AB00?logo=googlecolab&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

**Author:** David Oloyede  
**Specialization:** Environmental Remote Sensing & Geospatial Information Systems  

---



## Overview

Across West Africa, ground-based weather and river monitoring stations are sparse just as climate extremes are intensifying. This project addresses that data gap through a two-part, cloud-native Earth Observation portfolio modeling opposite ends of the regional water cycle across transboundary river basins:


* **Part A — Flood Hydrodynamics (Lower Niger-Benue Basin):** Uses Sentinel-1 Synthetic Aperture Radar (SAR) and MERIT DEM topography to bypass heavy monsoon cloud cover, mapping inundation frequency over six seasons (2018–2023) with a fixed -18 dB VH threshold, and a floodplain vulnerability index that multiplies that frequency by a low-elevation term; the seasonal flood-pulse curve is typed in, not computed, and nothing is validated against flood records.


* **Part B — Drought & Eco-Hydrological Coupling (Sokoto-Rima Basin):** Integrates 25 years (2000–2025) of CHIRPS precipitation and MODIS NDVI time-series across the semi-arid Sudano-Sahelian zone to quantify rainfall volatility (CV), a z-score of annual rainfall totals (an approximation of the Standardized Precipitation Index), and the correlation between annual NDVI and rainfall ($r = 0.594, p = 0.0014$; both series are undetrended and share the Sahel recovery trend, so the correlation may partly reflect that trend).

---

## Complete Portfolio Documentation

* **Full Written Report (Part A & Part B Combined):** [View Complete PDF](documents/Observational%20Hydrology%20in%20Data-Sparse%20Catchments%20A%20AND%20B.pdf)

---

## Module-by-Module Code Execution (Google Colab)

The analytical pipelines for this research are hosted in interactive Google Colab environments for browser-based reproduction.

* **Part A (Lower Niger-Benue Basin):** Sentinel-1 SAR flood pulse extraction, inundation frequency, and hydro-geomorphic vulnerability.  
  [Open Part A Colab Notebook](https://colab.research.google.com/drive/1-j9tGSStRQJyD_uylA_-HPH7nATFKGX8#scrollTo=kYW3s4lnvw7a)

* **Part B (Sokoto-Rima Basin):** Multi-decadal precipitation CV vulnerability, z-score drought classification of annual rainfall, and the correlation of annual NDVI with rainfall ($r = 0.594, p = 0.0014$; undetrended, so it may reflect a shared trend).  
  [Open Part B Colab Notebook](https://colab.research.google.com/drive/1_Em3EWTjQ9zbgQWf3ppezo_V_6Vpfbyt)

---

## Selected Visual Synthesis

Below is a curated preview showing 4 of the 14 cartographic maps and statistical plots produced in this study. The complete figure sets are embedded in the full PDF report and archived in the [Part A Figures (6 outputs)](part_a/figures/) and [Part B Figures (8 outputs)](part_b/figures/) folders.

| Part A: Niger-Benue Flood Hydrodynamics | Part B: Sokoto-Rima Drought Dynamics |
| :---: | :---: |
| ![Dual State Hydrology](part_a/figures/Dual%20State%20Hydrology.jpg) <br> *Sentinel-1 SAR Dual-State Inundation* | ![Drought Vulnerability Map](part_b/figures/sokoto_rima_drought_vulnerability_map.png) <br> *Multi-Decadal Precipitation CV Vulnerability* |
| ![Flood Pulse Curve](part_a/figures/Catchment%20Seasonal%20Flood%20Pulse%20Curve%20%28Empirical%29.png) <br> *Catchment Seasonal Flood Pulse (illustrative: the twelve values are typed into the notebook, not computed from imagery)* | ![Hydro-Climatic Coupling](part_b/figures/sokoto_rima_hydro_climatic_coupling.png) <br> *MODIS NDVI & Rainfall Eco-Hydrological Coupling* |

---

## Methodological Architecture & Technical Stack

| Pipeline Stage | Core Analytical Process | Technologies & Sensor Archives |
| :--- | :--- | :--- |
| **01 / Cloud Ingestion** | Server-side spatial and temporal reduction, radar speckle filtering, and optical cloud masking. | `Google Earth Engine API` · `Sentinel-1 SAR` · `CHIRPS` · `MODIS MOD13Q1` |
| **02 / Terrain & Array Modeling** | Backscatter water thresholding, drainage height normalization, and floodplain cross-section profiling. | `Rasterio` · `GeoPandas` · `Shapely` · `MERIT DEM` · `WWF HydroSHEDS` |
| **03 / Statistical Diagnostics** | Standardized anomaly indexing (z-scores of annual rainfall and annual mean NDVI; this is not a gamma-fitted SPI), spatial `CV` surfaces, and correlation modeling. | `SciPy` · `NumPy` · `Pandas` |
| **04 / Cartographic Synthesis** | Multi-panel planar projection rendering, seasonal flood-pulse curves, and vulnerability mapping. | `Cartopy` · `Matplotlib` · `QGIS` · `ArcGIS Pro` |

---

## Research Reflection

Working on hydrological problems in Nigeria quickly forces you to deal with missing ground data. River gauges are sparse, and during the peak rainy season, heavy cloud cover makes standard optical satellite imagery almost useless for tracking floods. Putting these two workflows together was a practical way to work around those limits. Pairing radar data in the south with long-term rainfall and vegetation records in the north showed me how much insight we can pull from public satellite archives when local monitoring networks fall short. 
