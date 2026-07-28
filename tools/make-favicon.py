#!/usr/bin/env python3
"""Build the Jet Crust favicon / app-icon set from the silver ring logo.

The silver mark sits on a forest-green tile (brand colour) so it reads crisply
in a browser tab and on a phone home screen. Outputs go straight into app/ where
Next.js picks them up automatically (no layout change).

    app/icon.png        512x512, rounded, transparent corners  (browser tab)
    app/favicon.ico     16/32/48, rounded                       (legacy)
    app/apple-icon.png  180x180, full-bleed square              (iOS masks it)
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "Main Logo Jet Crust" / "Jet Main Logo (1).png"
APP = ROOT / "app"
FOREST = (37, 48, 38, 255)  # --forest #253026

# Load logo, trim to its visible bounds so it fills the tile evenly.
logo = Image.open(SRC).convert("RGBA")
bbox = logo.getbbox()
if bbox:
    logo = logo.crop(bbox)


def tile(size: int, *, radius_ratio: float, pad_ratio: float, full_square: bool) -> Image.Image:
    """A green tile with the logo centred. full_square = no rounded corners."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if full_square:
        canvas.paste(FOREST, (0, 0, size, size))
    else:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255
        )
        canvas.paste(Image.new("RGBA", (size, size), FOREST), (0, 0), mask)

    # Scale logo into the padded inner box, preserving aspect ratio.
    inner = int(size * (1 - 2 * pad_ratio))
    scale = min(inner / logo.width, inner / logo.height)
    w, h = max(1, round(logo.width * scale)), max(1, round(logo.height * scale))
    resized = logo.resize((w, h), Image.LANCZOS)
    canvas.alpha_composite(resized, ((size - w) // 2, (size - h) // 2))
    return canvas


# Browser tab icon (rounded, transparent outside the tile).
tile(512, radius_ratio=0.22, pad_ratio=0.16, full_square=False).save(APP / "icon.png")

# Legacy multi-size .ico.
ico = tile(256, radius_ratio=0.22, pad_ratio=0.16, full_square=False)
ico.save(APP / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# iOS home-screen icon: full-bleed square, the OS rounds it itself.
tile(180, radius_ratio=0, pad_ratio=0.18, full_square=True).save(APP / "apple-icon.png")

print("wrote:", *(str((APP / n).relative_to(ROOT)) for n in ("icon.png", "favicon.ico", "apple-icon.png")))
