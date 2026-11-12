# Data Sources and Licences

This repository reads public satellite datasets directly from Google Earth Engine. No large raw rasters are stored in Git.

1. **Sentinel-1 SAR GRD (`COPERNICUS/S1_GRD`):** European Space Agency (ESA) Copernicus Sentinel Data. 10 m ground range detected backscatter (VV polarization, IW mode). Open and free under Copernicus data licence.
2. **JRC Global Surface Water (`JRC/GSW1_4/GlobalSurfaceWater`):** Pekel et al. (2016), European Commission Joint Research Centre. 30 m water seasonality and occurrence (1984–2021). CC BY 4.0. Used only by the Part A version 2 notebook; the original notebook never loaded it.
3. **CHIRPS Daily / Pentad Precipitation (`UCSB-CHG/CHIRPS/DAILY`):** Funk et al. (2015), Climate Hazards Center, UC Santa Barbara. 0.05 degree (~5.5 km) gridded rainfall (1981–present). Public domain / open scientific use.
4. **MODIS Terra Vegetation Indices (`MODIS/061/MOD13Q1`):** NASA LP DAAC. 250 m, 16-day NDVI composites (2000–present), as used in the Part B notebooks. Open NASA Earthdata policy.
5. **FAO GAUL Administrative & Basin Boundaries (`FAO/GAUL/2015/level1`, `WWF/HydroSHEDS/v1/Basins/hybas_6`):** Food and Agriculture Organization / WWF HydroSHEDS.

## Part C (read outside Earth Engine)

6. **NEX-GDDP-CMIP6:** Thrasher et al. (2022), NASA. Daily precipitation, 0.25°, 23 models, historical (1950–2014) and SSP2-4.5 / SSP5-8.5 (2041–2070), from the public AWS bucket `nex-gddp-cmip6`. Licence: see the dataset's terms on the NASA Center for Climate Simulation.
7. **CHIRPS v2.0 daily, 0.25° (p25):** Climate Hazards Center, UC Santa Barbara, 1981–2024, from data.chc.ucsb.edu.
8. **GHCN-Daily:** Menne et al. (2012), NOAA. Stations NG000001075 (Birni N'Konni) and NG000001080 (Maradi), from the public AWS bucket `noaa-ghcn-pds`.
9. **HydroBASINS level 4 (Africa, v1c):** Lehner & Grill (2013), WWF. Sokoto-Rima unit 1040760290; file checked by SHA-256 in `part_c/scripts/c01_domains.py`.

The cut-down files are cached in `part_c/cache/` and not committed; the scripts download them again.
