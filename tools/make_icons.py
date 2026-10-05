"""Draws the Mohalla app icon and splash screens for the Android project.

Design: a red map pin with a little house in its head (mohalla = neighbourhood), a white
sparkle, thick black outlines and hard shadows, on brand yellow with a faint retro grid.
Run: python tools/make_icons.py  (also writes client/public/logo.svg-matching PNGs)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "client/android/app/src/main/res"
YELLOW, GRID = (255, 197, 103), (240, 172, 74)
RED, PINK, PURPLE, GREEN = (253, 90, 70), (251, 125, 168), (85, 44, 183), (0, 153, 94)
INK, WHITE = (17, 17, 17), (255, 255, 255)
FONT = "C:/Windows/Fonts/ariblk.ttf"


def cubic(p0, p1, p2, p3, steps=40):
    return [
        tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d
              for a, b, c, d in zip(p0, p1, p2, p3))
        for t in (i / steps for i in range(1, steps + 1))
    ]


# Pin outline in 64-unit logo space (spans x 14-46, y 11-52, centre 30,31.5)
PIN = [(30, 11)]
PIN += cubic((30, 11), (21.2, 11), (14, 17.9), (14, 26.5))
PIN += cubic((14, 26.5), (14, 38), (30, 52), (30, 52))
PIN += cubic((30, 52), (30, 52), (46, 38), (46, 26.5))
PIN += cubic((46, 26.5), (46, 17.9), (38.8, 11), (30, 11))


class Pen:
    """Draws in logo units: (cx, cy) is where the pin centre lands, k = pixels per unit."""

    def __init__(self, img, cx, cy, k):
        self.d, self.cx, self.cy, self.k = ImageDraw.Draw(img), cx, cy, k
        self.w = max(2, round(2.2 * k))  # main outline width
        self.thin = max(1, round(1.3 * k))  # outline for small details

    def p(self, x, y, dx=0, dy=0):
        return (self.cx + (x - 30 + dx) * self.k, self.cy + (y - 31.5 + dy) * self.k)

    def shape(self, pts, fill, shadow=0, thin=False):
        if shadow:
            self.d.polygon([self.p(x, y, shadow, shadow) for x, y in pts], fill=INK)
        poly = [self.p(x, y) for x, y in pts]
        self.d.polygon(poly, fill=fill)
        self.d.line(poly + poly[:2], fill=INK, width=self.thin if thin else self.w, joint="curve")

    def circle(self, x, y, r, fill, thin=False):
        (x0, y0), (x1, y1) = self.p(x - r, y - r), self.p(x + r, y + r)
        self.d.ellipse((x0, y0, x1, y1), fill=fill, outline=INK, width=self.thin if thin else self.w)

    def rect(self, x0, y0, x1, y1, fill, outline=True):
        a, b = self.p(x0, y0), self.p(x1, y1)
        self.d.rectangle((*a, *b), fill=fill, outline=INK if outline else None, width=self.thin if outline else 0)


def sparkle(cx, cy, r):
    """Four-point star like the ones in the brand reference."""
    pts = []
    for i in range(8):
        import math
        ang = math.pi / 4 * i - math.pi / 2
        rad = r if i % 2 == 0 else r * 0.36
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))
    return pts


def draw_mark(img, cx, cy, k, with_sparkle=True):
    pen = Pen(img, cx, cy, k)
    pen.shape(PIN, RED, shadow=3)
    # House inside the pin head
    pen.circle(30, 26, 10, WHITE)
    pen.rect(24.6, 25.4, 35.4, 32.2, PINK)
    pen.shape([(22.4, 26.2), (30, 18.8), (37.6, 26.2)], PURPLE, thin=True)
    pen.rect(28.4, 28.0, 31.6, 32.2, INK, outline=False)
    if with_sparkle:
        pen.shape(sparkle(48, 12, 7), WHITE, thin=True)


def grid(img, step, width):
    d = ImageDraw.Draw(img)
    for x in range(step // 2, img.width, step):
        d.line((x, 0, x, img.height), fill=GRID, width=width)
    for y in range(step // 2, img.height, step):
        d.line((0, y, img.width, y), fill=GRID, width=width)


def render(size, painter, ss=4, mode="RGBA"):
    """Draws at ss-times size and scales down for smooth edges."""
    big = Image.new(mode, (size[0] * ss, size[1] * ss), (0, 0, 0, 0) if mode == "RGBA" else YELLOW)
    painter(big)
    return big.resize(size, Image.LANCZOS)


def tile(w, radius_ratio):
    """Yellow grid tile with black border and hard shadow (legacy square/round icons)."""
    def paint(img):
        pad, off, line = w * 0.05, w * 0.05, max(2, w // 26)
        box = (pad, pad, w - pad - off, w - pad - off)
        mask = Image.new("L", img.size, 0)
        md = ImageDraw.Draw(mask)
        d = ImageDraw.Draw(img)
        if radius_ratio is None:
            d.ellipse((box[0] + off, box[1] + off, box[2] + off, box[3] + off), fill=INK)
            md.ellipse(box, fill=255)
        else:
            d.rounded_rectangle((box[0] + off, box[1] + off, box[2] + off, box[3] + off), radius=w * radius_ratio, fill=INK)
            md.rounded_rectangle(box, radius=w * radius_ratio, fill=255)
        face = Image.new("RGBA", img.size, YELLOW + (255,))
        grid(face, round(w / 7), max(1, w // 120))
        img.paste(face, (0, 0), mask)
        if radius_ratio is None:
            d.ellipse(box, outline=INK, width=line)
        else:
            d.rounded_rectangle(box, radius=w * radius_ratio, outline=INK, width=line)
        mid = (box[0] + box[2]) / 2
        draw_mark(img, mid - w * 0.03, mid + w * 0.02, w / 64 * 0.9)
    return paint


def adaptive_foreground(img):
    # 108dp canvas; launchers crop to roughly the central 66dp, so keep the mark inside it
    w = img.width
    draw_mark(img, w / 2 - w * 0.035, w / 2 + w * 0.02, w / 108 * 1.1)


def adaptive_background(img):
    ImageDraw.Draw(img).rectangle((0, 0, img.width, img.height), fill=YELLOW)
    grid(img, round(img.width / 9), max(1, img.width // 200))


def splash(img):
    w, h = img.size
    ImageDraw.Draw(img).rectangle((0, 0, w, h), fill=YELLOW)
    grid(img, round(min(w, h) / 9), max(1, min(w, h) // 300))
    k = min(w, h) / 64 * 0.42
    cy = h / 2 - k * 8
    draw_mark(img, w / 2, cy, k)
    # Wordmark: "Mohalla" in black with a red full stop, like the web logo
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, round(min(w, h) * 0.085))
    word, dot = "Mohalla", "."
    ww = d.textlength(word, font=font)
    dw = d.textlength(dot, font=font)
    x, y = (w - ww - dw) / 2, cy + k * 27
    d.text((x, y), word, font=font, fill=INK)
    d.text((x + ww, y), dot, font=font, fill=RED)
    small = ImageFont.truetype(FONT, round(min(w, h) * 0.032))
    tag = "YOUR NEIGHBOURHOOD, ONE TAP AWAY"
    d.text(((w - d.textlength(tag, font=small)) / 2, y + min(w, h) * 0.13), tag, font=small, fill=INK)


DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for name, px in DENSITIES.items():
    folder = RES / f"mipmap-{name}"
    render((px, px), tile(px * 4, 0.22)).save(folder / "ic_launcher.png")
    render((px, px), tile(px * 4, None)).save(folder / "ic_launcher_round.png")
    fg = round(px * 108 / 48)
    render((fg, fg), adaptive_foreground).save(folder / "ic_launcher_foreground.png")
    render((fg, fg), adaptive_background).save(folder / "ic_launcher_background.png")

# Adaptive icons use the grid background image instead of a flat colour
for xml in ("ic_launcher.xml", "ic_launcher_round.xml"):
    (RES / "mipmap-anydpi-v26" / xml).write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@mipmap/ic_launcher_background"/>\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n'
        '</adaptive-icon>\n'
    )
(RES / "values/ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    '    <color name="ic_launcher_background">#FFC567</color>\n</resources>\n'
)

# Splash screens keep each file's existing size
for path in RES.glob("drawable*/splash.png"):
    size = Image.open(path).size
    render(size, splash, ss=2).convert("RGB").save(path)

# Same mark for the website favicon / PWA icon
render((512, 512), tile(512 * 4, 0.22)).save(ROOT / "client/public/icon-512.png")
render((192, 192), tile(192 * 4, 0.22)).save(ROOT / "client/public/icon-192.png")

# Preview sheet: square, round, adaptive (circle crop) and adaptive (squircle crop)
sheet = Image.new("RGB", (820, 230), (236, 236, 236))
x = 14
for img in (render((192, 192), tile(768, 0.22)), render((192, 192), tile(768, None))):
    sheet.paste(img, (x, 18), img)
    x += 206
for radius in (None, 0.3):
    bg = render((300, 300), adaptive_background)
    bg.alpha_composite(render((300, 300), adaptive_foreground))
    bg = bg.crop((60, 60, 240, 240))  # what a launcher shows (central 66 of 108)
    mask = Image.new("L", bg.size, 0)
    md = ImageDraw.Draw(mask)
    md.ellipse((0, 0, 179, 179), fill=255) if radius is None else md.rounded_rectangle((0, 0, 179, 179), radius=54, fill=255)
    sheet.paste(bg, (x, 24), mask)
    x += 196
sheet.save(ROOT / "tools/icon_preview.png")
print("Icons and splash screens written")
