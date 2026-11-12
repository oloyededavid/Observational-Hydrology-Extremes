"""Part A, recomputed without Earth Engine: monthly flood extent 2018-2023, inundation frequency, and agreement
with JRC Global Surface Water, Lower Niger-Benue reach (6.50-7.30 E, 5.80-8.00 N).

Data, all from Microsoft Planetary Computer:
- Sentinel-1 RTC (radiometrically terrain-corrected gamma0, VH), 10 m, read at about 80 m from the files' overviews.
  The original notebook used Earth Engine's sigma0 GRD; on flat floodplain the two differ by about 1 dB.
- Copernicus DEM GLO-90 for the slope mask (the original used MERIT Hydro).
- JRC Global Surface Water v1.3 (1984-2020; Pekel et al., 2016). Earth Engine serves v1.4 (to 2021).

Method, as in the original notebook: water where VH backscatter is below -18 dB on slopes under 5 degrees.
Added: permanent water (JRC occurrence >= 90%) is removed from flood area; flood is also counted inside the
floodplain only (pixels JRC has seen under water at least once, 1984-2020, less permanent water), because the
fixed threshold also flags dry, bare or burnt ground as water, most of all in the dry season; each month records how many images
and what share of the box they cover; the analysis grid is 0.001 degrees (about 110 m).

Outputs (part_a/data/): flood_monthly.csv, results.json, and PNG overlays for the website map.
"""
import csv, json, os, sys, math
from concurrent.futures import ThreadPoolExecutor
import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.windows import from_bounds
from rasterio.transform import from_origin
import pystac_client, planetary_computer as pc

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "part_a", "data")
CACHE = os.path.join(ROOT, "part_a", "cache")
X0, X1, Y0, Y1 = 6.50, 7.30, 5.80, 8.00
RES = 0.001
W, H = round((X1 - X0) / RES), round((Y1 - Y0) / RES)
DST = from_origin(X0, Y1, RES, RES)
THRESH_DB, SLOPE_MAX, PERM = -18.0, 5.0, 90
os.environ.setdefault("GDAL_HTTP_MAX_RETRY", "5")
os.environ.setdefault("GDAL_HTTP_RETRY_DELAY", "2")
os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")

cat = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1", modifier=pc.sign_inplace)


def to_grid(href, resampling=Resampling.average, decimate=8, band=1):
    """Read the part of a raster covering the box (from overviews where possible) and put it on the 0.001-degree grid."""
    with rasterio.open(href) as src:
        b = transform_bounds("EPSG:4326", src.crs, X0, Y0, X1, Y1, densify_pts=21)
        win = from_bounds(*b, transform=src.transform).round_offsets().round_lengths()
        win = win.intersection(rasterio.windows.Window(0, 0, src.width, src.height))
        shape = (max(1, int(win.height // decimate)), max(1, int(win.width // decimate)))
        arr = src.read(band, window=win, out_shape=shape, masked=True).astype("float32").filled(np.nan)
        wt = src.window_transform(win) * rasterio.Affine.scale(win.width / shape[1], win.height / shape[0])
        out = np.full((H, W), np.nan, dtype="float32")
        reproject(arr, out, src_transform=wt, src_crs=src.crs, src_nodata=np.nan, dst_transform=DST, dst_crs="EPSG:4326",
                  dst_nodata=np.nan, resampling=resampling)
        return out


def slope_deg():
    path = os.path.join(CACHE, "slope.npy")
    if os.path.exists(path):
        return np.load(path)
    dem = np.full((H, W), np.nan, dtype="float32")
    for it in cat.search(collections=["cop-dem-glo-90"], bbox=[X0, Y0, X1, Y1]).items():
        part = to_grid(it.assets["data"].href, Resampling.bilinear, decimate=1)
        dem = np.where(np.isnan(dem), part, dem)
    lat = Y1 - (np.arange(H) + 0.5) * RES
    dx = RES * 111320 * np.cos(np.radians(lat))[:, None]
    dy = RES * 110574
    gy, gx = np.gradient(dem)
    s = np.degrees(np.arctan(np.hypot(gx / dx, gy / dy))).astype("float32")
    np.save(path, s)
    return s


def jrc(asset):
    path = os.path.join(CACHE, f"jrc_{asset}.npy")
    if os.path.exists(path):
        return np.load(path)
    arr = np.full((H, W), np.nan, dtype="float32")
    for it in cat.search(collections=["jrc-gsw"], bbox=[X0, Y0, X1, Y1]).items():
        part = to_grid(it.assets[asset].href, Resampling.average, decimate=2)
        arr = np.where(np.isnan(arr), part, arr)
    np.save(path, arr)
    return arr


def scene_db(item):
    """VH backscatter in dB on the grid for one Sentinel-1 RTC scene (linear gamma0 is averaged before taking dB)."""
    lin = to_grid(item.assets["vh"].href, Resampling.average, decimate=8)
    lin[lin <= 0] = np.nan
    return 10 * np.log10(lin)


def month_items(y, m):
    start = f"{y}-{m:02d}-01"
    end = f"{y + (m == 12)}-{1 if m == 12 else m + 1:02d}-01"
    return list(cat.search(collections=["sentinel-1-rtc"], bbox=[X0, Y0, X1, Y1], datetime=f"{start}/{end}").items())


def main():
    os.makedirs(OUT, exist_ok=True); os.makedirs(CACHE, exist_ok=True)
    slope = slope_deg()
    occ, ext = jrc("occurrence"), jrc("extent")
    gentle = slope < SLOPE_MAX
    permanent = occ >= PERM
    plain = (ext >= 0.5) & ~permanent  # floodplain: water at least once in 1984-2020, less permanent water
    lat = Y1 - (np.arange(H) + 0.5) * RES
    px_km2 = (RES * 111.32 * np.cos(np.radians(lat)) * RES * 110.574)[:, None] * np.ones((1, W))
    rows, freq_sum, freq_n = [], np.zeros((H, W)), np.zeros((H, W))
    dry_any, wet_ever = [], np.zeros((H, W), bool)
    composites = {}
    pool = ThreadPoolExecutor(8)
    for y in range(2018, 2024):
        for m in range(1, 13):
            path = os.path.join(CACHE, f"s1_{y}_{m:02d}.npz")
            if os.path.exists(path):
                d = np.load(path); med, nimg, nvalid, fs, fn = d["med"], int(d["n"]), d["nvalid"], d["fsum"], d["fn"]
            else:
                items = month_items(y, m)
                scenes = list(pool.map(scene_db, items)) if items else []
                stack = np.stack(scenes) if scenes else np.full((1, H, W), np.nan, "float32")
                med = np.nanmedian(stack, axis=0).astype("float32")
                nvalid = np.sum(~np.isnan(stack), axis=0).astype("uint8")
                nimg = len(items)
                # per-scene water for the frequency map (August-November only), stored with the month
                fs, fn = np.zeros((H, W), "uint16"), np.zeros((H, W), "uint16")
                if 8 <= m <= 11:
                    for sc in scenes:
                        ok = ~np.isnan(sc)
                        fs[ok] += ((sc < THRESH_DB) & gentle)[ok]
                        fn[ok] += 1
                np.savez_compressed(path, med=med, n=nimg, nvalid=nvalid, fsum=fs, fn=fn)
            freq_sum += fs; freq_n += fn
            water = (med < THRESH_DB) & gentle
            flood = water & ~permanent
            cover = float(np.mean(nvalid > 0))
            rows.append({"year": y, "month": m, "n_images": nimg, "coverage": round(cover, 3),
                         "water_km2": round(float(px_km2[water].sum()), 1), "flood_km2": round(float(px_km2[flood].sum()), 1),
                         "flood_floodplain_km2": round(float(px_km2[water & plain].sum()), 1),
                         "dark_outside_floodplain_km2": round(float(px_km2[water & ~plain & ~permanent].sum()), 1)})
            if m <= 3 and y <= 2020:
                dry_any.append(water)
            if 8 <= m <= 11 and y <= 2020:
                wet_ever |= water
            if (y, m) in ((2022, 2), (2022, 10)):
                composites[f"{y}-{m:02d}"] = water
            print(y, m, rows[-1], flush=True)
    freq = np.where(freq_n > 0, 100 * freq_sum / np.maximum(freq_n, 1), np.nan)
    np.savez_compressed(os.path.join(CACHE, "frequency.npz"), freq=freq, n=freq_n)

    def agree(a, b):
        both = float(px_km2[a & b].sum()); A = float(px_km2[a].sum()); B = float(px_km2[b].sum())
        return {"s1_km2": round(A, 1), "jrc_km2": round(B, 1), "both_km2": round(both, 1),
                "recall": round(both / B, 4) if B else None, "precision": round(both / A, 4) if A else None}
    dry_water = np.mean(np.stack(dry_any), axis=0) >= 0.5  # water in at least half the dry-season months
    res = {
        "settings": {"box": [X0, Y0, X1, Y1], "grid_deg": RES, "threshold_db": THRESH_DB, "slope_max_deg": SLOPE_MAX,
                     "permanent_water": f"JRC occurrence >= {PERM}%", "sentinel1": "Sentinel-1 RTC gamma0 VH (Planetary Computer)",
                     "dem": "Copernicus GLO-90", "jrc": "JRC Global Surface Water v1.3, 1984-2020"},
        "monthly": rows,
        "frequency": {"n_wet_season_images_max": int(freq_n.max()), "n_wet_season_images_median": float(np.median(freq_n[freq_n > 0])),
                      "area_ever_water_km2": round(float(px_km2[freq > 0].sum()), 1),
                      "area_water_half_the_time_km2": round(float(px_km2[freq >= 50].sum()), 1)},
        "jrc": {"dry_season_vs_occurrence50": agree(dry_water, occ >= 50),
                "wet_season_ever_vs_max_extent": agree(wet_ever, ext >= 0.5)},
        "permanent_water_km2": round(float(px_km2[permanent].sum()), 1),
        "floodplain_km2": round(float(px_km2[plain].sum()), 1),
    }
    json.dump(res, open(os.path.join(OUT, "results.json"), "w"), indent=1)
    with open(os.path.join(OUT, "flood_monthly.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
    overlays(freq, composites, permanent, plain)
    print(json.dumps(res["jrc"], indent=1))


def overlays(freq, composites, permanent, plain):
    """PNG overlays for the website map: frequency classes and two single-month water masks."""
    from PIL import Image
    ramp = [(None, None), (10, (222, 235, 247)), (25, (158, 202, 225)), (50, (66, 146, 198)), (75, (8, 81, 156)), (101, (8, 48, 107))]
    rgba = np.zeros((H, W, 4), dtype="uint8")
    lo = 1
    for hi, col in ramp[1:]:
        sel = (freq >= lo) & (freq < hi)
        rgba[sel] = (*col, 230)
        lo = hi
    Image.fromarray(rgba).save(os.path.join(OUT, "frequency.png"), optimize=True)
    fp = np.zeros((H, W, 4), dtype="uint8"); fp[plain] = (120, 120, 112, 90)
    Image.fromarray(fp).save(os.path.join(OUT, "floodplain.png"), optimize=True)
    for k, wmask in composites.items():
        img = np.zeros((H, W, 4), dtype="uint8")
        img[wmask & ~permanent] = (31, 86, 176, 235)
        img[wmask & permanent] = (17, 17, 17, 200)
        Image.fromarray(img).save(os.path.join(OUT, f"water_{k}.png"), optimize=True)


if __name__ == "__main__":
    main()
