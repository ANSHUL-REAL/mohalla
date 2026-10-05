// Builds the project presentation: ../../Mohalla_Presentation.pptx
// Run: node build.js   (screenshots from shots.mjs, icons/backgrounds from assets.mjs + backgrounds.py)
const path = require('path');
const pptxgen = require('pptxgenjs');

const SKILL = process.env.PPTX_SKILL_DIR;
const { applyTheme } = require(path.join(SKILL, 'scripts', 'apply_theme.js'));

const A = (f) => path.join(__dirname, 'assets', f);
const S = (f) => path.join(__dirname, 'shots', f);
const OUT = path.join(__dirname, '..', '..', 'Mohalla_Presentation.pptx');

const THEME = {
  name: 'Mohalla Retro',
  headFontFace: 'Arial Black',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '111111', lt1: 'FFFFFF', dk2: '552CB7', lt2: 'FFC567',
    accent1: 'FD5A46', accent2: '552CB7', accent3: '00995E', accent4: '058CD7', accent5: 'FB7DA8', accent6: 'FFC567',
    hlink: '058CD7', folHlink: '552CB7',
  },
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
pres.title = 'Mohalla — local business discovery app';
pres.subject = 'College project presentation';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const INK = C.text1, WHITE = C.background1, YELLOW = C.background2;
const RED = C.accent1, PURPLE = C.accent2, GREEN = C.accent3, BLUE = C.accent4, PINK = C.accent5;
const HEAD = '+mj-lt'; // theme heading font (Arial Black) for card headings

// ---------------------------------------------------------------- layouts

pres.defineSlideMaster({
  title: 'TITLE',
  background: { path: A('bg-yellow.jpg') },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 2.75, w: 7.2, h: 1.45, fontSize: 66, color: INK, valign: 'bottom', align: 'left', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'subtitle', type: 'body', x: 0.8, y: 4.3, w: 7.2, h: 0.7, fontSize: 24, bold: true, color: INK, valign: 'top', align: 'left', margin: 0 }, text: '' } },
  ],
});

pres.defineSlideMaster({
  title: 'CONTENT',
  background: { path: A('bg-light.jpg') },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.4, w: 12.1, h: 0.9, fontSize: 32, color: INK, valign: 'middle', align: 'left', margin: 0 }, text: '' } },
    { image: { x: 0.6, y: 6.95, w: 0.32, h: 0.32, path: A('logo.png') } },
    { text: { text: 'Mohalla.', options: { x: 1.0, y: 6.95, w: 2.5, h: 0.32, fontSize: 12, bold: true, color: INK, margin: 0, valign: 'middle' } } },
  ],
  slideNumber: { x: 12.2, y: 6.95, w: 0.5, h: 0.32, fontSize: 12, color: INK, align: 'right' },
});

// ---------------------------------------------------------------- helpers

const hardShadow = () => ({ type: 'outer', color: '111111', blur: 0, offset: 5, angle: 45, opacity: 1 });

function card(s, x, y, w, h, fill = WHITE, name) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, fill: { color: fill }, line: { color: INK, width: 2.25 }, rectRadius: 0.12, shadow: hardShadow(), objectName: name,
  });
}

function iconCircle(s, icon, x, y, d, fill, white = false) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: INK, width: 2 } });
  s.addImage({ path: A(`${icon}${white ? '-w' : ''}.png`), x: x + d * 0.24, y: y + d * 0.24, w: d * 0.52, h: d * 0.52 });
}

function text(s, t, x, y, w, h, opts = {}) {
  s.addText(t, { x, y, w, h, margin: 0, color: INK, valign: 'top', isTextBox: true, ...opts });
}

// Screenshot in a black frame with a hard shadow (screenshots are 16:10)
function screenshot(s, file, x, y, w, name) {
  const h = w * 1350 / 2160;
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: INK }, line: { color: INK, width: 1 }, shadow: hardShadow(), objectName: name });
  s.addImage({ path: S(file), x: x + 0.04, y: y + 0.04, w: w - 0.08, h: h - 0.08 });
  return h;
}

// Phone mock-up around a mobile screenshot (1170 x 2532)
function phone(s, file, x, y, imgW, name) {
  const imgH = imgW * 2532 / 1170;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w: imgW + 0.16, h: imgH + 0.44, fill: { color: INK }, line: { color: INK, width: 1 }, rectRadius: 0.22, shadow: hardShadow(), objectName: name,
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + imgW / 2 - 0.22, y: y + 0.09, w: 0.6, h: 0.08, fill: { color: '333333' }, line: { color: '333333', width: 0 }, rectRadius: 0.04 });
  s.addImage({ path: S(file), x: x + 0.08, y: y + 0.24, w: imgW, h: imgH });
}

// Icon + heading + short text inside a card
function featureCard(s, x, y, w, h, icon, color, heading, body, whiteIcon = false) {
  card(s, x, y, w, h);
  iconCircle(s, icon, x + 0.3, y + 0.3, 0.72, color, whiteIcon);
  text(s, heading, x + 0.3, y + 1.17, w - 0.6, 0.42, { fontFace: HEAD, fontSize: 16 });
  text(s, body, x + 0.3, y + 1.6, w - 0.6, h - 1.75, { fontSize: 14 });
}

// Row with an icon on the left, heading and text on the right
function iconRow(s, x, y, w, icon, color, heading, body, whiteIcon = false) {
  iconCircle(s, icon, x, y, 0.62, color, whiteIcon);
  text(s, heading, x + 0.85, y - 0.02, w - 0.85, 0.36, { fontFace: HEAD, fontSize: 15 });
  text(s, body, x + 0.85, y + 0.36, w - 0.85, 0.66, { fontSize: 14 });
}

let section = '';
function slide(master, sectionTitle) {
  if (sectionTitle !== section) { pres.addSection({ title: sectionTitle }); section = sectionTitle; }
  return pres.addSlide({ masterName: master, sectionTitle });
}

// ---------------------------------------------------------------- 1. title

let s = slide('TITLE', 'Introduction');
s.addImage({ path: A('logo.png'), x: 0.8, y: 1.15, w: 1.45, h: 1.45 });
s.addText([{ text: 'Mohalla' }, { text: '.', options: { color: RED } }], { placeholder: 'title' });
s.addText('Your neighbourhood, one tap away', { placeholder: 'subtitle' });
text(s, 'A local business discovery app for the web and Android', 0.8, 4.95, 7.2, 0.45, { fontSize: 18 });
card(s, 0.8, 5.65, 7.0, 1.05);
text(s, [
  { text: 'FSB Degree College (Fortune School of Business), Hyderabad', options: { bold: true, breakLine: true } },
  { text: 'Presented by: [Your name]  ·  [Roll no.]  ·  Guide: [Guide name]' },
], 1.05, 5.82, 6.6, 0.75, { fontSize: 15, valign: 'middle' });
phone(s, 'm-home.png', 9.25, 0.5, 2.75, 'Phone mock-up');
s.addShape(pres.shapes.STAR_4_POINT, { x: 8.55, y: 0.75, w: 0.85, h: 0.85, fill: { color: WHITE }, line: { color: INK, width: 2 } });
s.addShape(pres.shapes.STAR_4_POINT, { x: 12.35, y: 5.9, w: 0.6, h: 0.6, fill: { color: WHITE }, line: { color: INK, width: 2 } });
s.addNotes('Introduce the project: Mohalla means neighbourhood. It is a JustDial-style app to find and contact trusted local businesses, built as a web app and an Android app. Fill in your name, roll number and guide before presenting.');

// ---------------------------------------------------------------- 2. problem

s = slide('CONTENT', 'Introduction');
s.addText('The problem', { placeholder: 'title' });
featureCard(s, 0.6, 1.6, 3.95, 2.35, 'phoneOff', RED, 'Spam calls', 'Share your number on a listing site and the calls never stop.', true);
featureCard(s, 4.85, 1.6, 3.95, 2.35, 'clock', YELLOW, 'Outdated details', 'Wrong timings and closed shops, with no way to know who is open now.');
featureCard(s, 0.6, 4.3, 3.95, 2.35, 'search', BLUE, 'Hard to describe', 'People know the problem ("AC not cooling"), not the category name.', true);
featureCard(s, 4.85, 4.3, 3.95, 2.35, 'mapPin', GREEN, 'Missing places', 'Small shops and even colleges are often not listed at all.', true);
card(s, 9.15, 1.6, 3.55, 5.05, PURPLE, 'Quote card');
s.addImage({ path: A('messages-w.png'), x: 9.5, y: 1.95, w: 0.7, h: 0.7 });
text(s, '"I need a plumber who is open right now, without getting 20 spam calls afterwards."', 9.5, 2.9, 2.9, 2.5, { fontFace: HEAD, fontSize: 19, color: WHITE });
text(s, 'Every family looking for local help', 9.5, 5.7, 2.9, 0.6, { fontSize: 14, color: YELLOW, bold: true });
s.addNotes('Four everyday problems with existing directory apps: spam calls once you share your number, timings that are out of date, search that needs the exact category name, and places that are simply missing. Mohalla is designed around these four problems.');

// ---------------------------------------------------------------- 3. solution

s = slide('CONTENT', 'Introduction');
s.addText('Our solution: Mohalla', { placeholder: 'title' });
iconRow(s, 0.6, 1.65, 5.3, 'search', YELLOW, 'Find anything nearby', 'Search by name, category, city, or just describe your problem.');
iconRow(s, 0.6, 2.85, 5.3, 'messages', PINK, 'Contact without spam', 'Call, WhatsApp, or chat in the app with your number hidden.');
iconRow(s, 0.6, 4.05, 5.3, 'smartphone', BLUE, 'Web and Android', 'One codebase runs in the browser and as an Android app.', true);
[['16', 'categories', YELLOW], ['1,200+', 'reviews', PINK], ['2', 'platforms', GREEN]].forEach(([n, label, fill], i) => {
  const x = 0.6 + i * 1.8;
  card(s, x, 5.3, 1.55, 1.3, fill);
  text(s, n, x, 5.42, 1.55, 0.6, { fontFace: HEAD, fontSize: 24, align: 'center', color: fill === GREEN ? WHITE : INK });
  text(s, label, x, 6.02, 1.55, 0.4, { fontSize: 14, align: 'center', color: fill === GREEN ? WHITE : INK });
});
screenshot(s, 'home.png', 6.4, 1.65, 6.3, 'Home page screenshot');
text(s, 'Home page: search bar, Smart Ask examples, "near me" and Emergency', 6.4, 5.75, 6.3, 0.4, { fontSize: 12, italic: true });
s.addNotes('Mohalla brings together search, real nearby places and safe contact. The demo data has 16 categories and more than 1,200 reviews, and real places are loaded live from OpenStreetMap.');

// ---------------------------------------------------------------- 4. features

s = slide('CONTENT', 'Features');
s.addText('Key features', { placeholder: 'title' });
const features = [
  ['search', RED, 'Smart filters', 'Top rated, verified, open now, quick response and near me.', true],
  ['mapPin', BLUE, 'Real places nearby', 'Live data from OpenStreetMap, sorted by walking distance.', true],
  ['star', YELLOW, 'Ratings and reviews', '1 to 5 stars, rating breakdown and verified badges.', false],
  ['store', GREEN, 'Business dashboard', 'Owners add listings, photos and timings, and reply to enquiries.', true],
  ['shield', PURPLE, 'Admin panel', 'Approve, verify and feature listings; manage categories.', true],
  ['smartphone', PINK, 'Android app', 'The same app as an APK, with GPS and its own icon.', false],
];
features.forEach(([icon, color, h, b, white], i) => {
  featureCard(s, 0.6 + (i % 3) * 4.15, 1.6 + Math.floor(i / 3) * 2.65, 3.85, 2.35, icon, color, h, b, white);
});
s.addNotes('Six core features. Customers search and filter, see real places nearby, read reviews. Business owners manage their listings from a dashboard. Admins moderate. Everything also works in the Android app.');

// ---------------------------------------------------------------- 5. comparison

s = slide('CONTENT', 'Features');
s.addText('What makes Mohalla different', { placeholder: 'title' });
const head = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: PURPLE }, fontSize: 16 } });
const rows = [
  [head('Need'), head('Typical directory apps'), head('Mohalla')],
  ['Your phone number', 'Shared with many businesses', 'Hidden: Privacy Mode with in-app chat'],
  ['"Is it open right now?"', 'Fixed timings only', 'Live Status set by the owner in one tap'],
  ['Searching', 'Exact category keywords', 'Plain sentences, English and Hinglish (Smart Ask)'],
  ['Emergencies', 'Not covered', 'Nearest hospitals, pharmacies and helplines'],
  ['Places not listed', 'Not found', 'Live OpenStreetMap lookup, or add it free'],
  ['Map and place data', 'Paid map services', 'Free, open data (OpenStreetMap)'],
].map((r, i) => (i === 0 ? r : r.map((c, j) => ({ text: c, options: { bold: j !== 1, color: j === 2 ? GREEN : INK } }))));
s.addTable(rows, {
  x: 0.6, y: 1.6, w: 12.1, colW: [3.1, 4.0, 5.0], rowH: 0.62, fontSize: 15, valign: 'middle', margin: [0, 0.15, 0, 0.15],
  border: { type: 'solid', pt: 1.5, color: '111111' }, fill: { color: WHITE }, objectName: 'Comparison table',
});
s.addNotes('This is the core of our project: four features that typical directory apps do not offer. Privacy Mode, Live Status, Smart Ask and Emergency mode. We also use free open map data instead of paid map services.');

// ---------------------------------------------------------------- 6. smart ask

s = slide('CONTENT', 'Features');
s.addText('Smart Ask: just describe the problem', { placeholder: 'title' });
card(s, 0.6, 1.65, 4.6, 1.0);
s.addImage({ path: A('search.png'), x: 0.85, y: 1.95, w: 0.4, h: 0.4 });
text(s, 'my AC is not cooling, need someone urgently', 1.4, 1.75, 3.65, 0.8, { fontSize: 15, italic: true, valign: 'middle' });
s.addShape(pres.shapes.DOWN_ARROW, { x: 2.6, y: 2.85, w: 0.6, h: 0.65, fill: { color: YELLOW }, line: { color: INK, width: 2 } });
card(s, 0.6, 3.7, 4.6, 1.45, PURPLE);
text(s, 'Smart Ask understood:', 0.9, 3.85, 4.0, 0.4, { fontSize: 15, bold: true, color: WHITE });
[['AC Repair', 1.15], ['Open now', 1.1], ['Nearest first', 1.4]].reduce((x, [label, w]) => {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.4, w, h: 0.45, fill: { color: WHITE }, line: { color: INK, width: 1.5 }, rectRadius: 0.22 });
  text(s, label, x, 4.4, w, 0.45, { fontSize: 13, bold: true, align: 'center', valign: 'middle' });
  return x + w + 0.1;
}, 0.9);
text(s, 'Understands English and Hinglish ("bukhar", "nal leak", "khana") and runs inside the app, with no paid AI service.', 0.6, 5.45, 4.6, 1.1, { fontSize: 14 });
screenshot(s, 'smart-ask.png', 5.6, 1.65, 7.1, 'Smart Ask screenshot');
s.addNotes('Smart Ask turns a normal sentence into search filters: the category (AC repair), urgency (open now) and distance (nearest first). It uses keyword matching for English and Hinglish words, so it works offline and costs nothing. A plain business name like "fsb degree college" is searched as a name instead.');

// ---------------------------------------------------------------- 7. real places

s = slide('CONTENT', 'Features');
s.addText('Real places, found live', { placeholder: 'title' });
screenshot(s, 'fsb.png', 0.6, 1.65, 7.0, 'Real place search screenshot');
iconRow(s, 8.0, 1.7, 4.7, 'map', BLUE, 'Live from OpenStreetMap', 'Turning on location loads real places nearby: 155 within 2 km in our Dehradun test.', true);
iconRow(s, 8.0, 3.25, 4.7, 'image', YELLOW, 'Real photo or satellite', "Uses the place's own photo when one exists, otherwise a satellite view of it.");
iconRow(s, 8.0, 4.8, 4.7, 'search', GREEN, 'Search any name', 'Unknown names are looked up live. Still missing? Anyone can add it.', true);
s.addNotes('Real places come from OpenStreetMap, a free open map. When you turn on location, the server imports places around you and saves them. Photos come from Wikidata when available; otherwise we show a satellite view of the exact location. Example on screen: searching our own college.');

// ---------------------------------------------------------------- 8. privacy + live status

s = slide('CONTENT', 'Features');
s.addText('Privacy Mode and Live Status', { placeholder: 'title' });
card(s, 0.6, 1.6, 6.0, 5.05);
iconCircle(s, 'lock', 0.9, 1.9, 0.72, PINK);
text(s, 'Privacy Mode', 1.8, 2.05, 4.5, 0.45, { fontFace: HEAD, fontSize: 20 });
[
  ['Customer sends an enquiry and turns on "hide my number".', PINK],
  ['The business sees only xxxxxxxx10, never the full number.', YELLOW],
  ['They talk in the in-app chat: no spam calls later.', GREEN],
].forEach(([t, color], i) => {
  const y = 3.0 + i * 1.15;
  s.addShape(pres.shapes.OVAL, { x: 0.9, y, w: 0.6, h: 0.6, fill: { color }, line: { color: INK, width: 2 } });
  text(s, String(i + 1), 0.9, y, 0.6, 0.6, { fontFace: HEAD, fontSize: 18, align: 'center', valign: 'middle', color: color === GREEN ? WHITE : INK });
  text(s, t, 1.75, y - 0.02, 4.55, 0.7, { fontSize: 15, valign: 'middle' });
});
card(s, 6.9, 1.6, 5.8, 5.05);
iconCircle(s, 'radio', 7.2, 1.9, 0.72, GREEN, true);
text(s, 'Live Status', 8.1, 2.05, 4.3, 0.45, { fontFace: HEAD, fontSize: 20 });
[['Available now', GREEN, WHITE], ['Busy', YELLOW, INK], ['Closed today', RED, WHITE]].reduce((x, [label, fill, color]) => {
  const w = label.length * 0.11 + 0.5;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 3.05, w, h: 0.55, fill: { color: fill }, line: { color: INK, width: 2 }, rectRadius: 0.27 });
  text(s, label, x, 3.05, w, 0.55, { fontSize: 15, bold: true, align: 'center', valign: 'middle', color });
  return x + w + 0.18;
}, 7.2);
text(s, 'Owners update their status in one tap from the dashboard. Customers see it on the listing and in search results.', 7.2, 4.0, 5.2, 1.0, { fontSize: 15 });
text(s, 'A status expires after 12 hours, so it is never out of date.', 7.2, 5.2, 5.2, 0.8, { fontSize: 15, bold: true });
s.addNotes('Privacy Mode: the customer can hide their phone number. The business sees a masked number and replies in an in-app chat. Live Status: the owner taps Available, Busy or Closed today. It expires after 12 hours so customers never see stale information.');

// ---------------------------------------------------------------- 9. emergency

s = slide('CONTENT', 'Features');
s.addText('Emergency mode', { placeholder: 'title' });
text(s, 'One tap from the home page shows the nearest hospitals, pharmacies and ATMs from live map data, with distance and directions.', 0.6, 1.65, 5.2, 1.35, { fontSize: 16 });
[['112', 'Emergency'], ['108', 'Ambulance'], ['100', 'Police'], ['101', 'Fire'], ['1091', 'Women']].forEach(([n, label], i) => {
  const x = 0.6 + (i % 3) * 1.78, y = 3.2 + Math.floor(i / 3) * 1.45;
  card(s, x, y, 1.55, 1.2);
  text(s, n, x, y + 0.15, 1.55, 0.55, { fontFace: HEAD, fontSize: 22, align: 'center', color: RED });
  text(s, label, x, y + 0.72, 1.55, 0.35, { fontSize: 13, bold: true, align: 'center' });
});
text(s, "India's helplines, ready to call. No login needed.", 0.6, 6.1, 5.2, 0.4, { fontSize: 14, italic: true });
screenshot(s, 'emergency.png', 6.2, 1.65, 6.5, 'Emergency screenshot');
s.addNotes('Emergency mode works without logging in. It uses the phone location to list the nearest hospitals, pharmacies and ATMs from OpenStreetMap, sorted by distance with directions, plus the national helplines 112, 108, 100, 101 and 1091.');

// ---------------------------------------------------------------- 10. android

s = slide('CONTENT', 'Features');
s.addText('Same app, now on Android', { placeholder: 'title' });
phone(s, 'm-home.png', 0.7, 1.5, 2.2, 'Phone: home');
phone(s, 'm-search.png', 3.4, 1.5, 2.2, 'Phone: search');
phone(s, 'm-detail.png', 6.1, 1.5, 2.2, 'Phone: listing');
card(s, 9.1, 1.6, 3.6, 5.05);
s.addImage({ path: A('logo.png'), x: 9.4, y: 1.9, w: 0.9, h: 0.9 });
text(s, [
  { text: 'Built with Capacitor: the same React code becomes a native APK', options: { bullet: true, breakLine: true } },
  { text: 'Uses phone GPS for "near me" and walking distance', options: { bullet: true, breakLine: true } },
  { text: 'Own app icon and splash screen', options: { bullet: true, breakLine: true } },
  { text: 'Gets live data from the Mohalla server', options: { bullet: true } },
], 9.4, 3.05, 3.05, 3.45, { fontSize: 16, paraSpaceAfter: 14 });
s.addNotes('We did not rewrite the app for Android. Capacitor wraps the same React code into a native Android app, so every feature works on both. The app uses the phone GPS and connects to our Node.js server for data.');

// ---------------------------------------------------------------- 11. owners + admin

s = slide('CONTENT', 'Features');
s.addText('For business owners and admins', { placeholder: 'title' });
screenshot(s, 'dashboard.png', 0.6, 1.6, 5.9, 'Dashboard screenshot');
screenshot(s, 'admin.png', 6.8, 1.6, 5.9, 'Admin screenshot');
text(s, 'Business dashboard', 0.6, 5.5, 5.9, 0.4, { fontFace: HEAD, fontSize: 16 });
text(s, 'Add listings and photos, set Live Status, see views and reply to enquiries.', 0.6, 5.92, 5.9, 0.7, { fontSize: 14 });
text(s, 'Admin panel', 6.8, 5.5, 5.9, 0.4, { fontFace: HEAD, fontSize: 16 });
text(s, 'Approve new listings, verify and feature businesses, and manage users and categories.', 6.8, 5.92, 5.9, 0.7, { fontSize: 14 });
s.addNotes('Three roles: customer, business owner and admin. Owners manage their own listings. New listings stay hidden until an admin approves them, which keeps fake listings out.');

// ---------------------------------------------------------------- 12. architecture

s = slide('CONTENT', 'Technical design');
s.addText('System architecture', { placeholder: 'title' });
function box(x, y, w, h, fill, icon, title, sub, white) {
  card(s, x, y, w, h, fill);
  s.addImage({ path: A(`${icon}${white ? '-w' : ''}.png`), x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.5 });
  text(s, title, x + 0.9, y + 0.25, w - 1.1, 0.45, { fontFace: HEAD, fontSize: 15, color: white ? WHITE : INK });
  text(s, sub, x + 0.25, y + 0.85, w - 0.5, h - 0.95, { fontSize: 14, color: white ? WHITE : INK });
}
function arrow(x, y, w, label) {
  s.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color: INK, width: 2.5, beginArrowType: 'triangle', endArrowType: 'triangle' } });
  text(s, label, x - 0.2, y - 0.38, w + 0.4, 0.3, { fontSize: 11, align: 'center', bold: true });
}
box(0.6, 1.6, 3.3, 1.55, YELLOW, 'globe', 'Web app', 'React + Vite, in any browser');
box(0.6, 3.75, 3.3, 1.55, PINK, 'smartphone', 'Android app', 'Capacitor APK, uses GPS');
box(4.95, 1.6, 3.4, 3.7, PURPLE, 'server', 'Express API', 'Node.js server\nJWT login and roles\nSearch and Smart Ask\nPhoto uploads\nOpenStreetMap import', true);
box(9.4, 1.6, 3.3, 1.55, GREEN, 'database', 'SQLite', 'Built into Node.js, one file', true);
box(9.4, 3.75, 3.3, 1.55, BLUE, 'map', 'OpenStreetMap', 'Overpass + Nominatim: real places', true);
arrow(3.95, 2.38, 0.95, 'JSON');
arrow(3.95, 4.52, 0.95, 'JSON');
arrow(8.4, 2.38, 0.95, 'SQL');
arrow(8.4, 4.52, 0.95, 'HTTPS');
card(s, 0.6, 5.7, 12.1, 0.85);
text(s, [
  { text: 'In the browser: ', options: { bold: true } },
  { text: 'map tiles from OpenStreetMap and Esri satellite imagery, place photos from Wikidata' },
], 0.85, 5.7, 11.6, 0.85, { fontSize: 15, valign: 'middle' });
s.addNotes('Client-server design. Both the web app and the Android app talk to one Express REST API using JSON. The API stores everything in SQLite, which is built into Node.js, so there is nothing extra to install. The API imports real places from OpenStreetMap. Maps and satellite images load directly in the browser.');

// ---------------------------------------------------------------- 13. database

s = slide('CONTENT', 'Technical design');
s.addText('Database design', { placeholder: 'title' });
function table(x, y, w, h, fill, name, fields, white) {
  card(s, x, y, w, h, fill);
  text(s, name, x + 0.25, y + 0.15, w - 0.5, 0.4, { fontFace: HEAD, fontSize: 15, color: white ? WHITE : INK });
  text(s, fields.join('\n'), x + 0.25, y + 0.6, w - 0.5, h - 0.7, { fontSize: 12, color: white ? WHITE : INK, fontFace: 'Consolas' });
}
table(0.6, 1.6, 3.3, 2.3, YELLOW, 'users', ['id  PK', 'name, email, phone', 'password (bcrypt)', 'role: user | business | admin']);
table(0.6, 4.3, 3.3, 2.3, PINK, 'categories', ['id  PK', 'name, slug', 'icon, color', 'keywords']);
table(4.95, 1.6, 3.4, 5.0, PURPLE, 'businesses', ['id  PK', 'owner_id  FK users', 'category_id  FK categories', 'name, description', 'phone, whatsapp, website', 'address, area, city', 'lat, lng', 'hours, services, photos', 'is_approved, is_verified', 'live_status, source, osm_id'], true);
table(9.4, 1.6, 3.3, 1.5, WHITE, 'reviews', ['user_id, business_id  FK', 'rating 1-5, comment']);
table(9.4, 3.35, 3.3, 1.75, WHITE, 'enquiries', ['user_id, business_id  FK', 'message, hide_phone', 'status  + chat messages']);
table(9.4, 5.35, 3.3, 1.25, WHITE, 'favorites', ['user_id, business_id  PK']);
[[2.75], [5.45]].forEach(([y]) => s.addShape(pres.shapes.LINE, { x: 3.95, y, w: 0.95, h: 0, line: { color: INK, width: 2.5, endArrowType: 'triangle' } }));
[[2.35], [4.22], [5.97]].forEach(([y]) => s.addShape(pres.shapes.LINE, { x: 8.4, y, w: 0.95, h: 0, line: { color: INK, width: 2.5, endArrowType: 'triangle' } }));
text(s, '1 : many', 3.95, 2.35, 0.95, 0.3, { fontSize: 11, bold: true, align: 'center' });
text(s, '1 : many', 8.4, 1.95, 0.95, 0.3, { fontSize: 11, bold: true, align: 'center' });
s.addNotes('Seven tables. A business belongs to one category and optionally one owner. Users write reviews (one per business, rating 1 to 5), send enquiries with optional hidden phone, and save favourites. enquiry_messages stores the in-app chat. Passwords are hashed with bcrypt.');

// ---------------------------------------------------------------- 14. tech stack

s = slide('CONTENT', 'Technical design');
s.addText('Tech stack', { placeholder: 'title' });
[
  ['code', RED, 'Frontend', ['React 19', 'Vite', 'React Router', 'Leaflet maps'], true],
  ['server', BLUE, 'Backend', ['Node.js', 'Express 5', 'JWT + bcrypt', 'Multer uploads'], true],
  ['database', GREEN, 'Database', ['SQLite in Node.js', '7 tables', 'WAL mode', 'Indexes'], true],
  ['smartphone', PURPLE, 'Mobile', ['Capacitor 6', 'Android SDK', 'GPS location', 'APK build'], true],
  ['globe', YELLOW, 'Open data', ['OpenStreetMap', 'Wikidata', 'Openverse', 'Esri imagery'], false],
].forEach(([icon, color, h, items, white], i) => {
  const x = 0.6 + i * 2.465;
  card(s, x, 1.6, 2.24, 3.95);
  iconCircle(s, icon, x + 0.3, 1.9, 0.8, color, white);
  text(s, h, x + 0.3, 2.95, 1.75, 0.45, { fontFace: HEAD, fontSize: 16 });
  text(s, items.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < items.length - 1 } })), x + 0.3, 3.55, 1.8, 2.6, { fontSize: 14, paraSpaceAfter: 10 });
});
card(s, 0.6, 5.85, 12.1, 0.75, YELLOW);
text(s, 'Free and open source, JavaScript end to end, and set up with a single npm install', 0.85, 5.85, 11.6, 0.75, { fontSize: 16, bold: true, valign: 'middle' });
s.addNotes('Everything is free and open source. JavaScript is used end to end: React in the browser, Node.js and Express on the server, Capacitor for Android. SQLite is built into Node.js 22+, so setup is just npm install.');

// ---------------------------------------------------------------- 15. testing

s = slide('CONTENT', 'Technical design');
s.addText('Testing and results', { placeholder: 'title' });
[
  ['95/95', 'automated API tests passing', GREEN, WHITE],
  ['0', 'errors in a 1,100-request load test', YELLOW, INK],
  ['74 ms', 'search response time (95th percentile)', BLUE, WHITE],
  ['20', 'bugs found by stress testing, all fixed', PINK, INK],
].forEach(([n, label, fill, color], i) => {
  const x = 0.6 + i * 3.1;
  card(s, x, 1.65, 2.8, 2.3, fill);
  text(s, n, x + 0.25, 1.85, 2.3, 0.95, { fontFace: HEAD, fontSize: 36, color, valign: 'middle' });
  text(s, label, x + 0.25, 2.85, 2.3, 0.9, { fontSize: 14, color, bold: true });
});
card(s, 0.6, 4.35, 12.1, 2.25);
text(s, 'What we tested', 0.9, 4.55, 6, 0.4, { fontFace: HEAD, fontSize: 16 });
const tested = (list) => list.map((t, j) => ({ text: t, options: { bullet: true, breakLine: j < list.length - 1 } }));
text(s, tested(['Login, roles and permissions', 'Search, filters and sorting', 'Reviews, enquiries and Privacy Mode chat']), 0.9, 5.05, 5.6, 1.4, { fontSize: 14, paraSpaceAfter: 6 });
text(s, tested(['Photo uploads (fake images blocked)', 'Bad input: wrong types, huge requests', 'Load: 20 users at once, 100 writes together']), 6.8, 5.05, 5.6, 1.4, { fontSize: 14, paraSpaceAfter: 6 });
s.addNotes('We wrote an automated test suite with Node.js test runner: 95 tests covering every API route. A stress test found 20 bugs (for example, crashes on bad input and an unsafe file upload). All were fixed and all 95 tests now pass. Under load the server returned zero errors.');

// ---------------------------------------------------------------- 16. future scope

s = slide('CONTENT', 'Wrap-up');
s.addText('Future scope', { placeholder: 'title' });
[
  ['creditCard', YELLOW, 'Bookings and payments', 'Book a slot and pay online with UPI.', false],
  ['bell', RED, 'Notifications', 'Instant alerts for replies and offers.', true],
  ['mic', BLUE, 'Voice search', 'Ask by voice in Hindi or English.', true],
  ['languages', GREEN, 'More languages', 'Hindi, Telugu and other Indian languages.', true],
  ['badge', PURPLE, 'Verified reviews', 'OTP check so every review is real.', true],
  ['rocket', PINK, 'Go live', 'Host online and publish on the Play Store.', false],
].forEach(([icon, color, h, b, white], i) => {
  featureCard(s, 0.6 + (i % 3) * 4.15, 1.6 + Math.floor(i / 3) * 2.65, 3.85, 2.35, icon, color, h, b, white);
});
s.addNotes('Next steps if we continue the project: online booking and UPI payments, push notifications, voice search, more Indian languages, OTP-verified reviews, and publishing the app online and on the Play Store.');

// ---------------------------------------------------------------- 17. thank you

s = slide('TITLE', 'Wrap-up');
s.addImage({ path: A('logo.png'), x: 0.8, y: 1.15, w: 1.45, h: 1.45 });
s.addText('Thank you', { placeholder: 'title' });
s.addText('Questions?', { placeholder: 'subtitle' });
text(s, 'Live demo: web app and Android app', 0.8, 4.95, 7.2, 0.45, { fontSize: 18 });
phone(s, 'm-detail.png', 9.25, 0.5, 2.75, 'Phone mock-up');
s.addShape(pres.shapes.STAR_4_POINT, { x: 8.55, y: 0.75, w: 0.85, h: 0.85, fill: { color: WHITE }, line: { color: INK, width: 2 } });
s.addNotes('Thank the audience and invite questions. Then switch to the live demo: open the website, then the Android app.');

// ---------------------------------------------------------------- write

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('Wrote', OUT);
})();
