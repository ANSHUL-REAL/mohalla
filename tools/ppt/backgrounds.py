"""Grid backgrounds for the slides, matching the app's retro grid. Run: python backgrounds.py"""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).parent / "assets"
OUT.mkdir(exist_ok=True)
W, H, STEP = 2560, 1440, 80


def grid(name, bg, line):
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    for x in range(STEP // 2, W, STEP):
        d.line((x, 0, x, H), fill=line, width=2)
    for y in range(STEP // 2, H, STEP):
        d.line((0, y, W, y), fill=line, width=2)
    img.save(OUT / name, quality=92)


grid("bg-yellow.jpg", (255, 197, 103), (240, 176, 82))   # title / closing slides
grid("bg-light.jpg", (255, 255, 255), (241, 236, 226))   # content slides: white with a faint grid
grid("bg-purple.jpg", (85, 44, 183), (101, 62, 196))     # section-style slides
print("backgrounds done")
