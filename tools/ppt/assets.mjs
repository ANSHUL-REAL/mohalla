// Makes the slide assets: icon PNGs (Lucide icons, same set as the app), the logo PNG and grid backgrounds.
// Run: node assets.mjs   (needs Chrome; uses the app's own react / lucide-react packages)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const require = createRequire(new URL('../../client/package.json', import.meta.url));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const lucide = require('lucide-react');

const OUT = new URL('./assets/', import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

// name -> lucide icon; every icon is drawn in ink black and in white
const ICONS = {
  search: 'Search', sparkles: 'Sparkles', mapPin: 'MapPin', shield: 'ShieldCheck', lock: 'Lock', radio: 'Radio',
  siren: 'Siren', phone: 'Phone', star: 'Star', store: 'Store', smartphone: 'Smartphone', database: 'Database',
  server: 'Server', globe: 'Globe', users: 'Users', clock: 'Clock', messages: 'MessagesSquare', phoneOff: 'PhoneOff',
  map: 'Map', layout: 'LayoutDashboard', check: 'Check', x: 'X', zap: 'Zap', flask: 'FlaskConical', gauge: 'Gauge',
  rocket: 'Rocket', mic: 'Mic', creditCard: 'CreditCard', bell: 'Bell', languages: 'Languages', alert: 'TriangleAlert',
  heart: 'Heart', badge: 'BadgeCheck', image: 'Image', code: 'Code',
};

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 256, height: 256 } });

async function svgToPng(svg, file, size = 256) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator('svg').first().screenshot({ path: new URL(file, OUT).pathname.replace(/^\/(\w:)/, '$1').replace(/%20/g, ' '), omitBackground: true });
}

for (const [name, comp] of Object.entries(ICONS)) {
  if (!lucide[comp]) throw new Error('Missing icon ' + comp);
  for (const [suffix, color] of [['', '#111111'], ['-w', '#ffffff']]) {
    const svg = renderToStaticMarkup(React.createElement(lucide[comp], { size: 256, color, strokeWidth: 2.2 }));
    await svgToPng(svg, `${name}${suffix}.png`);
  }
}

// Logo: the app's own SVG at 512 px
const logo = fs.readFileSync(new URL('../../client/public/logo.svg', import.meta.url), 'utf8')
  .replace('<svg ', '<svg width="512" height="512" ');
await svgToPng(logo, 'logo.png', 512);

await browser.close();
console.log('assets done');
