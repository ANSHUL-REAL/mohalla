# Builds Mohalla_Start_and_Demo_Guide.pdf (how to start the app + a spoken demo script + viva prep).
# Run: python tools/guide/build_guide.py   (needs reportlab; uses screenshots from tools/ppt/shots)
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, Table,
                                TableStyle, Image, PageBreak, KeepTogether, NextPageTemplate)

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / 'tools' / 'ppt' / 'shots'
LOGO = ROOT / 'tools' / 'ppt' / 'assets' / 'logo.png'
OUT = ROOT / 'Mohalla_Start_and_Demo_Guide.pdf'

F = 'C:/Windows/Fonts/'
pdfmetrics.registerFont(TTFont('UI', F + 'segoeui.ttf'))
pdfmetrics.registerFont(TTFont('UI-B', F + 'segoeuib.ttf'))
pdfmetrics.registerFont(TTFont('UI-I', F + 'segoeuii.ttf'))
pdfmetrics.registerFont(TTFont('UI-SB', F + 'seguisb.ttf'))
pdfmetrics.registerFont(TTFont('Mono', F + 'consola.ttf'))
pdfmetrics.registerFont(TTFont('Sym', F + 'seguisym.ttf'))
pdfmetrics.registerFont(TTFont('Mono-B', F + 'consolab.ttf'))
pdfmetrics.registerFontFamily('UI', normal='UI', bold='UI-B', italic='UI-I', boldItalic='UI-B')

YELLOW = colors.HexColor('#FFC567'); PINK = colors.HexColor('#FB7DA8'); RED = colors.HexColor('#FD5A46')
PURPLE = colors.HexColor('#552CB7'); GREEN = colors.HexColor('#00995E'); BLUE = colors.HexColor('#058CD7')
INK = colors.HexColor('#111111'); CREAM = colors.HexColor('#FFF8EC'); GREY = colors.HexColor('#5A5A5A')
LIGHT_Y = colors.HexColor('#FFF0D1')

W, H = A4
M = 18 * mm

s = {
    'body': ParagraphStyle('body', fontName='UI', fontSize=10.5, leading=15, textColor=INK, spaceAfter=5),
    'small': ParagraphStyle('small', fontName='UI', fontSize=9, leading=12.5, textColor=GREY),
    'h1': ParagraphStyle('h1', fontName='UI-B', fontSize=22, leading=27, textColor=INK, spaceAfter=4),
    'h2': ParagraphStyle('h2', fontName='UI-B', fontSize=14, leading=18, textColor=INK, spaceBefore=10, spaceAfter=5),
    'lead': ParagraphStyle('lead', fontName='UI', fontSize=11.5, leading=16.5, textColor=GREY, spaceAfter=10),
    'cell': ParagraphStyle('cell', fontName='UI', fontSize=9.5, leading=13, textColor=INK),
    'cellb': ParagraphStyle('cellb', fontName='UI-B', fontSize=9.5, leading=13, textColor=INK),
    'say': ParagraphStyle('say', fontName='UI-I', fontSize=10.5, leading=15, textColor=INK),
    'do': ParagraphStyle('do', fontName='UI', fontSize=10, leading=14, textColor=INK),
    'code': ParagraphStyle('code', fontName='Mono', fontSize=10, leading=14, textColor=colors.white),
}

def P(t, st='body'): return Paragraph(t, s[st])

def boxed(flow, bg=colors.white, pad=8, border=1.6):
    t = Table([[flow]], colWidths=[W - 2 * M - 4])
    t.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), border, INK), ('BACKGROUND', (0, 0), (-1, -1), bg),
                           ('LEFTPADDING', (0, 0), (-1, -1), pad + 2), ('RIGHTPADDING', (0, 0), (-1, -1), pad + 2),
                           ('TOPPADDING', (0, 0), (-1, -1), pad), ('BOTTOMPADDING', (0, 0), (-1, -1), pad)]))
    return t

def code(*lines, note=None):
    """Dark command box. lines are (command, comment) tuples or plain strings."""
    rows = []
    for ln in lines:
        cmd, cmt = ln if isinstance(ln, tuple) else (ln, '')
        txt = f'<font name="Mono-B">{cmd}</font>' + (f'<font color="#FFC567">   # {cmt}</font>' if cmt else '')
        rows.append([Paragraph(txt, s['code'])])
    t = Table(rows, colWidths=[W - 2 * M - 4])
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#1E1E24')), ('BOX', (0, 0), (-1, -1), 1.6, INK),
                           ('LEFTPADDING', (0, 0), (-1, -1), 10), ('TOPPADDING', (0, 0), (-1, -1), 3),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 3), ('TOPPADDING', (0, 0), (-1, 0), 8),
                           ('BOTTOMPADDING', (0, -1), (-1, -1), 8)]))
    return t

def table(rows, widths, head_bg=YELLOW, zebra=True):
    data = [[P(c, 'cellb') if i == 0 else (c if not isinstance(c, str) else P(c, 'cell')) for c in r]
            for i, r in enumerate(rows)]
    data = [[P(c, 'cellb') if isinstance(c, str) else c for c in rows[0]]] + \
           [[P(c, 'cell') if isinstance(c, str) else c for c in r] for r in rows[1:]]
    t = Table(data, colWidths=widths, repeatRows=1)
    st = [('BOX', (0, 0), (-1, -1), 1.6, INK), ('INNERGRID', (0, 0), (-1, -1), 0.6, INK),
          ('BACKGROUND', (0, 0), (-1, 0), head_bg), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
          ('LEFTPADDING', (0, 0), (-1, -1), 6), ('RIGHTPADDING', (0, 0), (-1, -1), 6),
          ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 5)]
    if zebra:
        for i in range(2, len(rows), 2): st.append(('BACKGROUND', (0, i), (-1, i), CREAM))
    t.setStyle(TableStyle(st))
    return t

DARK = (PURPLE, BLUE, RED, GREEN)

def section(num, title, color):
    """Coloured numbered heading bar."""
    fg = 'white' if color in DARK else '#111111'
    badge = Paragraph(f'<font name="UI-B" size="13" color="white">{num}</font>', ParagraphStyle('b', alignment=1, leading=16))
    ttl = Paragraph(f'<font name="UI-B" size="15" color="{fg}">{title}</font>', ParagraphStyle('t', leading=19))
    t = Table([[badge, ttl]], colWidths=[11 * mm, W - 2 * M - 11 * mm - 4], rowHeights=[10 * mm])
    t.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 1.8, INK), ('LINEAFTER', (0, 0), (0, 0), 1.8, INK),
                           ('BACKGROUND', (0, 0), (0, 0), INK), ('BACKGROUND', (1, 0), (1, 0), color),
                           ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('LEFTPADDING', (1, 0), (1, 0), 10)]))
    return [Spacer(1, 4), t, Spacer(1, 8)]

def shot(name, width):
    p = SHOTS / f'{name}.png'
    img = Image(str(p))
    r = img.imageHeight / img.imageWidth
    img.drawWidth, img.drawHeight = width, width * r
    t = Table([[img]], colWidths=[width + 3])
    t.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 1.6, INK), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                           ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('TOPPADDING', (0, 0), (-1, -1), 0),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 0)]))
    return t

def step(n, title, time, do, say, img=None, color=YELLOW):
    """One demo step: what to click (left) and what to say (quote box)."""
    fg = 'white' if color in DARK else '#111111'
    head = Paragraph(f'<font name="UI-B" size="12" color="{fg}">Step {n} · {title}</font>'
                     f'<font name="UI" size="10" color="{fg}">   ·  about {time}</font>', ParagraphStyle('sh', leading=16))
    do_list = [P('<b>Do:</b>', 'do')] + [P('• ' + d, 'do') for d in do]
    say_box = Table([[P('<font name="UI-B" size="9" color="#552CB7">SAY</font>', 'do')], [P(f'“{say}”', 'say')]],
                    colWidths=[(W - 2 * M - 22) * (0.56 if img else 1) - 4])
    say_box.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), LIGHT_Y), ('LINEBEFORE', (0, 0), (0, -1), 4, PURPLE),
                                 ('LEFTPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 3),
                                 ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    left = do_list + [Spacer(1, 4), say_box]
    inner_w = W - 2 * M - 4 - 18
    if img:
        body = Table([[left, shot(img, inner_w * 0.40)]], colWidths=[inner_w * 0.58, inner_w * 0.42])
    else:
        body = Table([[left]], colWidths=[inner_w])
    body.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 0),
                              ('RIGHTPADDING', (0, 0), (-1, -1), 0)]))
    card = Table([[head], [body]], colWidths=[inner_w + 18])
    card.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 1.6, INK), ('BACKGROUND', (0, 0), (-1, 0), color),
                              ('LINEBELOW', (0, 0), (-1, 0), 1.6, INK), ('LEFTPADDING', (0, 0), (-1, -1), 9),
                              ('RIGHTPADDING', (0, 0), (-1, -1), 9), ('TOPPADDING', (0, 0), (-1, -1), 6),
                              ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
    return KeepTogether([card, Spacer(1, 9)])

# ---------- page decorations ----------
def cover_page(c, doc):
    c.saveState()
    c.setFillColor(YELLOW); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setStrokeColor(colors.HexColor('#E8AE4E')); c.setLineWidth(0.5)
    for x in range(0, int(W), 22): c.line(x, 0, x, H)
    for y in range(0, int(H), 22): c.line(0, y, W, y)
    # card with hard shadow
    cx, cy, cw, ch = M, H * 0.30, W - 2 * M, H * 0.50
    c.setFillColor(INK); c.rect(cx + 7, cy - 7, cw, ch, fill=1, stroke=0)
    c.setFillColor(colors.white); c.setStrokeColor(INK); c.setLineWidth(3); c.rect(cx, cy, cw, ch, fill=1, stroke=1)
    if LOGO.exists(): c.drawImage(str(LOGO), cx + 26, cy + ch - 120, 92, 92, mask='auto')
    c.setFillColor(INK); c.setFont('UI-B', 40); c.drawString(cx + 26, cy + ch - 170, 'Mohalla.')
    c.setFont('UI', 14); c.setFillColor(GREY); c.drawString(cx + 26, cy + ch - 194, 'Your neighbourhood, one tap away')
    c.setFillColor(INK); c.setFont('UI-B', 25)
    c.drawString(cx + 26, cy + ch - 250, 'Start & Demo Guide')
    c.setFont('UI', 12); c.setFillColor(GREY)
    for i, ln in enumerate(['How to start the app on the laptop and phone, a word-for-word demo script,',
                            'the order to present things in, viva questions and quick fixes.']):
        c.drawString(cx + 26, cy + ch - 275 - i * 17, ln)
    # chips
    x = cx + 26
    for label, col in [('Web app', BLUE), ('Android APK', GREEN), ('PPT', PURPLE), ('Videos', RED)]:
        tw = pdfmetrics.stringWidth(label, 'UI-B', 11) + 22
        c.setFillColor(INK); c.roundRect(x + 3, cy + 30 - 3, tw, 24, 6, fill=1, stroke=0)
        c.setFillColor(col); c.setStrokeColor(INK); c.setLineWidth(2); c.roundRect(x, cy + 30, tw, 24, 6, fill=1, stroke=1)
        c.setFillColor(colors.white); c.setFont('UI-B', 11); c.drawString(x + 11, cy + 38, label)
        x += tw + 12
    c.setFillColor(INK); c.setFont('UI', 10)
    c.drawString(M, M + 6, 'College project  ·  Keep this open on your phone during the demo')
    c.restoreState()

def normal_page(c, doc):
    c.saveState()
    c.setFillColor(YELLOW); c.rect(0, H - 9 * mm, W, 9 * mm, fill=1, stroke=0)
    c.setStrokeColor(INK); c.setLineWidth(1.5); c.line(0, H - 9 * mm, W, H - 9 * mm)
    c.setFillColor(INK); c.setFont('UI-B', 9.5); c.drawString(M, H - 6 * mm, 'Mohalla.  Start & Demo Guide')
    c.setFont('UI', 9.5); c.drawRightString(W - M, H - 6 * mm, f'Page {doc.page}')
    c.restoreState()

doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=M, rightMargin=M, topMargin=16 * mm, bottomMargin=14 * mm,
                      title='Mohalla — Start & Demo Guide', author='Anshul Nautiyal',
                      subject='How to start Mohalla and present the demo')
frame = Frame(M, 14 * mm, W - 2 * M, H - 30 * mm, id='f', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
doc.addPageTemplates([PageTemplate('cover', [frame], onPage=cover_page),
                      PageTemplate('normal', [frame], onPage=normal_page)])

story = [NextPageTemplate('normal'), PageBreak()]
IW = W - 2 * M - 4

# ---------- 0. at a glance ----------
story += [P('At a glance', 'h1'),
          P('Read section 1 the night before. On demo day, follow section 2 (15 minutes before), then present in the '
            'order of section 4 using the script in section 5.', 'lead')]
story.append(table([
    ['File (in the project folder)', 'What it is', 'How to open'],
    ['<b>Mohalla_Launch.mp4</b>', '48-second launch video with voice and music', 'Double-click; play full screen to open the talk'],
    ['<b>Mohalla_Presentation.pptx</b>', '17 slides with speaker notes', 'PowerPoint → Slide Show (F5)'],
    ['<b>Mohalla_Demo.mp4</b>', '3:27 silent walkthrough of every feature', 'Backup if the live demo fails; talk over it'],
    ['<b>Mohalla.apk</b>', 'Android app', 'Copy to phone and install (section 3)'],
    ['<b>client/, server/</b>', 'Source code (web app + API)', 'Started with npm start (section 1)'],
    ['<b>README.md</b>', 'Short technical readme', 'Any text editor or GitHub'],
], [IW * 0.30, IW * 0.38, IW * 0.32]))
story.append(Spacer(1, 10))
story.append(boxed(P('<b>The 3 commands you need on demo day</b> (in the project folder, in a terminal):'), bg=LIGHT_Y))
story.append(code(('npm run seed', 'reset demo data — always run before a demo'),
                  ('npm start', 'start the server, then open http://localhost:5000')))
story.append(Spacer(1, 6))
story.append(P('To stop the server: click the terminal window and press <b>Ctrl + C</b>.', 'small'))

story += section(1, 'First-time setup (only once per laptop)', BLUE)
story += [P('Mohalla needs only <b>Node.js 22 or newer</b>. The database (SQLite) is built into Node, so nothing else '
            'has to be installed. This laptop already has Node 24 and everything set up, so you can skip to section 2 '
            'here. Use these steps only on a new laptop.'),
          P('<b>1.</b> Install Node.js LTS from <b>nodejs.org</b>. Check it worked:'),
          code(('node -v', 'should print v22 or higher')),
          Spacer(1, 6),
          P('<b>2.</b> Open a terminal in the project folder (in File Explorer, open the folder, click the address bar, '
            'type <b>cmd</b> and press Enter). Then run:'),
          code(('npm run setup', 'installs packages, takes 1–3 minutes'),
               ('npm run build', 'builds the website'),
               ('npm run seed', 'creates the demo data'),
               ('npm start', 'starts the server')),
          Spacer(1, 6),
          P('<b>3.</b> Open <b>http://localhost:5000</b> in Chrome. You should see the Mohalla home page.'),
          P('No internet? The app still works with its own listings. Only the "real nearby places" feature, the map '
            'tiles and the satellite images need internet.', 'small')]

story += section(2, 'Demo-day checklist (15 minutes before)', GREEN)
story.append(table([
    ['<font name="Sym">✓</font>', 'Task', 'Why'],
    ['<font name="Sym" size="13">☐</font>', 'Charge laptop and phone; turn on the <b>phone hotspot</b> and connect the laptop to it',
     'College Wi-Fi usually blocks phone ↔ laptop. The hotspot also gives internet for maps.'],
    ['<font name="Sym" size="13">☐</font>', 'Run <b>npm run seed</b>, then <b>npm start</b>', 'Fresh data; Live Status badges expire after 12 hours'],
    ['<font name="Sym" size="13">☐</font>', 'Note the line <b>On your phone: http://…:5000</b> that npm start prints', 'You type this into the phone app'],
    ['<font name="Sym" size="13">☐</font>', 'Open <b>http://localhost:5000</b> in Chrome; allow location when asked', 'Real nearby places + Emergency mode need it'],
    ['<font name="Sym" size="13">☐</font>', 'Open the phone app; it should show the home page with listings', 'If it shows "Connect to server", see section 3'],
    ['<font name="Sym" size="13">☐</font>', 'Open the PPT and fill slide 1: <b>your name, roll no., guide</b>', 'It still says [Your name] etc.'],
    ['<font name="Sym" size="13">☐</font>', 'Keep <b>Mohalla_Launch.mp4</b> and <b>Mohalla_Demo.mp4</b> ready; test the speakers', 'The launch video has voice'],
    ['<font name="Sym" size="13">☐</font>', 'Close other apps and notifications; set Chrome zoom to 100–125%', 'Clean screen for the projector'],
], [IW * 0.06, IW * 0.56, IW * 0.38]))

story += section(3, 'Starting the Android app', PINK)
story += [P('The screens are inside the APK. The listings come from your laptop, so the phone and laptop must be on '
            '<b>the same network</b> (best: laptop connected to the phone\'s hotspot).'),
          table([
              ['#', 'Step'],
              ['1', 'Copy <b>Mohalla.apk</b> to the phone (USB cable, Google Drive, or WhatsApp to yourself as a document).'],
              ['2', 'Tap the file to install. If Android asks, allow <b>Install unknown apps</b> for that app. '
                    'If Play Protect warns, tap <b>More details → Install anyway</b> (the app is not from the Play Store, that\'s all).'],
              ['3', 'On the laptop run <b>npm start</b> and read the line <b>On your phone: http://192.168.x.x:5000</b>.'],
              ['4', 'Open Mohalla on the phone. If it shows <b>Connect to server</b>, type that address exactly and tap Connect.'],
              ['5', 'To change it later: <b>Account / Login tab → Server settings</b>.'],
          ], [IW * 0.06, IW * 0.94]),
          Spacer(1, 6),
          boxed(P('<b>Tip:</b> the laptop\'s address changes every time you join a different network (home Wi-Fi vs hotspot). '
                  'Always read the new address from the npm start output.'), bg=CREAM)]

story += section(4, 'Presentation order (about 12–15 minutes)', PURPLE)
story.append(table([
    ['Time', 'What', 'Notes'],
    ['0:00', '<b>Launch video</b> (48 s)', 'Grabs attention. Play full screen with sound.'],
    ['1:00', '<b>PPT slides 1–9</b>: problem, solution, features', 'Speaker notes under each slide tell you what to say.'],
    ['5:00', '<b>Live demo</b> (section 5)', 'Switch to Chrome. About 5 minutes.'],
    ['10:00', '<b>Phone demo</b>', 'Show the same app on the phone (step 8).'],
    ['11:00', '<b>PPT slides 10–17</b>: Android, architecture, database, tech, testing, future scope', 'Faster; the demo already proved the features.'],
    ['13:00', '<b>Questions</b>', 'See section 6.'],
    ['backup', '<b>Demo video</b> (3:27)', 'Only if the live demo breaks (no internet, laptop issue). Talk over it.'],
], [IW * 0.12, IW * 0.46, IW * 0.42]))

story += section(5, 'Live demo script — what to click and what to say', YELLOW)
story.append(P('Log in and out as you go, or keep three Chrome windows ready (one per role; use an Incognito window for '
               'the second login). The demo accounts:'))
story.append(table([
    ['Role', 'Email', 'Password', 'Used in'],
    ['Customer', 'user@mohalla.test', 'user123', 'Step 5 — Privacy Mode enquiry'],
    ['Business owner', 'owner@mohalla.test', 'owner123', 'Step 6 — Live Status, reply'],
    ['Admin', 'admin@mohalla.test', 'admin123', 'Step 7 — approve listings'],
], [IW * 0.18, IW * 0.32, IW * 0.16, IW * 0.34], head_bg=PINK))
story.append(Spacer(1, 10))

story.append(step(1, 'Home page & real nearby places', '40 s', [
    'Open <b>http://localhost:5000</b>.',
    'In the "What\'s in your mohalla?" popup, click <b>Turn on location</b> and allow it.',
    'Scroll slowly: banners, categories, <b>Near you</b>, trending searches.'],
    'This is Mohalla, a local business search app like JustDial. When I turn on location, it loads real shops, '
    'clinics and ATMs around me from OpenStreetMap — this is live data, not something we typed in.', 'home'))
story.append(step(2, 'Smart Ask', '40 s', [
    'In the search bar type: <b>my AC is not cooling, need someone urgently</b> and press Enter.',
    'Point at the <b>Smart Ask understood</b> chips (category, open now, nearest).'],
    'Users don\'t have to pick categories. They can type a normal sentence — even Hinglish — and Smart Ask '
    'picks the category, "open now" and "nearest first" by itself.', 'smart-ask', color=PINK))
story.append(boxed(P('<b>At night</b> the "Open now" filter may show "Nobody is open right now" — that\'s correct behaviour: '
                     'the app then lists the nearest places with their next opening time. Say so; it\'s a feature.'), bg=CREAM))
story.append(Spacer(1, 9))
story.append(step(3, 'Results & business page', '50 s', [
    'Click the <b>Top Rated</b> or <b>Verified</b> chip.',
    'Click <b>Show Number</b> on a card.',
    'Open a business, e.g. <b>CoolCare AC Services</b>: photos, Call / WhatsApp / Directions, timings, map, <b>Reviews</b> tab.'],
    'Each business shows ratings, badges like Verified and Quick Response, and smart timings like "Open until 9 PM". '
    'The page has photos, services, a map with directions and real reviews.', 'detail', color=BLUE))
story.append(step(4, 'Our college', '25 s', [
    'Search <b>fsb degree college</b>.',
    'Open <b>FSB Degree College (Fortune School of Business)</b> and show the satellite view and map.'],
    'Here is our own college. Any name you search is also looked up live on OpenStreetMap if it isn\'t saved yet, and '
    'real places show a real photo or a satellite view — never a fake stock photo.', 'fsb', color=GREEN))
story.append(step(5, 'Privacy Mode enquiry (customer)', '45 s', [
    'Log in as <b>user@mohalla.test / user123</b>.',
    'Open CoolCare AC Services → <b>Send Enquiry</b>, keep <b>Privacy Mode</b> on, type a message, send.',
    'Show the <b>"Sent privately!"</b> message.'],
    'On JustDial, once you enquire you get spam calls. With Privacy Mode the business never sees my number — '
    'they reply inside the app\'s chat instead.', color=PINK))
story.append(step(6, 'Owner dashboard (business owner)', '60 s', [
    'Log out, log in as <b>owner@mohalla.test / owner123</b>, open <b>Dashboard</b>.',
    'Set CoolCare\'s Live Status to <b>Available now</b>.',
    'Open the enquiry: the number shows as <b>Privacy Mode · xxxxxxxx03</b>. Type a reply and send.'],
    'The owner sees the enquiry but the number is hidden except the last two digits. They reply in chat. '
    'They can also set a Live Status — Available now, Busy or Closed today — which shows on their listing straight away.',
    'dashboard', color=YELLOW))
story.append(step(7, 'Admin panel', '35 s', [
    'Log in as <b>admin@mohalla.test / admin123</b>, open <b>Admin</b>.',
    'Show the stats and charts, open <b>Pending</b>, approve <b>FitZone Fitness</b>, show the <b>Users</b> tab.'],
    'New listings are checked by an admin before they go live. The admin can approve, verify or feature businesses and '
    'manage users and categories.', 'admin', color=PURPLE))
story.append(step(8, 'Emergency mode & phone app', '60 s', [
    'Click <b>Emergency</b>: nearest hospitals, pharmacies and ATMs with Call / Go buttons, plus 112, 108, 100, 101.',
    'Pick up the phone, open the Mohalla app, search <b>dentist</b>, open a result, show the bottom tab bar.'],
    'In an emergency, one tap shows the nearest hospitals and pharmacies with directions and the helpline numbers. '
    'And the same app runs on Android — here it is on my phone.', 'emergency', color=RED))
story.append(boxed(P('<b>Closing line:</b> “So Mohalla does everything a directory app does, and adds real live data, no-spam '
                     'privacy, live status, Smart Ask and emergency mode. Thank you — we\'re happy to take questions.”'),
                   bg=LIGHT_Y))

story.append(PageBreak())
story += section(6, 'Viva questions — short answers', BLUE)
qa = [
    ('What does the project do?', 'It is a local business directory like JustDial: search, filters, business pages, reviews, '
     'enquiries, owner dashboard and admin panel, on web and Android.'),
    ('What is the tech stack?', 'Frontend: React 19 with Vite, React Router, Leaflet maps. Backend: Node.js with Express 5 '
     '(REST API). Database: SQLite, built into Node.js. Android: Capacitor 6 wraps the same React app as an APK.'),
    ('Where does the real data come from?', 'OpenStreetMap. The Overpass API gives nearby shops/clinics/ATMs around your '
     'location; Nominatim looks up a searched name. Both are free and need no API key. Results are saved into our database.'),
    ('How does login work? Are passwords safe?', 'Passwords are hashed with bcrypt (never stored as plain text). After login '
     'the server gives a JWT token, which the app sends with each request. Roles: user, business owner, admin.'),
    ('How does Smart Ask work?', 'It is rule-based natural-language parsing: it matches keywords (English and Hinglish) to '
     'categories and picks up urgency words like "urgent" or "now" to turn on Open-now and Nearest-first filters.'),
    ('How does Privacy Mode work?', 'The enquiry is stored with a privacy flag. The API masks the customer\'s phone number '
     '(all but the last 2 digits) before sending it to the business, and both sides talk through the in-app chat.'),
    ('How does the Android app get its data?', 'The screens are bundled inside the APK. Data comes from our Node server over '
     'the network — the laptop on the same Wi-Fi/hotspot, or the hosted server on Render.'),
    ('What are the main database tables?', 'users, categories, businesses, reviews, enquiries, enquiry_messages (the private chat), favorites and '
     'synced_areas (which map areas were already loaded from OpenStreetMap). They are linked by foreign keys, e.g. a review '
     'belongs to one user and one business. (Slide 13 shows the design.)'),
    ('How did you test it?', 'An automated API test suite (Node\'s built-in test runner) with 95 tests — all pass — '
     'plus a load test with many parallel searches: 0 errors. We also fixed bad-input and fake-upload security issues it found.'),
    ('How is it different from JustDial?', 'Real live nearby data, Privacy Mode (no spam calls), owner Live Status, Smart Ask, '
     'Emergency mode, walking time, and a fallback to the next opening time when nothing is open.'),
    ('What would you add next?', 'Online booking with UPI payments, notifications, voice search, more Indian languages, '
     'OTP-verified reviews, and publishing on the Play Store. (Slide 16.)'),
    ('Why SQLite and not MySQL?', 'Zero setup — it is built into Node, so the project runs on any laptop with one command. '
     'For a big launch we would move to PostgreSQL/MySQL; the SQL would mostly stay the same.'),
]
story.append(table([['Question', 'Answer']] + [[f'<b>{q}</b>', a] for q, a in qa], [IW * 0.30, IW * 0.70], head_bg=BLUE))

story += section(7, 'If something goes wrong', RED)
story.append(table([
    ['Problem', 'Fix'],
    ['<b>npm start</b> says port 5000 is in use', 'The server is already running in another window — just open http://localhost:5000. '
     'Or close that window / restart the laptop and run npm start again.'],
    ['"npm is not recognized"', 'Node.js isn\'t installed (or the terminal was open before installing). Install Node LTS and open a new terminal.'],
    ['Phone shows <b>Connect to server</b> or "can\'t reach"', 'Laptop and phone must be on the same network (use the hotspot). '
     'Type the exact address npm start prints, including <b>:5000</b>. If Windows asks to allow Node.js through the firewall, click Allow.'],
    ['No Live Status badges / old enquiries showing', 'Stop the server (Ctrl + C), run <b>npm run seed</b>, then <b>npm start</b>.'],
    ['Near-you / map / emergency is empty', 'Needs internet and location permission. Click the lock icon in Chrome\'s address bar → Location → Allow, then reload.'],
    ['"Nobody is open right now"', 'Normal at night; the list below shows the nearest places and when they open.'],
    ['Website shows an old version', 'Run <b>npm run build</b> again, restart npm start, then press Ctrl + F5 in Chrome.'],
    ['Live demo fails completely', 'Play <b>Mohalla_Demo.mp4</b> and explain each scene — it shows every feature.'],
], [IW * 0.34, IW * 0.66], head_bg=RED))

story += section(8, 'Online copy & code (optional)', GREEN)
story += [P('The code is in the private GitHub repository <b>github.com/ANSHUL-REAL/mohalla</b>. The APK, PPT and videos '
            'are on its <b>Releases</b> page (v1.0).'),
          P('The project can also run online for free on <b>Render</b>: sign in at render.com with your GitHub account and use the '
            '"Deploy to Render" button in the README. On the free plan the site sleeps when idle, so open it a minute before '
            'the demo. Running on the laptop (section 2) is still the most reliable option for the viva.'),
          Spacer(1, 6),
          P('For developers — rebuild things after changing the code:', 'h2'),
          table([
              ['What', 'Command (from the project folder)'],
              ['Run with hot reload', '<font name="Mono">npm run dev:server</font> and <font name="Mono">npm run dev:client</font> in two terminals → http://localhost:5173'],
              ['Rebuild the APK', '<font name="Mono">cd client</font> then <font name="Mono">npm run android</font> (needs JDK 17 + Android SDK)'],
              ['Rebuild the PPT', '<font name="Mono">cd tools/ppt</font> then <font name="Mono">node shots.mjs</font> and <font name="Mono">node build.js</font>'],
              ['Edit the videos', '<font name="Mono">cd tools/video</font> then <font name="Mono">npm run studio</font> (Remotion Studio)'],
              ['Rebuild this guide', '<font name="Mono">python tools/guide/build_guide.py</font>'],
          ], [IW * 0.26, IW * 0.74], head_bg=GREEN)]

doc.build(story)
print('wrote', OUT)
