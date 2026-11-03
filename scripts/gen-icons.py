# Favicons and app icons from HATCH's smug face (public/art/hatch/smug.webp).
# Run: python scripts/gen-icons.py   (needs Pillow)
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / 'public'
INK = (11, 11, 16, 255)

src = Image.open(PUB / 'art/hatch/smug.webp').convert('RGBA')
# Drop the little motion marks to the right of the monitor, then trim to the monitor itself.
w, h = src.size
src = src.crop((0, 0, int(w * 0.86), h))
src = src.crop(src.getbbox())


def square(img: Image.Image, size: int, pad: float, bg=None) -> Image.Image:
    """Fit `img` centered in a size x size square with `pad` (fraction) margin."""
    inner = round(size * (1 - 2 * pad))
    s = inner / max(img.size)
    fit = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    out = Image.new('RGBA', (size, size), bg or (0, 0, 0, 0))
    out.alpha_composite(fit, ((size - fit.width) // 2, (size - fit.height) // 2))
    return out


# Browser tab: transparent, tight, and without the cord so the face is as big as it can be.
head = src.crop((0, 0, src.width, round(src.height * 0.8)))
square(head, 256, 0.0).save(PUB / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
square(head, 32, 0.0).save(PUB / 'favicon-32.png')
square(head, 16, 0.0).save(PUB / 'favicon-16.png')
# Home screen / PWA: solid ink background so it reads on any wallpaper.
square(src, 180, 0.12, INK).convert('RGB').save(PUB / 'apple-touch-icon.png')
square(src, 192, 0.12, INK).save(PUB / 'icon-192.png')
square(src, 512, 0.12, INK).save(PUB / 'icon-512.png')
print('icons ok')
