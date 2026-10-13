# Cloud-Native Observational Hydrology in Data-Sparse Catchments

![Python](https://img.shields.io/badge/Python-3.10%2B-111111?style=flat-square&logo=python&logoColor=white)
![Google Earth Engine](https://img.shields.io/badge/Google_Earth_Engine-Cloud_API-111111?style=flat-square&logo=googleearth&logoColor=white)
![Spatial Stack](https://img.shields.io/badge/Spatial_Stack-Rasterio_%7C_GeoPandas_%7C_SciPy-111111?style=flat-square)
![Execution](https://img.shields.io/badge/Environment-Google_Colab-111111?style=flat-square&logo=googlecolab&logoColor=F9AB00)
![License](https://img.shields.io/badge/License-MIT-111111?style=flat-square)

**Author:** David Oloyede  
**Research Focus:** Hydro-Climatic Extremes, Microwave & Optical Remote Sensing, Eco-Hydrological Modeling  

---

## The Observational Imperative

> *Across West Africa, ground-based hydrometric gauge networks are decaying at the exact historical moment climate whiplash is accelerating. Basin authorities are left navigating blindly between two lethal regimes: catastrophic monsoonal inundation across humid alluvial corridors and multi-decadal ecological desiccation across the Sudano-Sahelian drylands.*

This repository bypasses reliance on sparse in-situ gauge stations by engineering an end-to-end, cloud-native Earth Observation architecture. By coupling cloud-penetrating Synthetic Aperture Radar (SAR) with four decades of optical-infrared and quasi-global precipitation records, this portfolio establishes a reproducible empirical baseline across both extremes of the regional water cycle.

---

## Bipartite Research Architecture

The research is structured into two independent, complementary analytical pipelines examining opposite ends of the hydro-climatic spectrum:

| Analytical Dimension | PART A: Acute Flood Hydrodynamics | PART B: Multi-Decadal Drought Coupling |
| :--- | :--- | :--- |
| **Target Catchment** | **Lower Niger-Benue Basin** (Humid Fluvial Confluence) | **Sokoto-Rima Basin** (Sudano-Sahelian Semi-Arid Dryland) |
| **Core Problem** | Persistent monsoonal cloud cover blinds optical sensors during peak catastrophic river stage. | Extreme inter-annual rainfall volatility destabilizes rain-fed agro-ecosystems across latitudinal gradients. |
| **Observational Physics** | Active C-Band Microwave (`Sentinel-1 SAR`) coupled with `MERIT DEM` hydro-topography. | 40+ year `CHIRPS` infrared-gauge precipitation paired with `MODIS MOD13Q1` vegetative reflectance. |
| **Key Analytical Output** | Dual-state flood pulse boundaries, 5-year inundation frequency, and hydro-geomorphic vulnerability hotspots. | Spatial rainfall volatility (`CV`), `SPI` meteorological drought regimes, and NDVI-rainfall coupling ($r = 0.594, p = 0.0014$). |
| **Interactive Pipeline** | [**Launch Part A in Google Colab**](https://colab.research.google.com/drive/1-j9tGSStRQJyD_uylA_-HPH7nATFKGX8#scrollTo=kYW3s4lnvw7a) | [**Launch Part B in Google Colab**](https://colab.research.google.com/drive/1_Em3EWTjQ9zbgQWf3ppezo_V_6Vpfbyt) |
| **Repository Directory** | [`/part_a`](part_a/) | [`/part_b`](part_b/) |

* **Complete Combined Manuscript (Part A & Part B):** [**Download Full Technical Report (PDF)**](documents/Observational%20Hydrology%20in%20Data-Sparse%20Catchments%20A%20AND%20B.pdf)

---

## Selected Visual Synthesis

*The 4-panel matrix below represents a curated subset of the portfolio's analytical outputs. The complete suite of 14 high-resolution cartographic surfaces, hydraulic cross-sections, and statistical diagnostics is available in the full PDF manuscript and inside the [Part A Figure Archive (6 Outputs)](part_a/figures/) and [Part B Figure Archive (8 Outputs)](part_b/figures/).*

| Part A: Lower Niger-Benue Flood Hydrodynamics | Part B: Sokoto-Rima Drought & Eco-Hydrology |
| :---: | :---: |
| ![Dual State Hydrology](part_a/figures/Dual%20State%20Hydrology.jpg) <br> **Figure A1:** *Sentinel-1 SAR Dual-State Inundation Extent* | ![Drought Vulnerability Map](part_b/figures/sokoto_rima_drought_vulnerability_map.png) <br> **Figure B1:** *Multi-Decadal Precipitation CV Vulnerability Surface* |
| ![Flood Pulse Curve](part_a/figures/Catchment%20Seasonal%20Flood%20Pulse%20Curve%20%28Empirical%29.png) <br> **Figure A2:** *Empirical Catchment Seasonal Flood Pulse Curve* | ![Hydro-Climatic Coupling](part_b/figures/sokoto_rima_hydro_climatic_coupling.png) <br> **Figure B2:** *MODIS NDVI & Rainfall Eco-Hydrological Coupling* |

---

## Methodological Architecture & Technical Stack

The computational workflow is designed to execute server-side planetary data reductions in the cloud before transitioning to client-side scientific Python arrays for statistical and cartographic rendering:

```text
[Orbital Archives: Sentinel-1 / CHIRPS / MODIS / MERIT DEM]
                         │
                         ▼
   ┌───────────────────────────────────────────┐
   │ 1. CLOUD INGESTION & RADIOMETRIC PREP     │  Google Earth Engine Python API
   │    • SAR thermal-noise & speckle filtering│  • Server-side spatial/temporal reduction
   │    • MODIS SummaryQA bitwise cloud masking│  • Coordinate reprojection & scale alignment
   └───────────────────────────────────────────┘
                         │
                         ▼
   ┌───────────────────────────────────────────┐
   │ 2. HYDRO-GEOMORPHIC & ARRAY MODELING      │  Rasterio | NumPy | GeoPandas | Shapely
   │    • Bimodal SAR backscatter thresholding │  • Topographic flow & HAND conditioning
   │    • Floodplain cross-sectional profiling │  • Multi-criteria vulnerability synthesis
   └───────────────────────────────────────────┘
                         │
                         ▼
   ┌───────────────────────────────────────────┐
   │ 3. STATISTICAL & TIME-SERIES DIAGNOSTICS  │  SciPy | Pandas | Matplotlib | Cartopy
   │    • Standardized Precipitation Index(SPI)│  • Spatial Coefficient of Variation (CV)
   │    • Standardized NDVI Z-score anomalies  │  • Bivariate Pearson coupling (r, p-value)
   └───────────────────────────────────────────┘
