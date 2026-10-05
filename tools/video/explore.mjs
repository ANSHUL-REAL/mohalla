// Quick exploration helper (not part of the pipeline): screenshots a route of the running app.
// Quick exploration helper: node explore.mjs <path> [out.png]
import { chromium } from 'playwright-core';
const [, , path = '/', out = 'shot.png'] = process.argv;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1,
  permissions: ['geolocation'], geolocation: { latitude: 30.3165, longitude: 78.0322 },
});
const page = await ctx.newPage();
const t0 = Date.now();
await page.goto('http://127.0.0.1:5000' + path, { waitUntil: 'networkidle' });
console.log('loaded', Date.now() - t0);
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
if (process.env.LOC) {
  const t1 = Date.now();
  await page.getByRole('button', { name: 'Turn on location' }).click();
  await page.locator('.location-modal').waitFor({ state: 'detached', timeout: 60000 }).catch(e => console.log('timeout'));
  console.log('location took', Date.now() - t1);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'loc_' + out });
  await page.screenshot({ path: 'full_' + out, fullPage: true });
}
await browser.close();
