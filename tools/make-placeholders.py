#!/usr/bin/env python3
"""
Génère les images factices (« placeholders ») de démonstration.

    python3 tools/make-placeholders.py

Ce ne sont PAS des radiographies : juste des coupes synthétiques sombres qui
permettent de tester le défilement et les onglets. Remplacez les dossiers
images/<cas>/<série>/ par vos propres JPG (001.jpg, 002.jpg, …) puis relancez
`npm run build`.
"""
import math
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SIZE = 900

# cas -> [(id de série, plan, nombre de coupes)]
CASES = {
    "thorax-01": [("axial", "axial", 26), ("coronal", "coronal", 16)],
    "abdomen-01": [("axial", "axial", 22), ("coronal", "coronal", 14)],
    "cerveau-01": [("axial", "axial", 16), ("sagittal", "sagittal", 12)],
}

# rayons du « corps » selon le plan de coupe
BODY = {
    "axial": (360, 285),
    "coronal": (268, 352),
    "sagittal": (205, 356),
}

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
]


def font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default(size=size)


def make_slice(index: int, total: int, seed: int, plane: str) -> Image.Image:
    rng = np.random.default_rng(seed)
    t = index / max(1, total - 1)              # 0 → 1 le long de la pile
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    cx = cy = SIZE / 2
    rx, ry = BODY[plane]

    body = np.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2) ** 1.35)

    # deux structures internes qui grossissent puis rétrécissent
    grow = 0.55 + 0.45 * math.sin(math.pi * t)
    inner = np.zeros_like(body)
    for sign in (-1, 1):
        ix = cx + sign * rx * 0.36 * grow
        iy = cy - ry * 0.07
        inner += np.exp(-(((x - ix) / (rx * 0.26 * grow)) ** 2 +
                          ((y - iy) / (ry * 0.52 * grow)) ** 2) ** 1.6)

    # une « lésion » qui se déplace lentement
    px = cx + rx * 0.17 * math.cos(2 * math.pi * t)
    py = cy + ry * 0.14 * math.sin(2 * math.pi * t)
    spot = np.exp(-(((x - px) / 46) ** 2 + ((y - py) / 46) ** 2) ** 1.5)

    spine = np.exp(-(((x - cx) / 26) ** 2 + ((y - cy) / (ry * 0.42)) ** 2) ** 2)

    field = (
        12
        + body * 78
        - inner * 46
        + spine * 118
        + spot * 95
        + rng.normal(0, 5.5, (SIZE, SIZE))
    )

    r2 = ((x - cx) / (SIZE / 2)) ** 2 + ((y - cy) / (SIZE / 2)) ** 2
    field *= np.clip(1.08 - 0.42 * r2, 0.25, 1.08)
    field = np.clip(field, 0, 255)

    img = Image.fromarray(field.astype(np.uint8), mode="L").convert("RGB")
    img = img.filter(ImageFilter.GaussianBlur(1.1))
    draw = ImageDraw.Draw(img)

    draw.text((26, SIZE - 46), f"{index + 1:02d} / {total:02d}", font=font(19), fill=(150, 160, 172))
    draw.text((26, SIZE - 72), "IMAGE DE DÉMONSTRATION", font=font(14), fill=(96, 104, 114))
    draw.text((30, 24), "R", font=font(20), fill=(150, 160, 172))
    draw.text((SIZE - 46, 24), "L", font=font(20), fill=(150, 160, 172))

    label = plane.upper()
    w = draw.textlength(label, font=font(13))
    draw.text((SIZE - 26 - w, SIZE - 44), label, font=font(13), fill=(104, 114, 126))
    return img


def main() -> None:
    for case_index, (case_id, series) in enumerate(CASES.items()):
        for serie_index, (serie_id, plane, count) in enumerate(series):
            folder = ROOT / "images" / case_id / serie_id
            folder.mkdir(parents=True, exist_ok=True)
            for i in range(count):
                img = make_slice(i, count, seed=1000 * (case_index + 1) + 7 * serie_index, plane=plane)
                img.save(folder / f"{i + 1:03d}.jpg", "JPEG", quality=78, optimize=True, progressive=True)
            size = sum(f.stat().st_size for f in folder.iterdir() if f.suffix == ".jpg")
            print(f"✓ images/{case_id}/{serie_id:<9} {count:>3} coupes · {size / 1024 / 1024:.1f} Mo")


if __name__ == "__main__":
    main()
