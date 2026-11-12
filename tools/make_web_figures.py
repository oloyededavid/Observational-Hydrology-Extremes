"""Web copies of the study's figures for docs/assets/fig/: white margins trimmed, at most 1600 px.
The originals in part_a/figures, part_b/figures and the October report are not changed.
The Part A study-area map exists only inside the report PDF (page 4); it is extracted with pdfimages."""
import glob, os, re, subprocess, tempfile
from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "assets", "fig")
PDF = os.path.join(ROOT, "documents", "Observational Hydrology in Data-Sparse Catchments A AND B.pdf")


def save(im, name):
    im = im.convert("RGB")
    bg = Image.new("RGB", im.size, (255, 255, 255))
    mask = ImageChops.difference(im, bg).convert("L").point(lambda v: 255 if v > 18 else 0)
    box = mask.getbbox()
    if box:
        pad = 12
        im = im.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad)))
    s = min(1.0, 1600 / max(im.size))
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    im.save(os.path.join(OUT, name), quality=86, optimize=True, progressive=True)
    print(name, im.size)


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in sorted(glob.glob(os.path.join(ROOT, "part_*", "figures", "*"))):
        if f.endswith(".jpg") and os.path.exists(f[:-4] + ".png"):
            continue
        slug = re.sub(r"[^a-z0-9]+", "-", os.path.splitext(os.path.basename(f))[0].lower()).strip("-")
        save(Image.open(f), f"{os.path.basename(os.path.dirname(os.path.dirname(f))).replace('part_', '')}-{slug}.jpg")
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(["pdfimages", "-f", "4", "-l", "4", "-j", PDF, os.path.join(d, "p")], check=True)
        save(Image.open(os.path.join(d, "p-000.jpg")), "a-study-area-report.jpg")


if __name__ == "__main__":
    main()
