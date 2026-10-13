# Cloud-Native Observational Hydrology in Data-Sparse Catchments

![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)
![Google Earth Engine](https://img.shields.io/badge/Google%20Earth%20Engine-Cloud%20API-4285F4?logo=googleearth&logoColor=white)
![Geospatial Stack](https://img.shields.io/badge/GIS-Rasterio%20%7C%20GeoPandas%20%7C%20SciPy-success)
![Platform](https://img.shields.io/badge/Execution-Google%20Colab-F9AB00?logo=googlecolab&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

**Author:** David Oloyede  
**Research Focus:** Hydro-Climatic Extremes, Microwave & Optical Remote Sensing, Eco-Hydrological Modeling  

---

## 📌 Upfront Portfolio Structure: The Two Research Parts
This repository is organized into **two independent yet complementary analytical modules** examining opposite ends of the hydro-climatic extreme spectrum across transboundary West African river basins:

* **🌊 Part A — Acute Flood Hydrodynamics (Lower Niger-Benue Basin):** Utilizes cloud-penetrating Sentinel-1 Synthetic Aperture Radar (SAR) and MERIT DEM hydro-conditioning to model seasonal flood-pulse propagation, 5-year inundation frequency surfaces, and floodplain topographic vulnerability across the Niger-Benue confluence zone.
* **☀️ Part B — Multi-Decadal Drought & Eco-Hydrological Coupling (Sokoto-Rima Basin):** Integrates 40+ years of CHIRPS satellite precipitation with MODIS NDVI time-series across the semi-arid Sudano-Sahelian zone to quantify inter-annual rainfall volatility (CV), Standardized Precipitation Index (SPI) drought regimes, and vegetation-climate coupling ($r = 0.594, p = 0.0014$).

---

## 📑 Table of Contents
1. [Research Objectives & Study Areas](#-research-objectives--study-areas)
2. [Complete Portfolio Documentation & Live Code](#-complete-portfolio-documentation--live-code)
3. [Selected Visual Synthesis (Curated Preview)](#-selected-visual-synthesis-curated-preview)
4. [Satellite Data Sources & Sensor Specifications](#-satellite-data-sources--sensor-specifications)
5. [Methodological Architecture & Technical Stack](#-methodological-architecture--technical-stack)

---

## 🎯 Research Objectives & Study Areas

### Part A: Lower Niger-Benue River Basin (Humid/Sub-Humid Fluvial Corridor)
* **Study Extent:** The lower alluvial corridor and confluence zone of the Niger and Benue rivers, characterized by intense monsoonal stage fluctuations and persistent cloud cover during peak discharge.
* **Core Objectives:**
  * Bypass monsoonal optical cloud occlusion using C-band Sentinel-1 SAR backscatter thresholding (`VV`/`VH`) to delineate dry-baseline versus peak-monsoon open water extents.
  * Construct a 5-year multi-temporal inundation frequency surface and empirical seasonal flood-pulse curve.
  * Couple SAR flood extents with Height Above Nearest Drainage (HAND) and topographic flow conditioning to isolate high-risk hydro-geomorphic vulnerability hotspots.

### Part B: Sokoto-Rima River Basin (Sudano-Sahelian Dryland Catchment)
* **Study Extent:** Northwestern Nigeria/transboundary semi-arid catchment experiencing acute monsoonal concentration, high evaporative demand, and rain-fed agro-ecological sensitivity.
* **Core Objectives:**
  * Quantify multi-decadal precipitation climatology and spatial Coefficient of Variation (CV) to map structural rainfall instability across a latitudinal aridity gradient.
  * Classify historical meteorological wet and dry extremes using multi-temporal Standardized Precipitation Index (SPI) time-series.
  * Evaluate eco-hydrological coupling and vegetative stress response by correlating MODIS MOD13Q1 NDVI anomalies against hydro-climatic forcing.

---

## 📂 Complete Portfolio Documentation & Live Code

### 📄 Full Written Manuscript (Part A & Part B Combined)
* **Complete Technical Report:** [Download Complete PDF Report](documents/Observational%20Hydrology%20in%20Data-Sparse%20Catchments%20A%20AND%20B.pdf)

### 💻 Module-by-Module Code Execution (Google Colab)
* **Part A Pipeline (Lower Niger-Benue Flood Hydrodynamics):**  
  👉 [Open Part A Colab Notebook](https://colab.research.google.com/drive/1-j9tGSStRQJyD_uylA_-HPH7nATFKGX8#scrollTo=kYW3s4lnvw7a) | [Browse Part A Directory](part_a/)
* **Part B Pipeline (Sokoto-Rima Drought & Eco-Hydrology):**  
  👉 [Open Part B Colab Notebook](https://colab.research.google.com/drive/1_Em3EWTjQ9zbgQWf3ppezo_V_6Vpfbyt) | [Browse Part B Directory](part_b/)

---

## 🖼️ Selected Visual Synthesis (Curated Preview)
*Below is a curated 4-panel preview featuring 2 outputs from Part A and 2 outputs from Part B. This represents only a subset of the 14 high-resolution cartographic maps, hydraulic cross-sections, and statistical plots contained in the full PDF report and figure directories.*

| Part A: Lower Niger-Benue Flood Hydrodynamics | Part B: Sokoto-Rima Drought & Eco-Hydrology |
| :---: | :---: |
| ![Dual State Hydrology](part_a/figures/Dual%20State%20Hydrology.jpg) <br> *Figure A1: Sentinel-1 SAR Dual-State Inundation Extent* | ![Drought Vulnerability Map](part_b/figures/sokoto_rima_drought_vulnerability_map.png) <br> *Figure B1: Multi-Decadal Precipitation CV Vulnerability Surface* |
| ![Flood Pulse Curve](part_a/figures/Catchment%20Seasonal%20Flood%20Pulse%20Curve%20%28Empirical%29.png) <br> *Figure A2: Empirical Catchment Seasonal Flood Pulse Curve* | ![Hydro-Climatic Coupling](part_b/figures/sokoto_rima_hydro_climatic_coupling.png) <br> *Figure B2: MODIS NDVI & Rainfall Eco-Hydrological Coupling* |

* 📂 **Explore All 14 High-Resolution Figures:** [View All Part A Figures (6 Outputs)](part_a/figures/) | [View All Part B Figures (8 Outputs)](part_b/figures/)

---

## 🛰️ Satellite Data Sources & Sensor Specifications

| Dataset / Sensor | Provider / Source | Spatial / Temporal Spec | Analytical Purpose in Pipeline |
| :--- | :--- | :--- | :--- |
| **Sentinel-1 GRD (SAR)** | ESA / Copernicus (`COPERNICUS/S1_GRD`) | 10 m / 6–12 Day Repeat | Part A: Cloud-free active microwave flood extent & multi-year inundation frequency |
| **MERIT DEM & Hydro** | Yamazaki et al. (`MERIT/Hydro/v1_0_1`) | ~90 m (3 arc-second) | Part A & B: Topographic flow conditioning, HAND modeling, & floodplain cross-sections |
| **WWF HydroSHEDS** | WWF (`WWF/HydroSHEDS`) | Basin / Reach Vector & Raster | Part A & B: Catchment boundary delineation & fluvial network extraction |
| **CHIRPS Pentad / Daily** | UCSB / CHG (`UCSB-CHG/CHIRPS/PENTAD`) | 0.05° (~5.5 km) / Multi-Decadal | Part B: Monsoonal climatology, spatial CV vulnerability, & SPI drought classification |
| **MODIS MOD13Q1 (NDVI)** | NASA LP DAAC (`MODIS/061/MOD13Q1`) | 250 m / 16-Day Composite | Part B: Vegetative vigor anomalies, drought stress tracking, & rainfall-NDVI coupling |

---

## 🛠️ Methodological Architecture & Technical Stack

1. **Cloud-Native Ingestion & Preprocessing:** Automated spatial and temporal filtering, SAR speckle noise reduction, cloud/quality bitmasking (MODIS `SummaryQA`), and reprojection executed server-side via the **Google Earth Engine (GEE) Python API**.
2. **Raster Array & Hydro-Geomorphic Modeling:** Local numerical array transformation, hydraulic cross-section profiling, and multi-criteria vulnerability indexing using **NumPy**, **Rasterio**, and **GeoPandas**.
3. **Statistical & Time-Series Diagnostics:** Standardized anomaly standardization ($Z$-scores/SPI), Coefficient of Variation (CV) surface generation, and Pearson bivariate correlation modeling ($r, p$-value testing) implemented in **SciPy** and **Pandas**.
4. **Publication Cartography:** Automated multi-panel planar map rendering and time-series visualization engineered with **Matplotlib** and **Cartopy**.

---

