"""Study-area boxes used to cut gridded data, in degrees (lon_min, lon_max, lat_min, lat_max).

Each box is a little larger than its study area so that every 0.25-degree cell touching the area is
kept; cells are later selected by the study-area polygons (see c01_domains.py).

- niger_benue: the reach studied in Part A, Lokoja to Ogbaru (Part A notebook: 6.50-7.30 E, 5.80-8.00 N).
- sokoto_rima: the Sokoto-Rima basin of Part B (HydroBASINS level-4 unit 1040760290, 3.74-9.44 E,
  11.22-16.15 N), which extends north into Niger.
"""
BOXES = {
    "niger_benue": (6.25, 7.50, 5.50, 8.25),
    "sokoto_rima": (3.50, 9.75, 11.00, 16.50),
}
PART_A_BOX = (6.50, 7.30, 5.80, 8.00)
