// Takes the app screenshots used in the presentation (tools/ppt/shots/*.png).
// Needs the server running at http://127.0.0.1:5000. Run: node shots.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'http://127.0.0.1:5000';
const OUT = new URL('./shots/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

async function token(email, password) {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  return (await res.json()).token;
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });

const only = process.argv.slice(2); // optional: node shots.mjs smart-ask emergency

async function shoot(name, path, { mobile = false, login, wait = 2500, scroll = 0, setup, geo } = {}) {
  if (only.length && !only.includes(name)) return;
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
  if (geo) { await ctx.grantPermissions(['geolocation']); await ctx.setGeolocation(geo); }
  const t = login ? await token(...login) : null;
  await ctx.addInitScript((tok) => {
    sessionStorage.setItem('lk_loc_prompt', '1'); // skip the location popup
    if (tok) localStorage.setItem('lk_token', tok);
  }, t);
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  if (setup) await setup(page);
  if (scroll) await page.evaluate((y) => window.scrollTo(0, y), scroll);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: fileURLToPath(new URL(name + '.png', OUT)) });
  await ctx.close();
  console.log('saved', name);
}

const owner = ['owner@mohalla.test', 'owner123'];
const admin = ['admin@mohalla.test', 'admin123'];

await shoot('home', '/');
await shoot('home-sections', '/', { scroll: 760 });
await shoot('smart-ask', '/search?q=' + encodeURIComponent('my AC is not cooling, need someone urgently'));
await shoot('results', '/search?category=restaurants&city=Dehradun');
await shoot('detail', '/business/5');
await shoot('detail-reviews', '/business/5', { scroll: 700 });
await shoot('fsb', '/search?q=fsb%20degree%20college');
await shoot('emergency', '/emergency', { geo: { latitude: 30.3165, longitude: 78.0322 }, wait: 9000 });
await shoot('dashboard', '/dashboard', { login: owner });
await shoot('admin', '/admin', { login: admin });
await shoot('m-home', '/', { mobile: true });
await shoot('m-search', '/search?q=dentist&city=Dehradun', { mobile: true });
await shoot('m-detail', '/business/5', { mobile: true });

await browser.close();
