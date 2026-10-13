# Cloud-Native Observational Hydrology in Data-Sparse Catchments
**Author:** David Oloyede  
**Specialization:** Environmental Remote Sensing & Geospatial Information Systems  

---

## Overview
This repository hosts a comprehensive, two-part environmental remote sensing and geospatial research portfolio engineered for transboundary, data-sparse river basins in West Africa. Utilizing cloud-native Google Earth Engine (GEE) pipelines, active microwave radar, optical indices, and digital elevation models, the research delivers rigorous empirical baselines for flood hydrodynamics, spatial drought vulnerability, and eco-hydrological coupling.

---

## 🖼️ Selected Visual Synthesis (Curated Preview)
*Below is a selected preview highlighting key spatial and statistical outputs from both basins. The complete suite of 14 high-resolution cartographic maps, topographic cross-sections, and time-series plots is embedded in the full PDF report and archived within the respective project folders.*

| Part A: Niger-Benue Flood Hydrodynamics | Part B: Sokoto-Rima Drought Dynamics |
| :---: | :---: |
| ![Dual State Hydrology](part_a/figures/Dual%20State%20Hydrology.jpg) <br> *Sentinel-1 SAR Dual-State Inundation* | ![Drought Vulnerability Map](part_b/figures/sokoto_rima_drought_vulnerability_map.png) <br> *Multi-Decadal Precipitation CV Vulnerability* |
| ![Flood Pulse Curve](part_a/figures/Catchment%20Seasonal%20Flood%20Pulse%20Curve%20%28Empirical%29.png) <br> *Empirical Catchment Seasonal Flood Pulse* | ![Hydro-Climatic Coupling](part_b/figures/sokoto_rima_hydro_climatic_coupling.png) <br> *MODIS NDVI & Rainfall Eco-Hydrological Coupling* |

* 📂 **Explore Full Figure Archives:** [View All Part A Figures (6 Maps & Charts)](part_a/figures/) | [View All Part B Figures (8 Maps & Charts)](part_b/figures/)

---

## 📂 Complete Portfolio Documentation

* **Full Written Report (Part A & Part B Combined):** [Download Complete PDF](documents/Observational%20Hydrology%20in%20Data-Sparse%20Catchments%20A%20AND%20B.pdf) 

---

## 💻 Module-by-Module Code Execution (Google Colab)
The analytical pipelines for this research are hosted in interactive Colab environments.

* **Part A (Lower Niger-Benue Basin):** Sentinel-1 SAR flood pulse extraction, inundation frequency, and hydro-geomorphic vulnerability.  
  👉 [Open Part A Colab Notebook](https://colab.research.google.com/drive/1-j9tGSStRQJyD_uylA_-HPH7nATFKGX8#scrollTo=kYW3s4lnvw7a)

* **Part B (Sokoto-Rima Basin):** Multi-decadal precipitation CV vulnerability, SPI meteorological drought classification, and MODIS NDVI eco-hydrological coupling ($r = 0.594, p = 0.0014$).  
  👉 [Open Part B Colab Notebook](https://colab.research.google.com/drive/1_Em3EWTjQ9zbgQWf3ppezo_V_6Vpfbyt)

---

## 🛠️ Core Technical Stack
* **Cloud Processing:** Google Earth Engine (GEE) Python API, Python SDK
* **Spatial Analysis & GIS:** GeoPandas, Rasterio, Shapely, Cartopy, QGIS / ArcGIS Pro
* **Numerical & Statistical Modeling:** NumPy, SciPy, Pandas
* **Primary Satellite Datasets:** Sentinel-1 SAR, CHIRPS Precipitation, MODIS MOD13Q1 NDVI, MERIT DEM, WWF HydroSHEDS

---
