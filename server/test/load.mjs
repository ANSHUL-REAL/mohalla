// Concurrency load test for the Mohalla API (no extra npm packages).
//   node test/load.mjs [totalRequests=2000] [workers=20]
// Every search passes a category (or q matching seeded data on page 2) so NO OpenStreetMap lookups are triggered.
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';

const BASE = process.env.API_BASE || 'http://127.0.0.1:5055';
const TOTAL = Number(process.argv[2]) || 2000;
const WORKERS = Number(process.argv[3]) || 20;
const LOG = process.env.SERVER_LOG || new URL('./server.log', import.meta.url);

const REVIEWERS = ['Aarav Gupta', 'Priya Singh', 'Rohit Verma', 'Sneha Rawat', 'Karan Malhotra', 'Neha Joshi', 'Vikas Negi',
  'Ananya Iyer', 'Rahul Bisht', 'Pooja Kapoor', 'Arjun Nair', 'Simran Kaur', 'Aditya Rao', 'Kavya Reddy',
  'Manish Thakur', 'Isha Bhatt', 'Siddharth Jain', 'Ritika Chauhan', 'Deepak Pandey', 'Meera Pillai']
  .map((n) => n.toLowerCase().replace(' ', '.') + '@example.com');
const CATEGORIES = ['restaurants', 'hotels', 'doctors', 'plumbers', 'electricians', 'ac-repair', 'beauty-spa', 'gyms', 'coaching', 'car-repair', 'packers-movers', 'pharmacy'];
const CITIES = ['', 'Dehradun', 'Delhi', 'Mumbai', 'Bengaluru', 'Pune', 'Jaipur'];
const SORTS = ['relevance', 'rating', 'reviews', 'distance', 'newest'];
const QS = ['repair', 'clinic', 'pizza', 'salon', 'ac', 'gym', 'hotel', 'plumber'];
const SUGGEST = ['pl', 'res', 'doc', 'gy', 'sal', 'hot', 'ca'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const t0 = performance.now();
  try {
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, ms: performance.now() - t0, text };
  } catch (err) {
    return { status: 0, ms: performance.now() - t0, text: `${err.message} ${err.cause?.code || err.cause?.message || ''}` };
  }
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;

async function main() {
  const logStart = fs.existsSync(LOG) ? fs.statSync(LOG).size : 0;

  // --- setup: tokens + business ids
  const tokens = [];
  for (const email of REVIEWERS) {
    const r = await call('POST', '/api/auth/login', { body: { email, password: 'password123' } });
    if (r.status === 200) tokens.push(JSON.parse(r.text).token);
  }
  const adminToken = JSON.parse((await call('POST', '/api/auth/login', { body: { email: 'admin@mohalla.test', password: 'admin123' } })).text).token;
  const ids = [];
  for (const c of CATEGORIES) {
    const r = await call('GET', `/api/businesses?category=${c}&limit=50`);
    ids.push(...JSON.parse(r.text).results.map((b) => b.id));
  }
  const statsBefore = JSON.parse((await call('GET', '/api/admin/stats', { token: adminToken })).text);
  console.log(`setup: ${tokens.length} reviewer tokens, ${ids.length} business ids, ${TOTAL} requests, ${WORKERS} workers`);

  // --- request generator (~85% reads, ~15% writes)
  function nextRequest() {
    const r = Math.random();
    if (r < 0.35) {
      const p = new URLSearchParams({ category: pick(CATEGORIES), sort: pick(SORTS) });
      const city = pick(CITIES); if (city) p.set('city', city);
      if (Math.random() < 0.4) { p.set('lat', '30.3165'); p.set('lng', '78.0322'); if (Math.random() < 0.5) p.set('maxKm', '15'); }
      if (Math.random() < 0.2) p.set('openNow', '1');
      if (Math.random() < 0.2) p.set('minRating', '4');
      return ['search', 'GET', `/api/businesses?${p}`];
    }
    if (r < 0.45) return ['search-q', 'GET', `/api/businesses?q=${pick(QS)}&page=2`]; // page 2 → never hits OSM
    if (r < 0.65) return ['detail', 'GET', `/api/businesses/${pick(ids)}`];
    if (r < 0.72) return ['categories', 'GET', '/api/categories'];
    if (r < 0.79) return ['suggest', 'GET', `/api/suggest?q=${pick(SUGGEST)}`];
    if (r < 0.82) return ['cities', 'GET', '/api/cities'];
    if (r < 0.85) return ['stats', 'GET', '/api/stats'];
    if (r < 0.92) return ['review', 'POST', `/api/businesses/${pick(ids)}/reviews`, { rating: 1 + Math.floor(Math.random() * 5), comment: 'load test' }, pick(tokens)];
    if (r < 0.97) return ['enquiry', 'POST', `/api/businesses/${pick(ids)}/enquiries`, { name: 'Load', phone: '9876543210', message: 'load test', hide_phone: Math.random() < 0.5 }, pick(tokens)];
    return ['favorite', 'POST', `/api/favorites/${pick(ids)}`, {}, pick(tokens)];
  }

  const results = [];
  let issued = 0;
  async function worker() {
    while (issued < TOTAL) {
      issued++;
      const [kind, method, path, body, token] = nextRequest();
      const res = await call(method, path, { body, token });
      results.push({ kind, path, ...res });
    }
  }
  const t0 = performance.now();
  await Promise.all(Array.from({ length: WORKERS }, worker));
  const elapsed = (performance.now() - t0) / 1000;

  // --- write burst: 100 simultaneous writes
  const burst = await Promise.all(Array.from({ length: 100 }, (_, i) => {
    const tok = tokens[i % tokens.length];
    return i % 2
      ? call('POST', `/api/businesses/${ids[i % ids.length]}/reviews`, { token: tok, body: { rating: 4, comment: 'burst' } }).then((r) => ({ kind: 'burst-review', ...r }))
      : call('POST', `/api/businesses/${ids[i % ids.length]}/enquiries`, { token: tok, body: { name: 'Burst', phone: '9876543210', message: 'burst' } }).then((r) => ({ kind: 'burst-enquiry', ...r }));
  }));

  // --- report
  const report = (rows, label) => {
    const lat = rows.map((r) => r.ms).sort((a, b) => a - b);
    const err = rows.filter((r) => r.status === 0 || r.status >= 400).length;
    const e5 = rows.filter((r) => r.status >= 500).length;
    return `${label.padEnd(14)} n=${String(rows.length).padStart(5)}  p50=${pct(lat, 50).toFixed(1).padStart(7)}ms  p95=${pct(lat, 95).toFixed(1).padStart(7)}ms  p99=${pct(lat, 99).toFixed(1).padStart(7)}ms  max=${lat.at(-1).toFixed(1).padStart(7)}ms  errors=${err} 5xx=${e5}`;
  };
  console.log(`\n=== mixed load: ${results.length} requests in ${elapsed.toFixed(2)}s → ${(results.length / elapsed).toFixed(1)} req/s ===`);
  console.log(report(results, 'ALL'));
  for (const k of [...new Set(results.map((r) => r.kind))].sort()) console.log(report(results.filter((r) => r.kind === k), k));
  console.log(report(burst, '\nwrite burst'));

  const statusCounts = {};
  for (const r of [...results, ...burst]) statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  console.log('\nstatus codes:', JSON.stringify(statusCounts));
  const bad = [...results, ...burst].filter((r) => r.status === 0 || r.status >= 500);
  for (const b of bad.slice(0, 10)) console.log(`  FAIL ${b.status} ${b.kind} ${b.path || ''} ${b.text.slice(0, 120)}`);

  // --- consistency: every 201 enquiry must be stored exactly once
  const enqOk = [...results, ...burst].filter((r) => (r.kind === 'enquiry' || r.kind === 'burst-enquiry') && r.status === 201).length;
  const statsAfter = JSON.parse((await call('GET', '/api/admin/stats', { token: adminToken })).text);
  console.log(`\nenquiries: +${statsAfter.enquiries - statsBefore.enquiries} stored vs ${enqOk} accepted → ${statsAfter.enquiries - statsBefore.enquiries === enqOk ? 'consistent' : 'MISMATCH'}`);

  // --- health after load
  const h = await call('GET', '/api/stats');
  const s = await call('GET', '/api/businesses?category=restaurants');
  console.log(`health after load: /api/stats ${h.status} (${h.ms.toFixed(1)}ms), search ${s.status} (${s.ms.toFixed(1)}ms)`);

  // --- server log scan
  if (fs.existsSync(LOG)) {
    const log = fs.readFileSync(LOG, 'utf8').slice(logStart);
    const busy = (log.match(/SQLITE_BUSY|database is locked/gi) || []).length;
    const errs = (log.match(/^\w*Error.*$/gm) || []);
    console.log(`server log during run: ${busy} SQLITE_BUSY/locked, ${errs.length} error lines${errs.length ? ' e.g. ' + errs[0] : ''}`);
  }
  if (bad.length) process.exitCode = 1;
}

main();
