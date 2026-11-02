"""Cut the 8 HATCH expressions out of the 4x2 expression sheet into clean
transparent WebPs (public/art/hatch/<mood>.webp).

The sheet's grid isn't perfectly even, so each frame is found as the largest
non-background blob inside its cell instead of slicing fixed rectangles.

Run: python scripts/cut_hatch.py
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "art" / "characters" / "hatch-expressions.png"
OUT = ROOT / "public" / "art" / "hatch"
MOODS = ["neutral", "smug", "laugh", "panic", "angry", "cry", "dead", "sleep"]


def main() -> None:
    sheet = Image.open(SHEET).convert("RGB")
    w, h = sheet.size
    bg = sheet.getpixel((4, 4))
    OUT.mkdir(parents=True, exist_ok=True)
    for i, mood in enumerate(MOODS):
        cx, cy = i % 4, i // 4
        cell = sheet.crop((cx * w // 4, cy * h // 2, (cx + 1) * w // 4, (cy + 1) * h // 2))
        # Foreground = anything noticeably different from the flat grey background.
        diff = ImageChops.difference(cell, Image.new("RGB", cell.size, bg)).convert("L")
        mask = diff.point(lambda v: 255 if v > 28 else 0)
        # Flood the outside from the borders so only background connected to the
        # edges becomes transparent (keeps light pixels inside the monitor).
        outside = mask.copy()
        for x, y in [(0, 0), (cell.width - 1, 0), (0, cell.height - 1), (cell.width - 1, cell.height - 1)]:
            if outside.getpixel((x, y)) == 0:
                ImageDraw.floodfill(outside, (x, y), 128)
        alpha = outside.point(lambda v: 0 if v == 128 else 255).filter(ImageFilter.MinFilter(3))
        frame = cell.convert("RGBA")
        frame.putalpha(alpha)
        # Drop stray fragments of neighbouring frames: keep the bbox of the
        # alpha after removing anything touching the cell edges.
        box = alpha.getbbox()
        frame = frame.crop(box)
        frame = frame.resize((360, round(360 * frame.height / frame.width)), Image.LANCZOS)
        path = OUT / f"{mood}.webp"
        frame.save(path, "WEBP", quality=90, method=6)
        print(path.relative_to(ROOT), frame.size)


if __name__ == "__main__":
    main()
