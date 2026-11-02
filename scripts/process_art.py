"""Turn the raw Higgsfield renders in art/source into web-ready assets in public/art.

- Rooms + surface: resized, saved as WebP.
- Sprites: trimmed to their alpha bounds, scaled to a fixed height, saved as WebP
  with alpha. Faces for the UI portraits are cropped from the top of each sprite.

Run: python scripts/process_art.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "source"
OUT = ROOT / "public" / "art"


def save(im: Image.Image, path: Path, quality: int = 84) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, "WEBP", quality=quality, method=6)
    print(f"{path.relative_to(ROOT)}  {im.size}  {path.stat().st_size // 1024} KB")


def rooms() -> None:
    for f in sorted((SRC / "rooms").glob("*.png")):
        im = Image.open(f).convert("RGB")
        im = im.resize((1400, round(1400 * im.height / im.width)), Image.LANCZOS)
        save(im, OUT / "rooms" / f"{f.stem}.webp")


def surface() -> None:
    im = Image.open(SRC / "surface.png").convert("RGB")
    im = im.resize((2400, round(2400 * im.height / im.width)), Image.LANCZOS)
    save(im, OUT / "surface.webp", quality=82)


def env() -> None:
    """Tiling structure textures: earth, concrete hull, elevator shaft."""
    for f in sorted((SRC / "env").glob("*.png")):
        im = Image.open(f).convert("RGB")
        im = im.resize((1024, round(1024 * im.height / im.width)), Image.LANCZOS)
        save(im, OUT / "env" / f"{f.stem}.webp", quality=82)


def sprites() -> None:
    for f in sorted((SRC / "sprites").glob("*.png")):
        im = Image.open(f).convert("RGBA")
        # Drop faint glow pixels when trimming so the feet sit on the bbox bottom.
        alpha = im.getchannel("A").point(lambda a: 255 if a > 40 else 0)
        im = im.crop(alpha.getbbox())
        h = 420
        im = im.resize((round(h * im.width / im.height), h), Image.LANCZOS)
        save(im, OUT / "sprites" / f"{f.stem}.webp", quality=88)


if __name__ == "__main__":
    rooms()
    surface()
    env()
    sprites()
