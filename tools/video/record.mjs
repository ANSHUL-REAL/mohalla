/**
 * Mohalla demo recorder
 * ---------------------
 * Drives the running app (http://127.0.0.1:5000) with Playwright + system Chrome and records each
 * scene as JPEG frames via the Chrome DevTools screencast (frames/<clip>/*.jpg + frames/<clip>.json
 * with wall-clock timestamps). build.py then turns the frames into the final MP4.
 *
 * Usage:   node record.mjs            -> record every scene
 *          node record.mjs owner admin -> re-record only those scenes
 * Needs:   npm install (playwright-core), Google Chrome installed, app server running on :5000.
 * NOTE:    running it creates data in the app (OSM places import, an enquiry + chat reply on
 *          "CoolCare AC Services", live status change, admin approval of "FitZone Fitness").
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:5000';
const OUT = path.resolve('frames');
const GEO = { latitude: 30.3165, longitude: 78.0322 }; // Dehradun
const ACCOUNTS = {
  user: ['user@mohalla.test', 'user123'],
  owner: ['owner@mohalla.test', 'owner123'],
  admin: ['admin@mohalla.test', 'admin123'],
};
const OWNER_BIZ_ID = 11; // "CoolCare AC Services" (owned by owner@mohalla.test)
const COLLEGE_Q = 'fsb degree college';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

// ---------- fake cursor / touch indicator injected into every page ----------
const cursorScript = (touch) => {
  const S = '__fc_pos';
  let x = 800, y = 450;
  try { const p = JSON.parse(sessionStorage.getItem(S)); if (p) { x = p[0]; y = p[1]; } } catch { /* */ }
  const install = () => {
    document.documentElement.style.scrollBehavior = 'auto';
    if (document.getElementById('__fc')) return;
    const st = document.createElement('style');
    st.textContent = `#__fc{position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;will-change:transform}
      .__rip{position:fixed;z-index:2147483646;pointer-events:none;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;
        border:4px solid #FD5A46;background:rgba(253,90,70,.18);animation:__rip .55s ease-out forwards}
      .__tap{position:fixed;z-index:2147483646;pointer-events:none;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
        background:rgba(20,20,20,.28);border:3px solid rgba(255,255,255,.9);animation:__rip .6s ease-out forwards}
      @keyframes __rip{from{transform:scale(.4);opacity:1}to{transform:scale(1.5);opacity:0}}
      html{scroll-behavior:auto!important}`;
    document.documentElement.appendChild(st);
    if (!touch) {
      const c = document.createElement('div');
      c.id = '__fc';
      c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M4 2.5l15 8.6-6.6 1.6 3.9 7-2.6 1.4-3.9-7L5 19z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      c.style.transform = `translate(${x - 4}px,${y - 2}px)`;
      document.documentElement.appendChild(c);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  const move = (e) => {
    x = e.clientX; y = e.clientY;
    const c = document.getElementById('__fc');
    if (c) c.style.transform = `translate(${x - 4}px,${y - 2}px)`;
    try { sessionStorage.setItem(S, JSON.stringify([x, y])); } catch { /* */ }
  };
  document.addEventListener('mousemove', move, true);
  const ripple = (cx, cy) => {
    const r = document.createElement('div');
    r.className = touch ? '__tap' : '__rip';
    r.style.left = cx + 'px'; r.style.top = cy + 'px';
    document.documentElement.appendChild(r);
    setTimeout(() => r.remove(), 700);
  };
  document.addEventListener('mousedown', (e) => ripple(e.clientX, e.clientY), true);
  document.addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) ripple(t.clientX, t.clientY); }, true);
};

// ---------- recorder ----------
async function newSession(browser, { mobile = false, role = null, freshLocation = false } = {}) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      permissions: ['geolocation'], geolocation: GEO, locale: 'en-IN' }
    : { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.2,
      permissions: ['geolocation'], geolocation: GEO, locale: 'en-IN' });
  let token = null;
  if (role) {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: ACCOUNTS[role][0], password: ACCOUNTS[role][1] }),
    });
    token = (await r.json()).token;
  }
  await ctx.addInitScript(({ token, fresh, place }) => {
    try {
      if (!sessionStorage.getItem('__seeded')) {
        sessionStorage.setItem('__seeded', '1');
        if (!fresh) {
          localStorage.setItem('lk_loc', JSON.stringify([30.3165, 78.0322]));
          localStorage.setItem('lk_place', place);
        }
        if (token) localStorage.setItem('lk_token', token);
      }
    } catch { /* */ }
  }, { token, fresh: freshLocation, place: 'Arhat Bazar, Dehradun' });
  await ctx.addInitScript(cursorScript, mobile);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const s = { ctx, page, cdp, mobile, clip: null, frames: [], paused: false, n: 0 };
  cdp.on('Page.screencastFrame', async (f) => {
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch { /* */ }
    if (!s.clip || s.paused) return;
    const name = String(s.n++).padStart(6, '0') + '.jpg';
    fs.writeFileSync(path.join(OUT, s.clip, name), Buffer.from(f.data, 'base64'));
    s.frames.push({ f: name, t: Date.now() / 1000, pause: s.pendingCut || false });
    s.pendingCut = false;
  });
  return s;
}

async function start(s, clip) {
  fs.rmSync(path.join(OUT, clip), { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, clip), { recursive: true });
  s.clip = clip; s.frames = []; s.n = 0; s.paused = false; s.segStart = Date.now() / 1000; s.cuts = [];
  const size = s.mobile ? { maxWidth: 780, maxHeight: 1688 } : { maxWidth: 1920, maxHeight: 1080 };
  await s.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, everyNthFrame: 1, ...size });
  await nudge(s);
  console.log('● rec', clip);
}
// Hard cut: pause capture (e.g. during a page load) and resume later
async function pause(s) { s.paused = true; s.pauseAt = Date.now() / 1000; }
async function resume(s) {
  s.cuts.push([s.pauseAt, Date.now() / 1000]);
  s.paused = false;
  await nudge(s);
}
async function stop(s) {
  await sleep(120);
  const end = Date.now() / 1000;
  await s.cdp.send('Page.stopScreencast');
  fs.writeFileSync(path.join(OUT, s.clip + '.json'), JSON.stringify({ frames: s.frames, start: s.segStart, end, cuts: s.cuts, mobile: s.mobile }));
  console.log('■ stop', s.clip, s.frames.length, 'frames', (end - s.segStart).toFixed(1) + 's');
  s.clip = null;
}
// Force a fresh frame (screencast only sends frames when something repaints)
async function nudge(s) {
  await s.page.evaluate(() => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:.01;z-index:-1';
    document.documentElement.appendChild(d);
    requestAnimationFrame(() => requestAnimationFrame(() => d.remove()));
  }).catch(() => {});
}

// ---------- human-like helpers ----------
let mouse = { x: 800, y: 450 };
async function moveTo(s, x, y, ms = 650) {
  const { page } = s;
  const sx = mouse.x, sy = mouse.y;
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const p = i / steps;
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    await page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e);
    await sleep(ms / steps);
  }
  mouse = { x, y };
}
async function box(loc) {
  await loc.waitFor({ state: 'visible', timeout: 20000 });
  const b = await loc.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
}
async function ensureVisible(s, loc, topOffset = 140) {
  const vh = s.mobile ? 844 : 900;
  const { b } = await box(loc);
  if (b.y < topOffset - 40 || b.y + b.height > vh - 60) await scrollBy(s, b.y - topOffset, 700);
}
async function hover(s, loc, ms = 650) {
  if (s.mobile) return;
  await ensureVisible(s, loc);
  const { x, y } = await box(loc);
  await moveTo(s, x, y, ms);
}
async function click(s, loc, { ms = 650, wait = 350 } = {}) {
  await ensureVisible(s, loc);
  const { x, y } = await box(loc);
  if (s.mobile) {
    await s.page.touchscreen.tap(x, y);
  } else {
    await moveTo(s, x, y, ms);
    await sleep(120);
    await s.page.mouse.click(x, y);
  }
  await sleep(wait);
}
async function type(s, loc, text, delay = 55) {
  await click(s, loc);
  await s.page.keyboard.type(text, { delay });
}
async function scrollBy(s, dy, ms = 1200) {
  await s.page.evaluate(({ dy, ms }) => new Promise((res) => {
    const start = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const target = Math.max(0, Math.min(max, start + dy));
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      window.scrollTo(0, start + (target - start) * e);
      if (p < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  }), { dy, ms });
  await sleep(80);
}
async function scrollToEl(s, loc, offset = 120, ms = 1200) {
  loc = loc.first();
  await loc.waitFor({ state: 'attached', timeout: 20000 });
  const top = await loc.evaluate((el) => el.getBoundingClientRect().top);
  await scrollBy(s, top - offset, ms);
}
async function scrollTop(s, ms = 900) {
  const y = await s.page.evaluate(() => window.scrollY);
  await scrollBy(s, -y, ms);
}
async function noSkeleton(page, timeout = 30000) {
  await page.waitForFunction(() => !document.querySelector('.skeleton'), null, { timeout }).catch(() => console.log('  (skeleton timeout)'));
}
async function imagesLoaded(page, timeout = 8000) {
  await page.waitForFunction(() => [...document.images].filter((i) => {
    const r = i.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight && r.width > 0;
  }).every((i) => i.complete), null, { timeout }).catch(() => console.log('  (images timeout)'));
}
async function go(s, url) {
  await s.page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await s.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await s.page.evaluate(() => document.fonts.ready);
  await noSkeleton(s.page);
  await imagesLoaded(s.page);
  await sleep(300);
}

// ---------- scenes ----------
const scenes = {};

// 1. Home + location popup (fresh visitor) -> 2. Smart Ask -> 3. results filters -> 4. business detail
scenes.home = async (browser) => {
  const s = await newSession(browser, { freshLocation: true });
  const { page } = s;
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => document.fonts.ready);
  await imagesLoaded(page);
  await start(s, '01_home');
  await moveTo(s, 1000, 600, 400);
  const modal = page.locator('.location-modal');
  let popup = true;
  try { await modal.waitFor({ state: 'visible', timeout: 5000 }); } catch { popup = false; }
  if (popup) {
    await sleep(2200);
    await click(s, modal.getByRole('button', { name: 'Turn on location' }));
    const ok = await modal.waitFor({ state: 'detached', timeout: 25000 }).then(() => true).catch(() => false);
    if (!ok) await click(s, modal.getByRole('button', { name: 'Not now' }));
    await sleep(300);
    await imagesLoaded(page);
    await sleep(2200);
  }
  // scroll the home page: banners, categories, near you, trending
  await moveTo(s, 1450, 450, 500);
  await scrollToEl(s, page.locator('.banners'), 110, 1400);
  await sleep(1400);
  await scrollToEl(s, page.locator('.category-grid'), 160, 1300);
  await sleep(1800);
  const near = page.getByRole('heading', { name: 'Near you', exact: true });
  if (await near.count()) {
    await scrollToEl(s, near, 110, 1300);
    await imagesLoaded(page);
    await sleep(2000);
  }
  await scrollToEl(s, page.locator('.trend-row'), 220, 1300);
  await imagesLoaded(page);
  await sleep(2000);
  await scrollTop(s, 1400);
  await sleep(600);
  await stop(s);

  // ---- Smart Ask
  await start(s, '02_smartask');
  await sleep(500);
  const input = page.locator('.hero .searchbar-input input');
  await type(s, input, 'my AC is not cooling, need someone urgently', 55);
  await sleep(900);
  await click(s, page.locator('.hero .searchbar-btn'));
  await page.waitForURL(/\/search/);
  await page.locator('.smart-banner').waitFor();
  await noSkeleton(page);
  await imagesLoaded(page);
  await moveTo(s, 700, 230, 600);
  await sleep(2600);
  await stop(s);

  // ---- Results: filters, badges, show number
  await start(s, '03_results');
  await sleep(400);
  await click(s, page.locator('.fchip', { hasText: 'Top Rated' }));
  await noSkeleton(page); await imagesLoaded(page);
  await sleep(1600);
  await click(s, page.locator('.fchip', { hasText: 'Verified' }));
  await noSkeleton(page); await imagesLoaded(page);
  await sleep(1600);
  const card = page.locator('.biz-card').first();
  await scrollToEl(s, card, 150, 1000);
  await sleep(500);
  const badges = card.locator('.badges');
  if (await badges.count()) { await hover(s, badges); await sleep(1500); }
  const show = card.getByRole('button', { name: 'Show Number' });
  if (await show.count()) { await click(s, show); await sleep(1800); }
  await scrollBy(s, 420, 1500);
  await sleep(1500);
  await stop(s);

  // ---- Business detail
  await start(s, '04_detail');
  await pause(s);
  await go(s, `/business/${OWNER_BIZ_ID}`);
  await scrollTop(s, 10);
  await resume(s);
  await moveTo(s, 900, 400, 500);
  await sleep(2200);
  for (const btn of ['WhatsApp', 'Directions']) {
    const b = page.locator('.btn', { hasText: btn }).first();
    if (await b.count()) { await hover(s, b, 500); await sleep(700); }
  }
  await scrollToEl(s, page.locator('h3', { hasText: 'About' }).first(), 120, 1400);
  await sleep(1800);
  const locH = page.locator('h3', { hasText: 'Location' }).first();
  if (await locH.count()) { await scrollToEl(s, locH, 120, 1400); await sleep(2200); }
  const revTab = page.locator('button', { hasText: /^Reviews \(/ }).first();
  if (await revTab.count()) {
    await scrollToEl(s, revTab, 160, 1200);
    await click(s, revTab);
    await sleep(1800);
    await scrollBy(s, 380, 1400);
    await sleep(2000);
  }
  await stop(s);
  await s.ctx.close();
};

// 5. Real college search
scenes.college = async (browser) => {
  const s = await newSession(browser);
  const { page } = s;
  await go(s, '/search');
  await start(s, '05_college');
  await sleep(600);
  const input = page.locator('.search-top .searchbar-input input');
  await click(s, input);
  await page.keyboard.press('Control+A');
  await page.keyboard.type(COLLEGE_Q, { delay: 60 });
  await sleep(700);
  // pick "All cities" so the Hyderabad college shows up
  await page.locator('.search-top select').selectOption('');
  await click(s, page.locator('.search-top .searchbar-btn'));
  await page.waitForURL(/q=fsb/);
  await noSkeleton(page);
  await imagesLoaded(page);
  await sleep(2400);
  const title = page.locator('.biz-card-title', { hasText: 'FSB Degree College' }).first();
  await click(s, title);
  await page.waitForURL(/\/business\//);
  await noSkeleton(page);
  await imagesLoaded(page, 12000);
  await sleep(500);
  await moveTo(s, 1250, 300, 600);
  await sleep(2600);
  const locH = page.locator('h3', { hasText: 'Location' }).first();
  if (await locH.count()) { await scrollToEl(s, locH, 140, 1500); await imagesLoaded(page); await sleep(2200); }
  await stop(s);
  await s.ctx.close();
};

// 6. Privacy Mode enquiry as the customer (visible login)
scenes.privacy = async (browser) => {
  const s = await newSession(browser);
  const { page } = s;
  await go(s, '/login');
  await start(s, '06_privacy');
  await sleep(700);
  await type(s, page.locator('input[type=email]'), ACCOUNTS.user[0], 45);
  await type(s, page.locator('input[type=password]'), ACCOUNTS.user[1], 70);
  await sleep(400);
  await click(s, page.getByRole('button', { name: 'Log in' }));
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  await sleep(1200);
  await pause(s);
  await go(s, `/business/${OWNER_BIZ_ID}`);
  const formHead = page.locator('h3', { hasText: 'Get the best price' });
  await scrollToEl(s, formHead, 110, 10);
  await sleep(300);
  await resume(s);
  await sleep(1200);
  const msg = page.locator('form textarea').last();
  await click(s, msg);
  await page.keyboard.press('Control+A');
  await page.keyboard.type('My AC is not cooling. Can a technician come today evening?', { delay: 45 });
  await sleep(600);
  const toggle = page.locator('.privacy-toggle').last();
  await hover(s, toggle, 600);
  await sleep(2200);
  await click(s, page.getByRole('button', { name: 'Get Best Price' }).last());
  await page.locator('.toast, [class*=toast]').first().waitFor({ timeout: 8000 }).catch(() => {});
  await sleep(3000);
  await stop(s);
  await s.ctx.close();
};

// 7. Owner dashboard: live status + masked enquiry + reply in app
scenes.owner = async (browser) => {
  const s = await newSession(browser, { role: 'owner' });
  const { page } = s;
  await go(s, '/dashboard');
  await start(s, '07_owner');
  await moveTo(s, 900, 300, 500);
  await sleep(2200);
  const row = page.locator('.manage-row', { hasText: 'CoolCare AC Services' });
  await scrollToEl(s, row, 200, 1200);
  await sleep(800);
  const avail = row.locator('button', { hasText: 'Available now' });
  const isOn = await avail.evaluate((el) => el.classList.contains('active'));
  if (!isOn) await click(s, avail);
  else await hover(s, avail);
  await sleep(2200);
  await scrollTop(s, 900);
  await click(s, page.locator('.tabs button', { hasText: 'Enquiries' }));
  await sleep(1200);
  const enq = page.locator('.enquiry', { hasText: 'CoolCare AC Services' }).first();
  await enq.waitFor();
  await scrollToEl(s, enq, 160, 900);
  const badge = enq.locator('.privacy-badge');
  if (await badge.count()) { await hover(s, badge, 600); await sleep(2200); }
  await click(s, enq.locator('button', { hasText: 'Reply in app' }));
  await page.locator('.thread-input input').waitFor();
  await sleep(1200);
  await scrollToEl(s, enq, 160, 700);
  await type(s, page.locator('.thread-input input'), 'Hi! Our technician can visit today at 6 PM. Gas check + service: Rs 499.', 40);
  await sleep(500);
  await click(s, page.locator('.thread-input button'));
  await sleep(2800);
  await stop(s);
  await s.ctx.close();
};

// 8. Admin panel
scenes.admin = async (browser) => {
  const s = await newSession(browser, { role: 'admin' });
  const { page } = s;
  await go(s, '/admin');
  await start(s, '08_admin');
  await moveTo(s, 900, 350, 500);
  await sleep(2500);
  await scrollBy(s, 380, 1300);
  await sleep(1800);
  await scrollTop(s, 900);
  await click(s, page.locator('.tabs button', { hasText: 'Listings' }));
  await noSkeleton(page);
  const pendingPill = page.locator('.pill', { hasText: 'Pending' });
  if (!(await pendingPill.evaluate((el) => el.classList.contains('active')))) { await click(s, pendingPill); await noSkeleton(page); }
  await imagesLoaded(page);
  await sleep(1800);
  const approve = page.locator('.manage-row').first().locator('button', { hasText: 'Approve' });
  if (await approve.count()) { await click(s, approve); await sleep(2400); }
  await click(s, page.locator('.tabs button', { hasText: 'Users' }));
  await sleep(2200);
  await stop(s);
  await s.ctx.close();
};

// 9. Emergency
scenes.emergency = async (browser) => {
  const s = await newSession(browser);
  const { page } = s;
  await go(s, '/emergency');
  await page.waitForFunction(() => document.querySelectorAll('.btn-call, .btn').length > 5, null, { timeout: 20000 }).catch(() => {});
  await noSkeleton(page); await imagesLoaded(page);
  await start(s, '09_emergency');
  await moveTo(s, 900, 300, 500);
  await sleep(2500);
  await scrollBy(s, 420, 1500);
  await sleep(1800);
  await scrollBy(s, 420, 1500);
  await sleep(1800);
  await stop(s);
  await s.ctx.close();
};

// 10. Mobile
scenes.mobile = async (browser) => {
  const s = await newSession(browser, { mobile: true, role: 'user' });
  const { page } = s;
  await go(s, '/');
  await start(s, '10_mobile');
  await sleep(2200);
  await scrollBy(s, 520, 1400);
  await sleep(1500);
  await scrollBy(s, 600, 1400);
  await sleep(1500);
  await scrollTop(s, 1000);
  await sleep(500);
  const input = page.locator('.hero .searchbar-input input');
  await click(s, input);
  await page.keyboard.type('best dentist near me', { delay: 70 });
  await sleep(600);
  await click(s, page.locator('.hero .searchbar-btn'));
  await page.waitForURL(/\/search/);
  await noSkeleton(page); await imagesLoaded(page);
  await sleep(2200);
  await scrollBy(s, 500, 1400);
  await sleep(1800);
  await click(s, page.locator('.bottom-nav a', { hasText: 'Account' }));
  await noSkeleton(page);
  await sleep(2200);
  await stop(s);
  await s.ctx.close();
};

// ---------- run ----------
const order = ['home', 'college', 'privacy', 'owner', 'admin', 'emergency', 'mobile'];
const want = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--hide-scrollbars', '--force-color-profile=srgb'] });
try {
  for (const k of order) {
    if (want.length && !want.includes(k)) continue;
    mouse = { x: 800, y: 450 };
    await scenes[k](browser);
  }
} finally {
  await browser.close();
}
