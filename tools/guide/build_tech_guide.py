# Builds Mohalla_Tech_and_Presentation_Guide.pdf: how Mohalla works under the hood (architecture, request flow,
# database, OpenStreetMap pipeline, security, Android, hosting, testing) + how to make the PPT engaging and funny.
# Run: python tools/guide/build_tech_guide.py   (needs reportlab; uses screenshots from tools/ppt/shots)
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table,
                                TableStyle, Image, PageBreak, KeepTogether, NextPageTemplate, CondPageBreak)

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / 'tools' / 'ppt' / 'shots'
LOGO = ROOT / 'tools' / 'ppt' / 'assets' / 'logo.png'
OUT = ROOT / 'Mohalla_Tech_and_Presentation_Guide.pdf'

F = 'C:/Windows/Fonts/'
pdfmetrics.registerFont(TTFont('UI', F + 'segoeui.ttf'))
pdfmetrics.registerFont(TTFont('UI-B', F + 'segoeuib.ttf'))
pdfmetrics.registerFont(TTFont('UI-I', F + 'segoeuii.ttf'))
pdfmetrics.registerFont(TTFont('UI-SB', F + 'seguisb.ttf'))
pdfmetrics.registerFont(TTFont('Mono', F + 'consola.ttf'))
pdfmetrics.registerFont(TTFont('Mono-B', F + 'consolab.ttf'))
pdfmetrics.registerFont(TTFont('Sym', F + 'seguisym.ttf'))
pdfmetrics.registerFontFamily('UI', normal='UI', bold='UI-B', italic='UI-I', boldItalic='UI-B')

YELLOW = colors.HexColor('#FFC567'); PINK = colors.HexColor('#FB7DA8'); RED = colors.HexColor('#FD5A46')
PURPLE = colors.HexColor('#552CB7'); GREEN = colors.HexColor('#00995E'); BLUE = colors.HexColor('#058CD7')
INK = colors.HexColor('#111111'); CREAM = colors.HexColor('#FFF8EC'); GREY = colors.HexColor('#5A5A5A')
LIGHT_Y = colors.HexColor('#FFF0D1'); LIGHT_P = colors.HexColor('#EFE9FF'); LIGHT_G = colors.HexColor('#E3F5EC')
LIGHT_B = colors.HexColor('#E2F2FC'); LIGHT_R = colors.HexColor('#FFE6E2')
DARK = (PURPLE, BLUE, RED, GREEN)

W, H = A4
M = 18 * mm
IW = W - 2 * M - 4

s = {
    'body': ParagraphStyle('body', fontName='UI', fontSize=10.5, leading=15, textColor=INK, spaceAfter=5),
    'small': ParagraphStyle('small', fontName='UI', fontSize=9, leading=12.5, textColor=GREY),
    'h1': ParagraphStyle('h1', fontName='UI-B', fontSize=22, leading=27, textColor=INK, spaceAfter=4),
    'h2': ParagraphStyle('h2', fontName='UI-B', fontSize=13, leading=17, textColor=INK, spaceBefore=8, spaceAfter=4),
    'lead': ParagraphStyle('lead', fontName='UI', fontSize=11.5, leading=16.5, textColor=GREY, spaceAfter=10),
    'cell': ParagraphStyle('cell', fontName='UI', fontSize=9.5, leading=13, textColor=INK),
    'cellb': ParagraphStyle('cellb', fontName='UI-B', fontSize=9.5, leading=13, textColor=INK),
    'say': ParagraphStyle('say', fontName='UI-I', fontSize=10.2, leading=14.5, textColor=INK),
    'do': ParagraphStyle('do', fontName='UI', fontSize=10, leading=14, textColor=INK),
    'code': ParagraphStyle('code', fontName='Mono', fontSize=9.5, leading=13.5, textColor=colors.white),
    'part': ParagraphStyle('part', fontName='UI-B', fontSize=34, leading=40, textColor=INK),
}

def P(t, st='body'): return Paragraph(t, s[st])
def mono(t): return f'<font name="Mono">{t}</font>'

def boxed(flow, bg=colors.white, pad=8, border=1.6, width=IW):
    t = Table([[flow]], colWidths=[width])
    t.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), border, INK), ('BACKGROUND', (0, 0), (-1, -1), bg),
                           ('LEFTPADDING', (0, 0), (-1, -1), pad + 2), ('RIGHTPADDING', (0, 0), (-1, -1), pad + 2),
                           ('TOPPADDING', (0, 0), (-1, -1), pad), ('BOTTOMPADDING', (0, 0), (-1, -1), pad)]))
    return t

def callout(label, text, color=PURPLE, bg=LIGHT_Y):
    """Quote-style box with a coloured bar and a small label (SAY, JOKE, TIP...)."""
    t = Table([[P(f'<font name="UI-B" size="8.5" color="{color.hexval().replace("0x", "#")}">{label}</font>', 'do')],
               [P(text, 'say')]], colWidths=[IW])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), bg), ('LINEBEFORE', (0, 0), (0, -1), 4, color),
                           ('LEFTPADDING', (0, 0), (-1, -1), 9), ('TOPPADDING', (0, 0), (-1, -1), 3),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    return t

def code(*lines):
    rows = []
    for ln in lines:
        cmd, cmt = ln if isinstance(ln, tuple) else (ln, '')
        txt = f'<font name="Mono-B">{cmd}</font>' + (f'<font color="#FFC567">   // {cmt}</font>' if cmt else '')
        rows.append([Paragraph(txt, s['code'])])
    t = Table(rows, colWidths=[IW])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#1E1E24')), ('BOX', (0, 0), (-1, -1), 1.6, INK),
                           ('LEFTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 2),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 2), ('TOPPADDING', (0, 0), (-1, 0), 7),
                           ('BOTTOMPADDING', (0, -1), (-1, -1), 7)]))
    return t

def table(rows, widths, head_bg=YELLOW, zebra=True):
    data = [[P(c, 'cellb') if isinstance(c, str) else c for c in rows[0]]] + \
           [[P(c, 'cell') if isinstance(c, str) else c for c in r] for r in rows[1:]]
    t = Table(data, colWidths=widths, repeatRows=1)
    st = [('BOX', (0, 0), (-1, -1), 1.6, INK), ('INNERGRID', (0, 0), (-1, -1), 0.6, INK),
          ('BACKGROUND', (0, 0), (-1, 0), head_bg), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
          ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
          ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]
    if head_bg in DARK:
        st.append(('TEXTCOLOR', (0, 0), (-1, 0), colors.white))
        data[0] = [P(f'<font color="white">{c}</font>', 'cellb') if isinstance(c, str) else c for c in rows[0]]
        t = Table(data, colWidths=widths, repeatRows=1)
    if zebra:
        for i in range(2, len(rows), 2): st.append(('BACKGROUND', (0, i), (-1, i), CREAM))
    t.setStyle(TableStyle(st))
    return t

def section(num, title, color):
    fg = 'white' if color in DARK else '#111111'
    badge = Paragraph(f'<font name="UI-B" size="12.5" color="white">{num}</font>', ParagraphStyle('b', alignment=1, leading=16))
    ttl = Paragraph(f'<font name="UI-B" size="15" color="{fg}">{title}</font>', ParagraphStyle('t', leading=19))
    t = Table([[badge, ttl]], colWidths=[14 * mm, IW - 14 * mm], rowHeights=[10 * mm])
    t.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 1.8, INK), ('LINEAFTER', (0, 0), (0, 0), 1.8, INK),
                           ('BACKGROUND', (0, 0), (0, 0), INK), ('BACKGROUND', (1, 0), (1, 0), color),
                           ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (1, 0), (1, 0), 10)]))
    return [CondPageBreak(60 * mm), Spacer(1, 4), t, Spacer(1, 8)]

def shot(name, width):
    img = Image(str(SHOTS / f'{name}.png'))
    r = img.imageHeight / img.imageWidth
    img.drawWidth, img.drawHeight = width, width * r
    t = Table([[img]], colWidths=[width + 3])
    t.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 1.6, INK)] +
                          [(k, (0, 0), (-1, -1), 0) for k in ('LEFTPADDING', 'RIGHTPADDING', 'TOPPADDING', 'BOTTOMPADDING')]))
    return t

def side_by_side(left, right, split=0.58):
    t = Table([[left, right]], colWidths=[IW * split, IW * (1 - split)])
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                           ('RIGHTPADDING', (0, 0), (0, 0), 10), ('RIGHTPADDING', (1, 0), (1, 0), 0)]))
    return t

def stats_row(items):
    """Big-number tiles: [(number, label, colour)]."""
    cells = []
    for num, label, col in items:
        fg = 'white' if col in DARK else '#111111'
        cells.append([Paragraph(f'<font name="UI-B" size="20" color="{fg}">{num}</font>', ParagraphStyle('n', leading=24)),
                      Paragraph(f'<font size="8.5" color="{fg}">{label}</font>', ParagraphStyle('l', fontName='UI', leading=11))])
    w = IW / len(items)
    t = Table([[c for c in cells]], colWidths=[w] * len(items))
    st = [('BOX', (0, 0), (-1, -1), 1.6, INK), ('INNERGRID', (0, 0), (-1, -1), 1.6, INK),
          ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 8),
          ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]
    for i, (_, _, col) in enumerate(items): st.append(('BACKGROUND', (i, 0), (i, 0), col))
    t.setStyle(TableStyle(st))
    return t

# ---------- diagram helpers (reportlab graphics) ----------
def dbox(d, x, y, w, h, fill, title, lines=(), title_size=10.5, fg=None):
    fg = fg or (colors.white if fill in DARK else INK)
    d.add(Rect(x + 4, y - 4, w, h, fillColor=INK, strokeColor=None))
    d.add(Rect(x, y, w, h, fillColor=fill, strokeColor=INK, strokeWidth=1.8))
    d.add(String(x + w / 2, y + h - 15, title, fontName='UI-B', fontSize=title_size, fillColor=fg, textAnchor='middle'))
    for i, ln in enumerate(lines):
        d.add(String(x + w / 2, y + h - 29 - i * 11, ln, fontName='UI', fontSize=8, fillColor=fg, textAnchor='middle'))

def arrow(d, x1, y1, x2, y2, label=None, color=INK, lx=0, ly=0, both=False):
    import math
    d.add(Line(x1, y1, x2, y2, strokeColor=color, strokeWidth=1.6))
    def head(xa, ya, xb, yb):
        a = math.atan2(yb - ya, xb - xa); L = 7
        d.add(Polygon([xb, yb, xb - L * math.cos(a - 0.4), yb - L * math.sin(a - 0.4),
                       xb - L * math.cos(a + 0.4), yb - L * math.sin(a + 0.4)], fillColor=color, strokeColor=color))
    head(x1, y1, x2, y2)
    if both: head(x2, y2, x1, y1)
    if label:
        d.add(String((x1 + x2) / 2 + lx, (y1 + y2) / 2 + ly, label, fontName='UI-SB', fontSize=7.8, fillColor=GREY,
                     textAnchor='middle'))

def scaled(draw_fn, lw, lh):
    """Draw on a logical lw x lh canvas, then scale the whole drawing to the page width."""
    from reportlab.graphics.shapes import Group
    k = IW / lw
    inner = Drawing(lw, lh)
    draw_fn(inner)
    g = Group(*inner.contents)
    g.scale(k, k)
    d = Drawing(IW, lh * k)
    d.add(g)
    return d

def architecture_diagram():
    def draw(d):
        d.add(Rect(0, 0, 600, 330, fillColor=CREAM, strokeColor=INK, strokeWidth=1.6))
        # clients (left)
        dbox(d, 16, 236, 150, 66, BLUE, 'Browser', ['React website', 'laptop / phone Chrome'])
        dbox(d, 16, 140, 150, 66, GREEN, 'Android app (APK)', ['same React code', 'wrapped by Capacitor'])
        dbox(d, 16, 22, 150, 62, PINK, 'Map & satellite tiles', ['OSM tiles (Leaflet map)', 'Esri World Imagery'])
        # server (middle)
        dbox(d, 214, 130, 172, 180, PURPLE, 'Render (cloud)', [])
        d.add(Rect(228, 228, 144, 50, fillColor=colors.white, strokeColor=INK, strokeWidth=1.2))
        d.add(String(300, 259, 'Express REST API', fontName='UI-B', fontSize=9.5, fillColor=INK, textAnchor='middle'))
        d.add(String(300, 245, '38 routes · JWT · JSON', fontName='UI', fontSize=7.8, fillColor=GREY, textAnchor='middle'))
        d.add(Rect(228, 146, 144, 62, fillColor=colors.white, strokeColor=INK, strokeWidth=1.2))
        d.add(String(300, 190, 'Static website', fontName='UI-B', fontSize=9.5, fillColor=INK, textAnchor='middle'))
        d.add(String(300, 176, 'client/dist (built by Vite)', fontName='UI', fontSize=7.8, fillColor=GREY, textAnchor='middle'))
        d.add(String(300, 164, 'same Node.js process', fontName='UI', fontSize=7.8, fillColor=GREY, textAnchor='middle'))
        dbox(d, 232, 22, 136, 66, YELLOW, 'SQLite database', ['built into Node.js', '8 tables · data.db'])
        # outside services (right)
        dbox(d, 430, 214, 154, 88, RED, 'OpenStreetMap', ['Overpass: places nearby', 'Nominatim: names / areas', 'Wikidata: real photos'])
        dbox(d, 430, 40, 154, 62, colors.white, 'GitHub', ['code + Releases (APK)', 'push → auto-deploy'])
        # arrows
        arrow(d, 170, 269, 210, 269, both=True)
        arrow(d, 170, 173, 210, 173, both=True)
        d.add(String(190, 226, 'HTTPS', fontName='UI-SB', fontSize=7.8, fillColor=GREY, textAnchor='middle'))
        d.add(String(190, 216, '+ JSON', fontName='UI-SB', fontSize=7.8, fillColor=GREY, textAnchor='middle'))
        arrow(d, 300, 128, 300, 92)
        d.add(String(308, 106, 'SQL', fontName='UI-SB', fontSize=7.8, fillColor=GREY))
        arrow(d, 390, 258, 426, 258)
        d.add(String(408, 263, 'fetch', fontName='UI-SB', fontSize=7.8, fillColor=GREY, textAnchor='middle'))
        arrow(d, 91, 138, 91, 88)
        d.add(String(97, 110, 'map tiles load', fontName='UI-SB', fontSize=7.8, fillColor=GREY))
        d.add(String(97, 100, 'straight into the app', fontName='UI-SB', fontSize=7.8, fillColor=GREY))
        arrow(d, 426, 72, 390, 140)
        d.add(String(414, 112, 'deploy', fontName='UI-SB', fontSize=7.8, fillColor=GREY))
    return scaled(draw, 600, 330)

def flow_diagram():
    """The life of one search request: 6 steps in two rows (row 2 runs right to left)."""
    steps = [(BLUE, '1 · Smart Ask', ['reads the sentence', 'in the browser']),
             (GREEN, '2 · api.js', ['GET /api/businesses', '?category=ac-repair&openNow=1']),
             (PURPLE, '3 · Express', ['auth(false) reads the', 'JWT token, if any']),
             (YELLOW, '4 · SQLite', ['SELECT businesses +', 'ratings, review counts']),
             (PINK, '5 · Rank & filter', ['relevance, open now,', 'live status, distance']),
             (RED, '6 · React', ['draws the cards', 'from the JSON'])]
    def draw(d):
        bw, bh, gap = 170, 62, 45
        pos = [(0, 1), (1, 1), (2, 1), (2, 0), (1, 0), (0, 0)]
        for (col, t, ls), (cx, row) in zip(steps, pos):
            dbox(d, cx * (bw + gap) + 4, 22 + row * (bh + 30), bw, bh, col, t, ls)
        y1, y0 = 22 + bh + 30 + bh / 2, 22 + bh / 2
        arrow(d, 4 + bw + 3, y1, 4 + bw + gap - 3, y1)
        arrow(d, 4 + 2 * bw + gap + 3, y1, 4 + 2 * (bw + gap) - 3, y1)
        arrow(d, 4 + 2 * (bw + gap) + bw / 2, 22 + bh + 30 - 3, 4 + 2 * (bw + gap) + bw / 2, 22 + bh + 5)
        arrow(d, 4 + 2 * (bw + gap) - 3, y0, 4 + 2 * bw + gap + 3, y0)
        arrow(d, 4 + bw + gap - 3, y0, 4 + bw + 3, y0)
        d.add(String(320, 4, 'Round trip: well under a second (plus up to ~1 min if the free Render server was asleep).',
                     fontName='UI-I', fontSize=8.5, fillColor=GREY, textAnchor='middle'))
    return scaled(draw, 640, 22 + 2 * 62 + 30 + 10)

def er_diagram():
    dw, dh = IW, 300
    d = Drawing(dw, dh)
    d.add(Rect(0, 0, dw, dh, fillColor=CREAM, strokeColor=INK, strokeWidth=1.6))
    def table_box(x, y, name, cols, col=YELLOW, w=128):
        h = 20 + 11.5 * len(cols) + 6
        d.add(Rect(x + 4, y - 4, w, h, fillColor=INK, strokeColor=None))
        d.add(Rect(x, y, w, h, fillColor=colors.white, strokeColor=INK, strokeWidth=1.5))
        d.add(Rect(x, y + h - 20, w, 20, fillColor=col, strokeColor=INK, strokeWidth=1.5))
        d.add(String(x + 8, y + h - 14, name, fontName='UI-B', fontSize=9.5, fillColor=colors.white if col in DARK else INK))
        for i, c in enumerate(cols):
            d.add(String(x + 8, y + h - 33 - i * 11.5, c, fontName='Mono', fontSize=7.6, fillColor=INK))
        return (x, y, w, h)
    u = table_box(14, 175, 'users', ['id  PK', 'name, email UNIQUE', 'password (bcrypt)', 'phone', 'role user|business|admin'], BLUE)
    c = table_box(14, 30, 'categories', ['id  PK', 'name, slug UNIQUE', 'icon, color', 'keywords'], GREEN)
    b = table_box(190, 120, 'businesses', ['id  PK', 'owner_id → users', 'category_id → categories', 'name, phone, address',
                                            'lat, lng, hours (JSON)', 'photos, services (JSON)', 'is_approved/verified', 'source local|osm, osm_id',
                                            'live_status, _at'], PURPLE, w=150)
    r = table_box(372, 205, 'reviews', ['user_id → users', 'business_id → biz', 'rating CHECK 1–5', 'UNIQUE(user, biz)'], RED)
    e = table_box(372, 92, 'enquiries', ['user_id, business_id', 'name, phone, message', 'hide_phone (Privacy)', 'status new|contacted'], PINK)
    m = table_box(372, 14, 'enquiry_messages', ['enquiry_id → enquiries', 'sender, text'], YELLOW)
    f = table_box(190, 22, 'favorites', ['PK(user_id, business_id)'], BLUE, w=150)
    table_box(14, 250, 'synced_areas', ['area_key PK, found'], colors.HexColor('#DDDDDD'), w=150) if False else None
    d.add(String(dw - 10, 286, 'synced_areas (OSM cache) is the 8th table — no links', fontName='UI-I', fontSize=7.8,
                 fillColor=GREY, textAnchor='end'))
    # relations
    arrow(d, 146, 215, 186, 215, '1 → many', ly=5)
    arrow(d, 146, 60, 186, 160, '1 → many', lx=-14)
    arrow(d, 344, 230, 368, 240)
    arrow(d, 344, 170, 368, 130)
    arrow(d, 438, 92, 438, 56, 'chat', lx=14)
    arrow(d, 265, 120, 265, 54)
    return d

# ---------- page decorations ----------
def cover_page(c, doc):
    c.saveState()
    c.setFillColor(PURPLE); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setStrokeColor(colors.HexColor('#6A45CC')); c.setLineWidth(0.5)
    for x in range(0, int(W), 22): c.line(x, 0, x, H)
    for y in range(0, int(H), 22): c.line(0, y, W, y)
    cx, cy, cw, ch = M, H * 0.28, W - 2 * M, H * 0.54
    c.setFillColor(INK); c.rect(cx + 7, cy - 7, cw, ch, fill=1, stroke=0)
    c.setFillColor(colors.white); c.setStrokeColor(INK); c.setLineWidth(3); c.rect(cx, cy, cw, ch, fill=1, stroke=1)
    if LOGO.exists(): c.drawImage(str(LOGO), cx + 26, cy + ch - 120, 92, 92, mask='auto')
    c.setFillColor(INK); c.setFont('UI-B', 40); c.drawString(cx + 26, cy + ch - 170, 'Mohalla.')
    c.setFont('UI', 14); c.setFillColor(GREY); c.drawString(cx + 26, cy + ch - 194, 'Your neighbourhood, one tap away')
    c.setFillColor(INK); c.setFont('UI-B', 25)
    c.drawString(cx + 26, cy + ch - 250, 'How It Works')
    c.drawString(cx + 26, cy + ch - 280, '& How to Present It')
    c.setFont('UI', 12); c.setFillColor(GREY)
    for i, ln in enumerate(['Part A: the architecture and every technical piece, explained simply.',
                            'Part B: a slide-by-slide plan to make the PPT engaging (and funny),',
                            'the demo as a story, and tough viva questions with answers.']):
        c.drawString(cx + 26, cy + ch - 308 - i * 17, ln)
    x = cx + 26
    for label, col in [('Architecture', BLUE), ('Database', GREEN), ('Security', RED), ('Presenting', YELLOW)]:
        tw = pdfmetrics.stringWidth(label, 'UI-B', 11) + 22
        c.setFillColor(INK); c.roundRect(x + 3, cy + 30 - 3, tw, 24, 6, fill=1, stroke=0)
        c.setFillColor(col); c.setStrokeColor(INK); c.setLineWidth(2); c.roundRect(x, cy + 30, tw, 24, 6, fill=1, stroke=1)
        c.setFillColor(INK if col == YELLOW else colors.white); c.setFont('UI-B', 11); c.drawString(x + 11, cy + 38, label)
        x += tw + 12
    c.setFillColor(colors.white); c.setFont('UI', 10)
    c.drawString(M, M + 6, 'Anshul Nautiyal  ·  College project  ·  Live: mohalla-b0lx.onrender.com')
    c.restoreState()

def part_page(title, sub, color):
    def draw(c, doc):
        c.saveState()
        c.setFillColor(color); c.rect(0, 0, W, H, fill=1, stroke=0)
        c.setStrokeColor(colors.Color(0, 0, 0, alpha=0.08)); c.setLineWidth(0.5)
        for x in range(0, int(W), 22): c.line(x, 0, x, H)
        for y in range(0, int(H), 22): c.line(0, y, W, y)
        fg = colors.white if color in DARK else INK
        c.setFillColor(fg); c.setFont('UI-B', 60); c.drawString(M, H * 0.55, title)
        c.setFont('UI', 15)
        for i, ln in enumerate(sub): c.drawString(M + 3, H * 0.55 - 40 - i * 21, ln)
        c.restoreState()
    return draw

def normal_page(c, doc):
    c.saveState()
    c.setFillColor(YELLOW); c.rect(0, H - 9 * mm, W, 9 * mm, fill=1, stroke=0)
    c.setStrokeColor(INK); c.setLineWidth(1.5); c.line(0, H - 9 * mm, W, H - 9 * mm)
    c.setFillColor(INK); c.setFont('UI-B', 9.5); c.drawString(M, H - 6 * mm, 'Mohalla.  How It Works & How to Present It')
    c.setFont('UI', 9.5); c.drawRightString(W - M, H - 6 * mm, f'Page {doc.page}')
    c.restoreState()

doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=M, rightMargin=M, topMargin=16 * mm, bottomMargin=14 * mm,
                      title='Mohalla — How It Works & How to Present It', author='Anshul Nautiyal',
                      subject='Technical architecture of Mohalla and a guide to presenting it')
frame = Frame(M, 14 * mm, W - 2 * M, H - 30 * mm, id='f', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
blank = Frame(M, M, W - 2 * M, H - 2 * M, id='b')
doc.addPageTemplates([
    PageTemplate('cover', [frame], onPage=cover_page),
    PageTemplate('normal', [frame], onPage=normal_page),
    PageTemplate('partA', [blank], onPage=part_page('Part A', ['How Mohalla works', 'architecture · request flow · database · real data',
                                                               'security · Android · hosting · testing'], BLUE)),
    PageTemplate('partB', [blank], onPage=part_page('Part B', ['How to present it', 'hooks · slide-by-slide script with jokes',
                                                               'demo as a story · humour rules · tough viva questions'], YELLOW)),
])

story = [NextPageTemplate('normal'), PageBreak()]

# ====================== CONTENTS ======================
story += [P('What\'s inside', 'h1'),
          P('Part A explains the project so you can answer any “how does it work?” question. Part B turns that into a '
            'presentation people actually enjoy. Read Part A once; rehearse Part B twice.', 'lead')]
story.append(table([
    ['#', 'Section', 'Use it for'],
    ['A1', 'The big picture (architecture diagram)', 'Slide 12 · “explain your architecture”'],
    ['A2', 'Life of one search request', 'Explaining how all parts work together'],
    ['A3', 'Frontend: React website + screens', 'Slides 4, 6 · frontend questions'],
    ['A4', 'Backend: Express API and its 38 routes', 'Backend / API questions'],
    ['A5', 'Database design (ER diagram)', 'Slide 13 · database questions'],
    ['A6', 'Real data from OpenStreetMap', 'Slide 7 · “is the data real?”'],
    ['A7', 'The 4 unique features under the hood', 'Slides 5, 6, 8, 9'],
    ['A8', 'Security', '“Are passwords safe?” and similar'],
    ['A9', 'Android app', 'Slide 10'],
    ['A10', 'Hosting, GitHub & deployment', '“Is it live?” · cloud questions'],
    ['A11', 'Testing, numbers & honest limitations', 'Slide 15 · tricky questions'],
    ['A12', 'Jargon in one line each', 'Quick revision before the viva'],
    ['B1', 'The 7 golden rules of an engaging talk', 'Mindset'],
    ['B2', 'Three opening hooks', 'The first 30 seconds'],
    ['B3', 'Slide-by-slide script with jokes (all 17 slides)', 'The actual talk'],
    ['B4', 'The live demo as a story', 'The demo'],
    ['B5', 'Humour rules and rescue lines', 'When a joke or the demo flops'],
    ['B6', 'Voice, body language, team roles, rehearsal plan', 'Delivery'],
    ['B7', 'Tough viva questions with model answers', 'Questions round'],
], [IW * 0.08, IW * 0.50, IW * 0.42]))
story.append(Spacer(1, 10))
story.append(stats_row([('38', 'API routes', BLUE), ('8', 'database tables', GREEN), ('95', 'automated tests, all pass', PURPLE),
                        ('~4,700', 'lines of app code', YELLOW), ('₹0', 'total cost', RED)]))

# ====================== PART A ======================
story += [NextPageTemplate('partA'), PageBreak(), NextPageTemplate('normal'), Spacer(1, 1), PageBreak()]

story += section('A1', 'The big picture', BLUE)
story += [P('Mohalla is a <b>client–server</b> app. The <b>clients</b> (the website in a browser and the Android app) only '
            'show screens. All data lives on <b>one server</b>, which answers requests through a <b>REST API</b> that speaks '
            '<b>JSON</b>. The same server also hands out the website itself, so one Node.js process runs everything.'),
          architecture_diagram(), Spacer(1, 8)]
story.append(callout('EXPLAIN IT LIKE A RESTAURANT', 'The <b>React app</b> is the waiter: it takes your order and brings the food. '
                     'The <b>Express API</b> is the kitchen counter: it checks the order is valid and who you are. '
                     '<b>SQLite</b> is the fridge where everything is stored. <b>OpenStreetMap</b> is the vegetable market '
                     'we go to when the fridge doesn\'t have something yet. And <b>Render</b> is the building we rent — '
                     'for free, so it closes when nobody is eating.', GREEN, LIGHT_G))

story += section('A2', 'Life of one search request', GREEN)
story += [P('Follow one search from typing to results — this is the best way to show you understand the whole system. '
            'The user types <i>“my AC is not cooling, need someone urgently”</i>:'),
          flow_diagram(), Spacer(1, 4)]
story.append(table([
    ['Step', 'What happens', 'Where in the code'],
    ['1', 'Smart Ask spots <b>“ac”, “not cooling”</b> → category AC Repair, and <b>“urgently”</b> → Open now + nearest first. '
          'This runs in the browser, no server needed.', mono('client/src/smartAsk.js')],
    ['2', 'The React page builds the URL and calls the API with ' + mono('fetch') + '. If logged in, it adds the JWT token '
          'in the ' + mono('Authorization: Bearer …') + ' header.', mono('client/src/api.js')],
    ['3', 'Express receives the request. The ' + mono('auth(false)') + ' middleware reads the token if there is one '
          '(search works logged-out too).', mono('server/index.js')],
    ['4', 'One SQL query fetches approved businesses with their category, average rating and review count.',
          mono('BIZ_SELECT') + ' in index.js'],
    ['5', 'JavaScript then scores relevance, works out <b>open now</b> from the timings, applies the owner\'s <b>Live Status</b> '
          '(ignored if older than 12 h), measures distance from your GPS, filters, sorts and pages the list.',
          mono('relevance()') + ', ' + mono('isOpenNow()')],
    ['6', 'The JSON comes back and React draws the business cards, badges and the map.',
          mono('pages/Search.jsx') + ', ' + mono('BusinessCard.jsx')],
], [IW * 0.08, IW * 0.64, IW * 0.28], head_bg=GREEN))

story += section('A3', 'Frontend — what the user sees', PINK)
story += [side_by_side([
    P('The frontend is a <b>single-page app (SPA)</b> written in <b>React 19</b> and built with <b>Vite</b>. '
      'The browser loads one page once; after that <b>React Router</b> swaps screens instantly without reloading.'),
    P('<b>Screens</b> (' + mono('src/pages') + '): Home, Search, BusinessDetail, Auth (login/register), Profile, Dashboard '
      '(owner), BusinessForm, Admin, Emergency, Credits, ServerSetup.'),
    P('<b>Reusable components</b> (' + mono('src/components') + '): BusinessCard, SearchBar, MapView, EnquiryModal, '
      'EnquiryThread (chat), LeadForm, LocationPrompt, Stars, Toast.'),
    P('<b>Maps</b>: Leaflet with OpenStreetMap tiles. The satellite picture on a card is made by working out which '
      'Esri satellite <i>tile</i> contains the business\'s latitude/longitude — no API key needed.'),
    P('<b>Location</b>: the browser\'s ' + mono('navigator.geolocation') + ' (GPS on phones).'),
    P('<b>Design</b>: our own CSS — retro flat style with thick black outlines and hard shadows, from a fixed colour palette.'),
], shot('smart-ask', IW * 0.38))]

story += section('A4', 'Backend — the Express API', PURPLE)
story += [P('The server is <b>Node.js + Express 5</b>. Every request passes through a chain of <b>middleware</b> '
            '(small functions that run in order) before reaching its route:'),
          code(('cors()', 'allow the Android app / other origins to call the API'),
               ("express.json({ limit: '1mb' })", 'read JSON bodies, reject huge ones'),
               ('auth(true | false)', 'read the JWT → req.user  (true = must be logged in)'),
               ("allow('business', 'admin')", 'role check → 403 if not allowed'),
               ('route handler', 'run SQL, return JSON')),
          Spacer(1, 8),
          P('The <b>38 routes</b>, grouped:', 'h2'),
          table([
              ['Group', 'Routes', 'Who'],
              ['Auth', 'POST /api/auth/register · POST /api/auth/login · GET /api/auth/me', 'Anyone'],
              ['Search & browse', 'GET /api/businesses · /api/businesses/:id · /api/suggest · /api/categories · /api/cities · /api/stats', 'Anyone'],
              ['Real places', 'POST /api/nearby (import from OpenStreetMap) · POST /api/businesses/:id/claim', 'Anyone / owners'],
              ['Listings', 'POST, PUT, DELETE /api/businesses · POST, DELETE …/photos · PATCH …/live-status', 'Owner of it, or admin'],
              ['Reviews', 'POST /api/businesses/:id/reviews · DELETE /api/reviews/:id', 'Logged-in users'],
              ['Enquiries & chat', 'POST …/enquiries · POST /api/leads · GET/POST /api/enquiries/:id/messages · PATCH /api/enquiries/:id', 'Customer & owner'],
              ['Favourites & “my”', 'GET/POST/DELETE /api/favorites · GET /api/my/reviews, businesses, enquiries, sent-enquiries', 'Logged-in users'],
              ['Admin', 'GET /api/admin/stats, businesses, users · PATCH businesses · DELETE users · POST/DELETE categories', 'Admin only'],
          ], [IW * 0.18, IW * 0.62, IW * 0.20], head_bg=PURPLE),
          Spacer(1, 6),
          P('REST in one line: the URL says <b>what</b> (a business, a review), the HTTP verb says <b>what to do</b> '
            '(GET read, POST create, PUT/PATCH update, DELETE remove), and the status code says <b>how it went</b> '
            '(200 OK, 401 not logged in, 403 not allowed, 404 not found).', 'small')]

story += section('A5', 'Database design', YELLOW)
story += [P('We use <b>SQLite</b>, which is built into Node.js 22+ (' + mono('node:sqlite') + '). The whole database is '
            'one file, so there is no database server to install. Tables are created on start-up with '
            + mono('CREATE TABLE IF NOT EXISTS') + ', and new columns are added safely by a tiny migration helper '
            '(' + mono('addColumn') + ') — so old databases upgrade themselves.'),
          er_diagram(), Spacer(1, 8),
          table([
              ['Design choice', 'Why it matters'],
              ['<b>Foreign keys</b> (e.g. reviews.business_id → businesses.id)', 'Links rows together; a review always belongs to a real user and business.'],
              ['<b>ON DELETE CASCADE</b>', 'Delete a business and its reviews, enquiries and chat go with it — no orphan rows.'],
              ['<b>UNIQUE(user_id, business_id)</b> on reviews', 'One review per person per business — stops rating-spam.'],
              ['<b>CHECK (rating BETWEEN 1 AND 5)</b>', 'The database itself refuses a 6-star or 0-star rating.'],
              ['<b>Indexes</b> on reviews, enquiries, owner, osm_id', 'Fast look-ups as data grows; the unique osm_id index stops importing the same real place twice.'],
              ['<b>JSON in TEXT columns</b> (hours, photos, services)', 'Flexible lists without extra tables — fine at this size.'],
              ['<b>Prepared statements</b> with ' + mono('?') + ' placeholders', 'User input is never pasted into SQL → no SQL injection.'],
          ], [IW * 0.42, IW * 0.58])]

story += section('A6', 'Real data from OpenStreetMap', RED)
story += [P('When you allow location, the app calls ' + mono('POST /api/nearby') + ' and the server\'s '
            + mono('osm.js') + ' does this:'),
          table([
              ['#', 'Step', 'Detail'],
              ['1', 'Round your position to a ~1 km grid', 'e.g. 17.49, 78.40 — neighbours share one cache entry.'],
              ['2', 'Check the cache', 'If this area was loaded in the last 24 h (' + mono('synced_areas') + ' table), stop here — instant.'],
              ['3', 'Ask the Overpass API', 'Everything with a name within 2 km that is a shop, clinic, ATM, restaurant… (up to 400). '
                                             'Three mirror servers are tried in turn if one is busy.'],
              ['4', 'Translate tags → our categories', 'A TAG_MAP turns OSM tags like ' + mono('amenity=dentist') + ' into our '
                                                       + mono('doctors') + ' category, ' + mono('shop=hairdresser') + ' into Beauty & Spa, etc.'],
              ['5', 'Read timings & services', 'Parses OSM ' + mono('opening_hours') + ' and tags like cuisine or wheelchair access.'],
              ['6', 'Find a real photo', 'OSM image tag → Wikimedia Commons, or the Wikidata item\'s photo (P18), 50 at a time. '
                                         'No photo? The card shows a satellite view of the exact spot instead of a fake stock image.'],
              ['7', 'Name the area', 'Nominatim reverse-geocodes the point (e.g. “KPHB Colony, Hyderabad”).'],
              ['8', 'Save', 'Upsert into ' + mono('businesses') + ' with ' + mono("source='osm'") + '; the unique '
                            + mono('osm_id') + ' prevents duplicates. Owners can later <b>claim</b> them.'],
          ], [IW * 0.06, IW * 0.30, IW * 0.64], head_bg=RED),
          Spacer(1, 6),
          P('Searching a name that isn\'t saved yet (e.g. a college) also triggers a live Nominatim lookup. '
            'On the live server, one call near KPHB imported 400 real places in a few seconds.', 'small')]

story += section('A7', 'The 4 unique features — under the hood', BLUE)
story.append(table([
    ['Feature', 'How it actually works'],
    ['<b>Smart Ask</b>', 'Rule-based language understanding (no paid AI). Word lists per category in English + Hinglish '
     '(“bijli”, “dawai”, “khana”, “nal”…). Urgent words (“urgent”, “abhi”, “jaldi”) → Open now + nearest. '
     '“near me”, “paas” → sort by distance. “best”, “acha” → Top Rated. If the text looks like a name, '
     'not a question, it searches the name instead. Works offline and costs ₹0.'],
    ['<b>Privacy Mode</b>', 'The enquiry is saved with ' + mono('hide_phone = 1') + '. When the owner\'s dashboard asks for '
     'enquiries, the server masks the number before sending it (only the last 2 digits show). Both sides talk through '
     + mono('enquiry_messages') + ' — an in-app chat. The real number never leaves the server.'],
    ['<b>Live Status</b>', 'Owner taps Available / Busy / Closed today → saved with a timestamp. When listings are read, a status '
     'older than <b>12 hours</b> is ignored, so a forgotten “Available” can\'t mislead customers. “Closed today” also removes '
     'the business from Open-now results.'],
    ['<b>Emergency mode</b>', 'No login needed. Gets your GPS, pulls the nearest hospitals, pharmacies and ATMs (real OSM data), '
     'sorts by distance, shows Call / Go buttons and the helplines 112, 108, 100, 101, 1091.'],
    ['<b>Bonus</b>', 'Walking time next to nearby places; and if nothing is open, results fall back to the nearest places with '
     'their next opening time instead of an empty page.'],
], [IW * 0.20, IW * 0.80], head_bg=BLUE))

story += section('A8', 'Security', RED)
story.append(table([
    ['Threat', 'What we did'],
    ['Stolen database leaks passwords', 'Passwords are hashed with <b>bcrypt</b> (10 rounds, salted). We store the hash, never the password. '
     'Even we can\'t read them.'],
    ['Someone pretends to be another user', 'Login returns a <b>JWT</b> signed with a secret key (valid 30 days). Changing even one character '
     'of the token breaks the signature, so the server rejects it. The secret lives in an environment variable on Render.'],
    ['A customer opens the admin panel', 'Role checks on the <b>server</b> (' + mono('allow(\'admin\')') + '), not just hidden buttons. '
     'Owners can only edit their own listings (' + mono('canEdit') + ').'],
    ['SQL injection', 'Every query uses prepared statements with ' + mono('?') + ' placeholders.'],
    ['Uploading a virus as “photo.jpg”', 'Only JPG/PNG/WEBP/GIF types, max 5 MB and 6 files, and we check the file\'s first bytes '
     '(its “magic number”) to prove it\'s really an image. Files get random UUID names.'],
    ['Huge requests to crash the server', 'JSON bodies are capped at 1 MB; list sizes are capped (max 50 per page).'],
    ['Spam calls (our main promise)', 'Privacy Mode masks phone numbers on the server before they are sent anywhere.'],
], [IW * 0.30, IW * 0.70], head_bg=RED))

story += section('A9', 'The Android app', GREEN)
story += [side_by_side([
    P('We didn\'t write a second app. <b>Capacitor 6</b> takes the same React code, builds it with '
      + mono('vite build --mode app') + ' into ' + mono('dist-app') + ', and packs it into a native Android project. '
      'Gradle then produces ' + mono('Mohalla.apk') + '.'),
    P('Inside the APK the screens are local files, so the app needs to know where the API is. That address is baked in at '
      'build time from ' + mono('client/.env.app') + ' (' + mono('VITE_API_URL=https://mohalla-b0lx.onrender.com') + ').'),
    P('On start, a <b>ServerGate</b> pings the server. Because the free Render server sleeps, it waits up to 75 seconds and '
      'shows “Waking up the server…”. If the server can\'t be reached, the <b>Connect to server</b> screen lets you use a laptop '
      'on the same Wi-Fi instead, or tap <b>Use online server</b> to switch back.'),
    P('Phone features used: GPS location, tel: links for Call, WhatsApp links, and Google Maps directions.'),
], shot('m-home', IW * 0.30), split=0.68)]

story += section('A10', 'Hosting, GitHub & deployment', PURPLE)
story += [P('<b>GitHub</b> (private repo <b>ANSHUL-REAL/mohalla</b>) stores the code; big files (APK, PPT, videos) are on the '
            '<b>Releases</b> page. <b>Render</b> watches the repo: every push to ' + mono('main') + ' rebuilds and redeploys '
            'automatically — that\'s basic <b>CI/CD</b>.'),
          code(('git push', 'code goes to GitHub'),
               ('npm run setup && npm run build', 'Render build: install packages, build the website'),
               ('npm run seed && npm start', 'Render start: fresh demo data, start the server on $PORT')),
          Spacer(1, 6),
          table([
              ['Render setting', 'Value / why'],
              ['Plan', 'Free web service — sleeps after ~15 min idle, wakes in ~1 min on the next visit.'],
              ['NODE_VERSION', '24 — the version we tested on (built-in SQLite needs 22.13+).'],
              ['JWT_SECRET', 'Generated by Render, kept out of the code.'],
              ['Disk', 'Temporary on the free plan: the database resets on every restart, so the start command re-seeds demo data. '
                       'For real users we would add a persistent disk or PostgreSQL.'],
              ['HTTPS', 'Render gives a free certificate, so everything is encrypted in transit.'],
          ], [IW * 0.22, IW * 0.78], head_bg=PURPLE)]

story += section('A11', 'Testing, numbers & honest limitations', YELLOW)
story += [P('<b>Automated tests:</b> 95 tests in ' + mono('server/test/api.test.mjs') + ' using Node\'s built-in test runner. '
            'They start a fresh server with a separate test database and call every route: login, permissions, search filters, '
            'reviews, Privacy Mode masking, uploads, admin actions and bad input. A load test fires many searches in parallel. '
            'Stress-testing found ~20 bugs (crashes on bad input, an unsafe upload); all were fixed. All 95 pass, 0 errors under load.'),
          stats_row([('16', 'categories', BLUE), ('1,200+', 'demo reviews', GREEN), ('400', 'real places per area import', RED),
                     ('12 h', 'live-status expiry', PURPLE)]),
          Spacer(1, 8),
          P('Honest limitations — say these <i>before</i> the examiner does, it scores points:', 'h2'),
          table([
              ['Limitation', 'Why it\'s OK for now / the fix'],
              ['Free Render server sleeps and resets its data', 'Fine for a demo. Real launch: paid instance + persistent database.'],
              ['SQLite allows one writer at a time', 'Perfect for thousands of users. For lakhs: PostgreSQL — the SQL barely changes.'],
              ['Smart Ask is keyword rules, not real AI', 'Fast, free, offline and predictable. Next step: an AI model for harder sentences.'],
              ['OpenStreetMap is missing some Indian shops', 'That\'s why owners can add and claim listings — the data improves with use.'],
              ['Public Overpass servers can be slow', 'We cache each area for 24 h and fall back across three mirrors.'],
          ], [IW * 0.42, IW * 0.58])]

story += section('A12', 'Jargon in one line each', GREEN)
story.append(table([
    ['Term', 'Meaning in our project'],
    ['API / REST', 'The menu of URLs the apps call to get or change data (' + mono('GET /api/businesses') + ').'],
    ['JSON', 'The text format the data travels in: ' + mono('{"name": "CoolCare", "rating": 4.6}') + '.'],
    ['SPA', 'Single-page app: the site loads once, then React swaps screens without reloading.'],
    ['Middleware', 'A function every request passes through, e.g. checking the login token.'],
    ['JWT', 'A signed login “pass” the server gives you; you show it with every request.'],
    ['Hashing (bcrypt)', 'One-way scrambling of passwords; you can check a password but never reverse it.'],
    ['CORS', 'Browser rule about which websites may call an API; we allow the Android app to call ours.'],
    ['Foreign key / cascade', 'A link from one table\'s row to another\'s; cascade deletes linked rows together.'],
    ['Geolocation / geocoding', 'Getting your GPS position / turning coordinates into a place name (Nominatim).'],
    ['Capacitor', 'Tool that packs a web app into a real Android app.'],
    ['CI/CD', 'Push code → it is built and deployed automatically (GitHub → Render).'],
    ['Cold start', 'The first request after the free server slept; it takes ~1 minute to wake up.'],
], [IW * 0.24, IW * 0.76], head_bg=GREEN))

# ====================== PART B ======================
story += [NextPageTemplate('partB'), PageBreak(), NextPageTemplate('normal'), Spacer(1, 1), PageBreak()]

story += section('B1', 'The 7 golden rules of an engaging talk', YELLOW)
story.append(table([
    ['#', 'Rule', 'In practice'],
    ['1', '<b>Tell a story, not a spec sheet</b>', 'Problem → frustration → our fix → proof (demo). People remember stories, not tech stacks.'],
    ['2', '<b>One idea per slide</b>', 'If a slide needs 2 minutes of reading, it\'s a document, not a slide. Talk; don\'t read.'],
    ['3', '<b>Make them do something early</b>', 'A show of hands in the first minute wakes up the room (see Hook B).'],
    ['4', '<b>Humour = relatable truth</b>', 'Spam calls, “Open 24×7” shops that are shut, aunties who know everything. Not random memes.'],
    ['5', '<b>Show, don\'t claim</b>', 'Never say “it\'s fast” — click it. Never say “it\'s secure” — show the masked number.'],
    ['6', '<b>Use callbacks</b>', 'Bring back an early joke at the end (the spam call). It makes the talk feel planned and complete.'],
    ['7', '<b>Know your first and last line by heart</b>', 'Everything in between can be natural. Start strong, end strong.'],
], [IW * 0.06, IW * 0.36, IW * 0.58]))

story += section('B2', 'Three opening hooks — pick one', PINK)
story.append(callout('HOOK A · THE FAKE SPAM CALL (most fun, needs a friend)',
    'Ask a friend in the audience to call your phone right as you begin. Answer on speaker: '
    '<b>“Hello sir, you searched for a plumber in 2022, would you like a credit card?”</b> Hang up, look at the audience: '
    '<b>“That… is exactly why we built Mohalla.”</b> Then start slide 1.', RED, LIGHT_R))
story.append(Spacer(1, 6))
story.append(callout('HOOK B · THE SHOW OF HANDS (zero risk)',
    '<b>“Raise your hand if you\'ve ever searched for a plumber, electrician or tuition online… Keep it up if you then got '
    'calls for the next six months… Keep it up if one of them was selling insurance.”</b> (Hands stay up, people laugh.) '
    '<b>“Good — you are our target audience.”</b>', BLUE, LIGHT_B))
story.append(Spacer(1, 6))
story.append(callout('HOOK C · THE LAUNCH VIDEO (most polished)',
    'Play <b>Mohalla_Launch.mp4</b> (48 s) full screen with sound before saying anything. When it ends, pause one second, then: '
    '<b>“Hi, we\'re the people who made that. Let us show you it\'s real.”</b>', GREEN, LIGHT_G))
story.append(Spacer(1, 6))
story.append(P('Combine B + C: hands first (people engage), then the video (people are impressed).', 'small'))

story += section('B3', 'Slide-by-slide script with jokes', PURPLE)
story.append(P('For each of the 17 slides: what the slide is for, a line to say, and an optional joke or interaction. '
               'Jokes are marked <font name="UI-B" color="#FD5A46">FUN</font>; use about one every 2–3 slides, not on every slide. '
               'Your speaker notes in the PPT have the factual script; this adds the energy.'))
slides = [
    ('1', 'Title — Mohalla', '20 s', 'Introduce the name: “Mohalla” means neighbourhood.',
     '“Every mohalla already has a JustDial — it\'s called <i>that one aunty</i> who knows every shop, every plumber and '
     'everyone\'s business. We just built the app version. Without the gossip.”'),
    ('2', 'The problem', '45 s', 'The four pains: spam calls, wrong timings, exact category names, missing places.',
     'Do Hook B here if you didn\'t open with it. For timings: “Every shop board says <i>Open 24×7</i>. You go at 9 pm — '
     'shutter down, dog sleeping outside.” For categories: “Nobody types <i>HVAC services</i>. We type <i>AC kharab hai</i>.”'),
    ('3', 'Our solution', '25 s', 'One app: search + real places + safe contact.',
     '“Think of it as JustDial… that doesn\'t give your number to the whole city.”'),
    ('4', 'Core features', '30 s', 'The standard directory features — move fast, the demo will show them.',
     '“These are the features every directory app must have. Our job was to make sure they don\'t break during this demo. '
     'Fingers crossed.” (Cross your fingers.)'),
    ('5', 'What makes us different', '30 s', 'The 4 unique features. Slow down here — this is your scoring slide.',
     '“If you remember only one slide today, make it this one. If you remember none, at least remember we were nice.”'),
    ('6', 'Smart Ask', '45 s', 'Normal sentences → filters, in English and Hinglish.',
     '“Smart Ask understands Hinglish better than my relatives understand what I study.” '
     'Interaction: ask the audience for a problem and type it live (test a few the day before).'),
    ('7', 'Real places (OpenStreetMap)', '40 s', 'Live, real data; real photos or satellite view.',
     '“We did not type 400 shops by hand. We\'re students, not interns.” Then show your college: '
     '“And yes — we literally put our college on the map.”'),
    ('8', 'Privacy Mode & Live Status', '45 s', 'Masked numbers + in-app chat; live status that expires after 12 h.',
     '“The business sees <i>xxxxxxxx03</i>. That\'s it. Your number is now safer than your Instagram password.” '
     'Live Status: “It expires in 12 hours — so unlike that shop board, it can\'t lie for long.”'),
    ('9', 'Emergency mode', '30 s', 'Nearest hospitals, pharmacies, ATMs + helplines.',
     '<b>No jokes on this slide.</b> Lower your voice, slow down: “When someone is hurt, nobody wants to scroll. One tap.” '
     'The change in tone makes it hit harder — and shows maturity.'),
    ('10', 'Android app', '30 s', 'Same code, two platforms, via Capacitor.',
     '“We wrote the code once. Writing it twice is how you lose a semester.” Hold up your phone with the app open.'),
    ('11', 'User roles', '25 s', 'Customer, owner, admin; admin approval keeps fake listings out.',
     '“The admin is basically the class monitor. Approves listings so no fake <i>Best Biryani in Hyderabad</i> goes live… '
     'although honestly, every biryani place in Hyderabad claims that.”'),
    ('12', 'Architecture', '45 s', 'Client–server: apps → Express API → SQLite; OSM for real data.',
     'Use the restaurant analogy from A1: waiter, kitchen, fridge, vegetable market. Point at each box as you say it. '
     'Examiners love a clear analogy.'),
    ('13', 'Database design', '40 s', 'Tables, foreign keys, one review per user per business.',
     '“Our tables are like a family WhatsApp group — everyone is connected, and if you delete one person, a lot of '
     'messages disappear with them. In databases we call that <i>ON DELETE CASCADE</i>.”'),
    ('14', 'Tech stack', '25 s', 'React, Node, Express, SQLite, Capacitor, OSM — all free and open source.',
     '“Total infrastructure cost of this project: zero rupees. Total chai cost: please don\'t ask.”'),
    ('15', 'Testing', '35 s', '95 automated tests, load test, ~20 bugs found and fixed.',
     '“Our stress test found 20 bugs. We fixed all 20. We\'re not saying there are zero bugs left — we\'re saying we '
     'haven\'t found them yet.”'),
    ('16', 'Future scope', '30 s', 'UPI booking, notifications, voice search, languages, OTP reviews, Play Store.',
     '“And the Play Store launch — as soon as our parents approve the developer-account fee.”'),
    ('17', 'Thank you', '15 s', 'Thank the panel, invite questions, then go to the demo.',
     '<b>Callback to the opening:</b> “And if you get a spam call after this presentation — it wasn\'t us. '
     'We have Privacy Mode.”'),
]
for num, title, t, purpose, fun in slides:
    head = Paragraph(f'<font name="UI-B" size="11.5" color="white">Slide {num} · {title}</font>'
                     f'<font name="UI" size="9.5" color="white">   ·  about {t}</font>', ParagraphStyle('sh', leading=15))
    body = [P(f'<b>Purpose:</b> {purpose}', 'do'), Spacer(1, 3),
            P(f'<font name="UI-B" size="8.5" color="#FD5A46">FUN&nbsp;&nbsp;</font>{fun}', 'say')]
    card = Table([[head], [body]], colWidths=[IW])
    col = DARK[int(num) % 4]
    card.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 1.5, INK), ('BACKGROUND', (0, 0), (-1, 0), col),
                              ('LINEBELOW', (0, 0), (-1, 0), 1.5, INK), ('BACKGROUND', (0, 1), (-1, 1), colors.white),
                              ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9),
                              ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 6)]))
    story.append(KeepTogether([card, Spacer(1, 6)]))

story += section('B4', 'The live demo as a story', GREEN)
story += [P('Don\'t demo features — demo a <b>day in someone\'s life</b>. Give the user a name and a problem, and every click '
            'becomes the next part of the story. Example cast:'),
          table([
              ['Scene', 'Story line', 'What you click'],
              ['1', '“Meet Rahul. Hostel in KPHB. It\'s May. His AC just died.”', 'Home page → allow location → real places load'],
              ['2', '“Rahul doesn\'t know the word <i>HVAC</i>. He types like a human.”', 'Smart Ask: <i>my AC is not cooling, need someone urgently</i>'],
              ['3', '“He wants someone good, who\'s actually open.”', 'Top Rated chip → open CoolCare → reviews, timings, map'],
              ['4', '“But Rahul has trust issues with sharing his number. Fair.”', 'Log in as user → Send Enquiry with Privacy Mode'],
              ['5', '“Meanwhile, at CoolCare…”', 'Log in as owner → masked number → reply in chat → set Available now'],
              ['6', '“And someone has to keep the fake listings out.”', 'Admin → approve FitZone → stats'],
              ['7', '“Two hours later, Rahul\'s friend twists an ankle on the stairs.”', 'Emergency mode (serious tone)'],
              ['8', '“And Rahul? He does all of this from his phone.”', 'Show the Android app on your phone'],
          ], [IW * 0.08, IW * 0.52, IW * 0.40], head_bg=GREEN),
          Spacer(1, 6),
          callout('IF THE RENDER SERVER IS WAKING UP', '“Our server is on the free plan, so — like every college student at 8 am — '
                  'it takes a minute to wake up.” Use that minute: explain the architecture slide while it loads. '
                  'Better still, open the site 2 minutes before you start so it\'s already awake.', PURPLE, LIGHT_P)]

story += section('B5', 'Humour rules and rescue lines', RED)
story += [table([
    ['Do', 'Don\'t'],
    ['Joke about shared, everyday pain (spam calls, shop boards, Hyderabad heat)', 'Joke about teachers, classmates, religion, politics or anyone in the room'],
    ['Joke about yourselves (“we\'re students, not interns”)', 'Insult JustDial or other apps — compare features, not people'],
    ['Pause after the punchline; smile; let them laugh', 'Explain the joke or laugh at your own joke first'],
    ['Keep it to ~6–8 light moments in 12 minutes', 'Put a joke on Emergency mode or on the security slide'],
    ['Say jokes in your own words — natural beats perfect', 'Read a joke off the slide'],
], [IW * 0.5, IW * 0.5], head_bg=RED, zebra=False),
    Spacer(1, 8),
    P('Rescue lines (memorise two):', 'h2'),
    table([
        ['Situation', 'Say'],
        ['A joke gets silence', '“That joke was in Privacy Mode — only some of you received it.”'],
        ['The demo freezes', '“This is the part where we prove the 95 tests were necessary.” Then refresh, or play Mohalla_Demo.mp4.'],
        ['Internet is down', '“The real-places feature needs internet — the rest runs on our own server.” Switch to the laptop server or the demo video.'],
        ['You forget your line', 'Look at the slide, take a breath, and say “The key point here is…” — nobody notices.'],
        ['A question you can\'t answer', '“Good question — I don\'t want to guess. What I can tell you is…” and answer the nearest thing you do know.'],
    ], [IW * 0.30, IW * 0.70], head_bg=YELLOW)]

story += section('B6', 'Voice, body language, team roles, rehearsal', BLUE)
story += [table([
    ['Area', 'Tips'],
    ['Voice', 'Slower than feels natural. Pause before key numbers (“…<i>ninety-five</i> tests”). Drop your voice on Emergency mode.'],
    ['Eyes', 'Look at the examiners, not the screen. Glance at the slide only to point at something.'],
    ['Hands', 'Point at diagram boxes as you name them. Hold up the phone for the Android slide. Hands out of pockets.'],
    ['Clicker', 'Use a presenter remote or a phone app so you can move around instead of hiding behind the laptop.'],
    ['Team of 2–4', 'Split by role: <b>Storyteller</b> (slides 1–9), <b>Demo driver</b> (live demo), <b>Tech lead</b> '
                    '(slides 10–16 + hard questions). Hand over with a line: “…and to show you it\'s real, here\'s Priya.”'],
    ['Rehearsal plan', '<b>Day −2:</b> read Part A, run the demo once. <b>Day −1:</b> full run with a timer twice (aim 12 min), '
                       'test your Smart Ask sentences, record yourself once on the phone. <b>Day 0:</b> open the live site '
                       '2 min early, run the checklist in the Start & Demo Guide.'],
], [IW * 0.18, IW * 0.82], head_bg=BLUE)]

story += section('B7', 'Tough viva questions with model answers', PURPLE)
qa = [
    ('Why JWT and not sessions?', 'JWT is stateless: the server doesn\'t store sessions, it just verifies the signature. That fits a '
     'REST API used by both a website and a mobile app. Trade-off: a token can\'t be cancelled before it expires (30 days), '
     'so for production we\'d add shorter tokens with refresh tokens.'),
    ('How do you stop SQL injection?', 'All queries are prepared statements with ? placeholders, so user input is sent as data, '
     'never as part of the SQL command.'),
    ('What if two people review the same business twice?', 'The database has UNIQUE(user_id, business_id) on reviews, so a second '
     'review from the same user can\'t be added; posting again <i>updates</i> their existing review (an upsert). '
     'Owners can\'t review their own business, and the CHECK constraint keeps ratings between 1 and 5.'),
    ('Why Capacitor instead of React Native or Kotlin?', 'We already had a full React web app. Capacitor reuses 100% of that code, '
     'so one codebase gives both web and Android. React Native would mean rewriting every screen.'),
    ('Why SQLite? Will it scale?', 'Zero setup and built into Node — great for a project and for thousands of users. It allows one '
     'writer at a time, so for very high traffic we\'d move to PostgreSQL; our SQL is standard so the change is small.'),
    ('Is the data real?', 'Our own listings are demo data (clearly marked). Real places come live from OpenStreetMap — '
     'you can turn on location anywhere and see real shops around you, with their real photos or satellite view.'),
    ('Is Smart Ask AI?', 'It\'s rule-based natural-language processing: keyword lists in English and Hinglish mapped to categories '
     'and filters. It\'s instant, free and works offline. A machine-learning model is in our future scope.'),
    ('How is the phone number actually hidden?', 'The enquiry is stored with hide_phone = 1. When the owner fetches enquiries, the '
     'server masks the number before sending the response, so the full number never reaches the owner\'s device.'),
    ('What does CORS do in your app?', 'Browsers block a page from calling an API on a different address unless the API allows it. '
     'The Android app runs from a local address, so the API sends CORS headers allowing it.'),
    ('Why does the online data reset?', 'Render\'s free plan has a temporary disk, so we re-seed demo data on every start. '
     'With a paid persistent disk or a managed database, data would stay.'),
    ('What happens when the free server is asleep?', 'The first request wakes it in about a minute. The Android app waits up to '
     '75 s and shows “Waking up the server…” instead of failing.'),
    ('What was the hardest part?', 'Pick a true one, e.g. mapping messy OpenStreetMap tags to clean categories and getting real '
     'photos, or making the same code work offline-bundled in the APK and online on the web.'),
]
story.append(table([['Question', 'Model answer']] + [[f'<b>{q}</b>', a] for q, a in qa], [IW * 0.30, IW * 0.70], head_bg=PURPLE))
story.append(Spacer(1, 10))
story.append(callout('LAST LINE OF THE DAY', '“So Mohalla does everything a directory app should, and adds real live data, '
                     'no-spam privacy, live status, Smart Ask and emergency help — built for ₹0 and running live right now. '
                     'Thank you.”', PURPLE, LIGHT_Y))

doc.build(story)
print('wrote', OUT)
