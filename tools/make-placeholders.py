#!/usr/bin/env python3
"""
Génère des images factices (« placeholders ») pour la démo.

    python3 tools/make-placeholders.py

Ce ne sont PAS des radiographies : juste des coupes synthétiques sombres qui
permettent de tester le défilement. Remplacez les dossiers images/serie-XX/
par vos propres JPG (001.jpg, 002.jpg, …) puis relancez tools/build.mjs.
"""
import math
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SIZE = 900
SLICES = {"serie-01": 28, "serie-02": 22, "serie-03": 16}

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


def make_slice(index: int, total: int, seed: int) -> Image.Image:
    rng = np.random.default_rng(seed)
    t = index / max(1, total - 1)              # 0 → 1 le long de la pile
    y, x = np.mgrid[0:SIZE, 0:SIZE].astype(np.float32)
    cx = cy = SIZE / 2

    # corps : ellipse douce
    body = np.exp(-(((x - cx) / 360) ** 2 + ((y - cy) / 285) ** 2) ** 1.35)

    # deux structures « pulmonaires » qui grossissent puis rétrécissent
    grow = 0.55 + 0.45 * math.sin(math.pi * t)
    lung = np.zeros_like(body)
    for sign in (-1, 1):
        lx = cx + sign * 130 * grow
        ly = cy - 20
        lung += np.exp(-(((x - lx) / (95 * grow)) ** 2 + ((y - ly) / (150 * grow)) ** 2) ** 1.6)

    # une « lésion » qui se déplace lentement
    px = cx + 60 * math.cos(2 * math.pi * t)
    py = cy + 40 * math.sin(2 * math.pi * t)
    spot = np.exp(-(((x - px) / 46) ** 2 + ((y - py) / 46) ** 2) ** 1.5)

    # médiastin / vertèbre
    spine = np.exp(-(((x - cx) / 26) ** 2 + ((y - cy) / 120) ** 2) ** 2)

    field = (
        12
        + body * 78
        - lung * 46
        + spine * 120
        + spot * 95
        + rng.normal(0, 5.5, (SIZE, SIZE))
    )

    # vignettage
    r2 = ((x - cx) / (SIZE / 2)) ** 2 + ((y - cy) / (SIZE / 2)) ** 2
    field *= np.clip(1.08 - 0.42 * r2, 0.25, 1.08)
    field = np.clip(field, 0, 255)

    img = Image.fromarray(field.astype(np.uint8), mode="L").convert("RGB")
    img = img.filter(ImageFilter.GaussianBlur(1.1))

    draw = ImageDraw.Draw(img)
    small = font(19)

    # compteur de coupe, discret, en bas à gauche
    draw.text((26, SIZE - 46), f"{index + 1:02d} / {total:02d}", font=small, fill=(150, 160, 172))
    # filigrane
    wm = font(15)
    draw.text((26, SIZE - 72), "IMAGE DE DÉMONSTRATION", font=wm, fill=(96, 104, 114))

    # repère d'orientation (R / L), comme sur une vraie console
    draw.text((30, 24), "R", font=font(20), fill=(150, 160, 172))
    draw.text((SIZE - 46, 24), "L", font=font(20), fill=(150, 160, 172))
    return img


def make_og_image() -> None:
    W, H = 1200, 630
    img = Image.new("RGB", (W, H), (10, 12, 15))
    draw = ImageDraw.Draw(img)

    for i in range(H):  # dégradé vertical
        shade = int(10 + 16 * (1 - i / H))
        draw.line([(0, i), (W, i)], fill=(shade, shade + 2, shade + 5))

    cx, cy = W // 2, 250
    for r, col in ((118, (44, 74, 104)), (86, (78, 130, 176))):
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=3)
    draw.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=(143, 208, 255))
    for dx, dy in ((-118, 0), (118, 0), (0, -118), (0, 118)):
        draw.line([(cx + dx, cy + dy), (cx + dx * 0.72, cy + dy * 0.72)], fill=(143, 208, 255), width=3)

    title_font = font(74)
    sub_font = font(30)
    title = "RadQuizz"
    tw = draw.textlength(title, font=title_font)
    draw.text(((W - tw) / 2, 400), title, font=title_font, fill=(246, 248, 251))

    sub = "Des cas radiologiques à parcourir coupe par coupe"
    sw = draw.textlength(sub, font=sub_font)
    draw.text(((W - sw) / 2, 492), sub, font=sub_font, fill=(150, 163, 180))

    out = ROOT / "assets" / "og-image.png"
    img.save(out, "PNG", optimize=True)
    print("✓", out.relative_to(ROOT))


def main() -> None:
    for idx, (serie, count) in enumerate(SLICES.items()):
        folder = ROOT / "images" / serie
        folder.mkdir(parents=True, exist_ok=True)
        for i in range(count):
            img = make_slice(i, count, seed=1000 * (idx + 1))
            img.save(folder / f"{i + 1:03d}.jpg", "JPEG", quality=78, optimize=True, progressive=True)
        size = sum((folder / f).stat().st_size for f in os.listdir(folder) if f.endswith(".jpg"))
        print(f"✓ images/{serie}  {count} coupes · {size / 1024 / 1024:.1f} Mo")
    make_og_image()


if __name__ == "__main__":
    main()
