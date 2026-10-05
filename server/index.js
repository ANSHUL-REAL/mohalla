// Mohalla API server — Express + SQLite
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { db, transaction, CITY_COORDS } from './db.js';
import { ensureCategories, seedIfEmpty } from './seed.js';
import { searchByName, syncNearby } from './osm.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;
// Login tokens are signed with JWT_SECRET. Without one, a random secret is created once and kept in .jwt-secret
const SECRET_FILE = path.join(__dirname, '.jwt-secret');
const JWT_SECRET = process.env.JWT_SECRET || (() => {
  if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(48).toString('hex'));
  return fs.readFileSync(SECRET_FILE, 'utf8').trim();
})();
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
seedIfEmpty();
ensureCategories();

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  // Requests without a JSON body: treat as empty instead of crashing on req.body.x
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) req.body = {};
  // "?q=a&q=b" arrives as an array; keep the first value so search code always gets strings
  const query = {};
  for (const [k, v] of Object.entries(req.query)) {
    const first = Array.isArray(v) ? v[0] : v;
    if (typeof first === 'string') query[k] = first;
  }
  Object.defineProperty(req, 'query', { value: query, writable: true, configurable: true });
  next();
});
// Uploaded files are only ever served as images, never run as pages or scripts
app.use('/uploads', (req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
  next();
}, express.static(UPLOAD_DIR));

// ---------------------------------------------------------------- helpers

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// true / false, or null when the opening hours are not known
function isOpenNow(hours, now = new Date()) {
  if (!hours || hours.unknown) return null;
  if (hours.closed?.includes(DAYS[now.getDay()])) return false;
  const hhmm = now.toTimeString().slice(0, 5);
  return hours.open <= hhmm && hhmm <= hours.close;
}

// Distance in km between two lat/lng points
function distanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const BIZ_SELECT = `
  SELECT b.*, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon, c.color AS category_color,
         c.keywords AS category_keywords,
         ROUND(COALESCE((SELECT AVG(rating) FROM reviews r WHERE r.business_id = b.id), 0), 1) AS rating,
         (SELECT COUNT(*) FROM reviews r WHERE r.business_id = b.id) AS review_count,
         (SELECT COUNT(*) FROM reviews r WHERE r.business_id = b.id AND r.created_at > datetime('now', '-45 days')) AS recent_reviews
  FROM businesses b JOIN categories c ON c.id = b.category_id`;

// Turn a DB row into the JSON shape the frontend uses
function formatBiz(row) {
  const hours = JSON.parse(row.hours);
  const { category_keywords, ...rest } = row;
  return {
    ...rest,
    hours,
    services: JSON.parse(row.services),
    photos: JSON.parse(row.photos),
    is_approved: !!row.is_approved,
    is_featured: !!row.is_featured,
    is_verified: !!row.is_verified,
    open_now: isOpenNow(hours),
    // Live status set by the owner — only trusted for 12 hours
    live_status: row.live_status && Date.now() - new Date(row.live_status_at.replace(' ', 'T') + 'Z') < 12 * 3600 * 1000 ? row.live_status : null,
    // JustDial-style badges
    badges: {
      topSearch: row.views >= 1500,
      trending: row.recent_reviews >= 2,
      quickResponse: row.owner_id != null,
      years: row.established ? new Date().getFullYear() - row.established : null,
    },
  };
}

function getBiz(id) {
  const row = db.prepare(`${BIZ_SELECT} WHERE b.id = ?`).get(id);
  return row ? formatBiz(row) : null;
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

// auth(true) = login required, auth(false) = optional
function auth(required = true) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(header.slice(7), JWT_SECRET);
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
        if (user) req.user = publicUser(user);
      } catch { /* invalid token → treated as logged out */ }
    }
    if (required && !req.user) return res.status(401).json({ error: 'Please log in first.' });
    next();
  };
}

const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'You are not allowed to do this.' });

const canEdit = (user, biz) => !!user && (user.role === 'admin' || biz.owner_id === user.id);

const clean = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : undefined);

// A phone number needs 10-13 digits; spaces, dashes and a leading + are allowed
const validPhone = (p) => typeof p === 'string' && /^\+?[\d\s-]+$/.test(p) && /^\d{10,13}$/.test(p.replace(/\D/g, ''));

// ---------------------------------------------------------------- auth

app.post('/api/auth/register', (req, res) => {
  const name = clean(req.body.name), email = clean(req.body.email)?.toLowerCase(), phone = clean(req.body.phone);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = req.body.role === 'business' ? 'business' : 'user';
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required.' });
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'An account with this email already exists.' });

  const info = db.prepare('INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, bcrypt.hashSync(password, 10), phone || null, role);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const email = clean(req.body.email)?.toLowerCase();
  const user = email && db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(typeof req.body.password === 'string' ? req.body.password : '', user.password)) {
    return res.status(401).json({ error: 'Wrong email or password.' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/auth/me', auth(), (req, res) => res.json({ user: req.user }));

// ---------------------------------------------------------------- categories & cities

app.get('/api/categories', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, (SELECT COUNT(*) FROM businesses b WHERE b.category_id = c.id AND b.is_approved = 1) AS count
    FROM categories c ORDER BY c.id`).all();
  res.json(rows);
});

app.get('/api/cities', (req, res) => {
  const rows = db.prepare('SELECT city AS name, COUNT(*) AS count FROM businesses WHERE is_approved = 1 GROUP BY city ORDER BY count DESC').all();
  res.json(rows.map((r) => ({ ...r, coords: CITY_COORDS[r.name] || null })));
});

// ---------------------------------------------------------------- search

const STOP_WORDS = new Set(['in', 'near', 'me', 'the', 'a', 'an', 'at', 'for', 'and', 'of', 'best', 'top', 'good', 'around', 'nearby']);

// Normalise a word: lowercase, drop plural "s" so "plumbers" matches "plumber"
const norm = (w) => {
  w = w.toLowerCase().replace(/[^a-z0-9]/g, '');
  return w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w;
};
const words = (text) => (text || '').split(/[\s,&/().-]+/).map(norm).filter(Boolean);

function relevance(biz, terms) {
  const fields = [
    [words(biz.name), 5],
    [words(biz.category_name + ' ' + biz.category_keywords), 4],
    [words(biz.services), 3],
    [words(biz.area + ' ' + biz.city), 2],
    [words(biz.description), 1],
  ];
  let score = 0;
  for (const term of terms) {
    let best = 0;
    for (const [list, weight] of fields) {
      if (list.some((w) => w === term)) best = Math.max(best, weight * 2);
      else if (term.length >= 3 && list.some((w) => w.startsWith(term))) best = Math.max(best, weight);
    }
    if (best === 0) return 0; // every search word must match something
    score += best;
  }
  return score;
}

// Shared search used by the results page and the "get best quotes" form
function searchBusinesses(query) {
  const { q = '', city = '', category = '', minRating = '', openNow = '', verified = '', featured = '', quick = '', sort = 'relevance' } = query;
  const lat = parseFloat(query.lat), lng = parseFloat(query.lng);

  const where = ['b.is_approved = 1'];
  const params = [];
  if (city) { where.push('LOWER(b.city) = LOWER(?)'); params.push(city); }
  if (category) { where.push('c.slug = ?'); params.push(category); }
  if (featured === '1') where.push('b.is_featured = 1');
  if (verified === '1') where.push('b.is_verified = 1');
  if (quick === '1') where.push('b.owner_id IS NOT NULL');

  let list = db.prepare(`${BIZ_SELECT} WHERE ${where.join(' AND ')}`).all(...params);

  const terms = words(q).filter((t) => !STOP_WORDS.has(t));
  if (terms.length) {
    list = list.map((b) => ({ ...b, _score: relevance(b, terms) })).filter((b) => b._score > 0);
  }

  list = list.map(formatBiz);
  if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
    list.forEach((b) => { if (b.lat != null) b.distance = +distanceKm(lat, lng, b.lat, b.lng).toFixed(2); });
  }
  if (minRating) list = list.filter((b) => b.rating >= Number(minRating));
  if (openNow === '1') list = list.filter((b) => b.open_now === true && b.live_status !== 'closed_today');
  const maxKm = parseFloat(query.maxKm);
  if (!Number.isNaN(maxKm) && list.some((b) => b.distance != null)) list = list.filter((b) => b.distance != null && b.distance <= maxKm);

  const sorters = {
    rating: (a, b) => b.rating - a.rating || b.review_count - a.review_count,
    reviews: (a, b) => b.review_count - a.review_count,
    newest: (a, b) => b.created_at.localeCompare(a.created_at),
    distance: (a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9),
    relevance: (a, b) => (b._score || 0) - (a._score || 0) || b.is_featured - a.is_featured || b.rating - a.rating,
  };
  list.sort(Object.hasOwn(sorters, sort) ? sorters[sort] : sorters.relevance);
  return list.map(({ _score, ...b }) => b);
}

app.get('/api/businesses', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 12));
  let list = searchBusinesses(req.query);

  // Searching a name we don't have (e.g. a college)? Look it up live on OpenStreetMap and save it.
  const q = (req.query.q || '').trim();
  if (q.length >= 3 && page === 1 && list.length < 3 && !req.query.category) {
    try {
      const found = await searchByName(q, req.query);
      if (found) list = searchBusinesses(req.query);
    } catch (err) {
      console.error('Name search failed:', err.message);
    }
  }
  res.json({ results: list.slice((page - 1) * limit, page * limit), total: list.length, page, pages: Math.ceil(list.length / limit) });
});

// "Get the list of top plumbers" — one form sends the requirement to the best 5 matching businesses
app.post('/api/leads', auth(false), (req, res) => {
  const name = clean(req.body.name), phone = clean(req.body.phone);
  const need = clean(req.body.need) || 'Looking for your services';
  if (!name || !phone) return res.status(400).json({ error: 'Please enter your name and mobile number.' });
  if (!validPhone(phone)) return res.status(400).json({ error: 'Please enter a valid phone number.' });

  const { lat, lng, maxKm } = req.body;
  const q = clean(req.body.q) || '', city = clean(req.body.city) || '', category = clean(req.body.category) || '';
  const top = searchBusinesses({ q, city, category, lat, lng, maxKm, sort: 'rating' })
    .filter((b) => b.phone)
    .slice(0, 5);
  if (!top.length) return res.status(404).json({ error: 'No businesses with phone numbers found for this search yet.' });

  const hidePhone = !!req.body.hide_phone;
  if (hidePhone && !req.user) return res.status(401).json({ error: 'Log in to use Privacy Mode, so replies can reach you in the app.' });
  const add = db.prepare('INSERT INTO enquiries (user_id, business_id, name, phone, message, hide_phone) VALUES (?, ?, ?, ?, ?, ?)');
  transaction(() => top.forEach((b) => add.run(req.user?.id ?? null, b.id, name, phone, need.slice(0, 1000), hidePhone ? 1 : 0)));
  res.status(201).json({ sentTo: top.map((b) => ({ id: b.id, name: b.name, phone: b.phone, rating: b.rating, area: b.area, city: b.city })) });
});

// Real businesses near the user, downloaded from OpenStreetMap and saved as listings
app.post('/api/nearby', async (req, res) => {
  const lat = Number(req.body.lat), lng = Number(req.body.lng);
  const radius = Math.min(5000, Math.max(500, Number(req.body.radius) || 2000));
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180) || (lat === 0 && lng === 0)) {
    return res.status(400).json({ error: 'A valid location is required.' });
  }
  try {
    res.json(await syncNearby(lat, lng, radius));
  } catch (err) {
    console.error('Nearby sync failed:', err.message);
    res.status(502).json({ error: err.message });
  }
});

// Business owners can claim a real (OpenStreetMap) listing that has no owner yet
app.post('/api/businesses/:id/claim', auth(), allow('business', 'admin'), (req, res) => {
  const biz = getBiz(req.params.id);
  if (!biz) return res.status(404).json({ error: 'Business not found.' });
  if (biz.owner_id) return res.status(409).json({ error: 'This business has already been claimed.' });
  db.prepare('UPDATE businesses SET owner_id = ? WHERE id = ?').run(req.user.id, biz.id);
  res.json(getBiz(biz.id));
});

// Search-box suggestions: matching categories + business names
app.get('/api/suggest', (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (q.length < 2) return res.json([]);
  const like = `%${q}%`;
  const cats = db.prepare('SELECT name, slug FROM categories WHERE LOWER(name) LIKE ? OR LOWER(keywords) LIKE ? LIMIT 4').all(like, like)
    .map((c) => ({ type: 'category', label: c.name, slug: c.slug }));
  const biz = db.prepare('SELECT id, name, area, city FROM businesses WHERE is_approved = 1 AND LOWER(name) LIKE ? LIMIT 6').all(like)
    .map((b) => ({ type: 'business', label: b.name, sub: `${b.area}, ${b.city}`, id: b.id }));
  res.json([...cats, ...biz]);
});

app.get('/api/stats', (req, res) => {
  res.json({
    businesses: db.prepare('SELECT COUNT(*) AS n FROM businesses WHERE is_approved = 1').get().n,
    reviews: db.prepare('SELECT COUNT(*) AS n FROM reviews').get().n,
    users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    cities: db.prepare('SELECT COUNT(DISTINCT city) AS n FROM businesses WHERE is_approved = 1').get().n,
  });
});

// ---------------------------------------------------------------- business detail & CRUD

app.get('/api/businesses/:id', auth(false), (req, res) => {
  const biz = getBiz(req.params.id);
  if (!biz || (!biz.is_approved && !canEdit(req.user, biz))) return res.status(404).json({ error: 'Business not found.' });

  db.prepare('UPDATE businesses SET views = views + 1 WHERE id = ?').run(biz.id);
  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.comment, r.created_at, r.user_id, u.name AS user_name
    FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.business_id = ? ORDER BY r.created_at DESC`).all(biz.id);
  const breakdown = [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((r) => r.rating === star).length }));
  const isFavorite = req.user
    ? !!db.prepare('SELECT 1 FROM favorites WHERE user_id = ? AND business_id = ?').get(req.user.id, biz.id)
    : false;
  const similar = db.prepare(`${BIZ_SELECT} WHERE b.is_approved = 1 AND b.category_id = ? AND b.city = ? AND b.id != ? LIMIT 4`)
    .all(biz.category_id, biz.city, biz.id).map(formatBiz);

  res.json({ ...biz, reviews, breakdown, isFavorite, canEdit: canEdit(req.user, biz), similar });
});

function readBizBody(body) {
  const b = {
    name: clean(body.name), category_id: Number(body.category_id), description: clean(body.description) || '',
    phone: clean(body.phone), whatsapp: clean(body.whatsapp) || clean(body.phone), email: clean(body.email) || null,
    website: clean(body.website) || null, address: clean(body.address), area: clean(body.area) || '',
    city: clean(body.city), established: body.established ? Number(body.established) : null,
    lat: body.lat === '' || body.lat == null ? null : Number(body.lat),
    lng: body.lng === '' || body.lng == null ? null : Number(body.lng),
    hours: JSON.stringify({
      open: body.hours?.open || '09:00', close: body.hours?.close || '21:00',
      closed: Array.isArray(body.hours?.closed) ? body.hours.closed.filter((d) => DAYS.includes(d)) : [],
    }),
    services: JSON.stringify(Array.isArray(body.services) ? body.services.map(clean).filter(Boolean).map((x) => x.slice(0, 60)).slice(0, 20) : []),
  };
  if (!b.name || !b.category_id || !b.phone || !b.address || !b.city) {
    return { error: 'Name, category, phone, address and city are required.' };
  }
  if (!validPhone(b.phone)) return { error: 'Please enter a valid phone number (10-13 digits).' };
  if (b.website && !/^https?:\/\//i.test(b.website)) b.website = 'https://' + b.website.replace(/^[a-z]+:\/*/i, '');
  if (!db.prepare('SELECT id FROM categories WHERE id = ?').get(b.category_id)) return { error: 'Invalid category.' };
  if (b.lat == null || b.lng == null || Number.isNaN(b.lat) || Number.isNaN(b.lng)) {
    const c = CITY_COORDS[b.city];
    [b.lat, b.lng] = c || [null, null];
  }
  return { data: b };
}

app.post('/api/businesses', auth(), allow('business', 'admin'), (req, res) => {
  const { error, data } = readBizBody(req.body);
  if (error) return res.status(400).json({ error });
  const approved = req.user.role === 'admin' ? 1 : 0; // business listings wait for admin approval
  const info = db.prepare(`INSERT INTO businesses
    (owner_id, category_id, name, description, phone, whatsapp, email, website, address, area, city, lat, lng, hours, services, established, is_approved)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    req.user.id, data.category_id, data.name, data.description, data.phone, data.whatsapp, data.email, data.website,
    data.address, data.area, data.city, data.lat, data.lng, data.hours, data.services, data.established, approved,
  );
  res.status(201).json(getBiz(info.lastInsertRowid));
});

app.put('/api/businesses/:id', auth(), (req, res) => {
  const biz = getBiz(req.params.id);
  if (!biz) return res.status(404).json({ error: 'Business not found.' });
  if (!canEdit(req.user, biz)) return res.status(403).json({ error: 'You can only edit your own listing.' });
  const { error, data } = readBizBody(req.body);
  if (error) return res.status(400).json({ error });
  db.prepare(`UPDATE businesses SET category_id=?, name=?, description=?, phone=?, whatsapp=?, email=?, website=?, address=?,
      area=?, city=?, lat=?, lng=?, hours=?, services=?, established=? WHERE id=?`).run(
    data.category_id, data.name, data.description, data.phone, data.whatsapp, data.email, data.website, data.address,
    data.area, data.city, data.lat, data.lng, data.hours, data.services, data.established, biz.id,
  );
  res.json(getBiz(biz.id));
});

app.delete('/api/businesses/:id', auth(), (req, res) => {
  const biz = getBiz(req.params.id);
  if (!biz) return res.status(404).json({ error: 'Business not found.' });
  if (!canEdit(req.user, biz)) return res.status(403).json({ error: 'You can only delete your own listing.' });
  db.prepare('DELETE FROM businesses WHERE id = ?').run(biz.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- photos

const IMAGE_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + IMAGE_TYPES[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) =>
    Object.hasOwn(IMAGE_TYPES, file.mimetype) ? cb(null, true) : cb(new Error('Only JPG, PNG, WEBP or GIF images are allowed.')),
});

// Checks the file really starts like an image (the browser-sent type can be faked)
function looksLikeImage(file) {
  const head = Buffer.alloc(12);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, head, 0, 12, 0); } finally { fs.closeSync(fd); }
  return head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) // JPG
    || head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) // PNG
    || head.toString('latin1', 0, 4) === 'GIF8'
    || (head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP');
}

app.post('/api/businesses/:id/photos', auth(), upload.array('photos', 6), (req, res) => {
  const biz = getBiz(req.params.id);
  const files = req.files || [];
  const remove = (list) => list.forEach((f) => fs.rmSync(f.path, { force: true }));
  if (!biz || !canEdit(req.user, biz)) {
    remove(files);
    return res.status(biz ? 403 : 404).json({ error: biz ? 'Not allowed.' : 'Business not found.' });
  }
  if (files.some((f) => !looksLikeImage(f.path))) {
    remove(files);
    return res.status(400).json({ error: 'That file is not a real image.' });
  }
  const room = Math.max(0, 12 - biz.photos.length);
  remove(files.slice(room)); // a listing keeps at most 12 photos
  const photos = [...biz.photos, ...files.slice(0, room).map((f) => `/uploads/${f.filename}`)];
  db.prepare('UPDATE businesses SET photos = ? WHERE id = ?').run(JSON.stringify(photos), biz.id);
  res.json({ photos });
});

app.delete('/api/businesses/:id/photos', auth(), (req, res) => {
  const biz = getBiz(req.params.id);
  if (!biz || !canEdit(req.user, biz)) return res.status(403).json({ error: 'Not allowed.' });
  const url = req.query.url;
  if (!biz.photos.includes(url)) return res.status(404).json({ error: 'Photo not found.' });
  const photos = biz.photos.filter((p) => p !== url);
  db.prepare('UPDATE businesses SET photos = ? WHERE id = ?').run(JSON.stringify(photos), biz.id);
  fs.rmSync(path.join(UPLOAD_DIR, path.basename(url)), { force: true });
  res.json({ photos });
});

// ---------------------------------------------------------------- reviews

app.post('/api/businesses/:id/reviews', auth(), (req, res) => {
  const biz = getBiz(req.params.id);
  if (!biz || !biz.is_approved) return res.status(404).json({ error: 'Business not found.' });
  if (biz.owner_id === req.user.id) return res.status(400).json({ error: 'You cannot review your own business.' });
  const rating = Number(req.body.rating);
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Please choose a rating from 1 to 5 stars.' });
  const comment = clean(req.body.comment || '').slice(0, 1000);
  // One review per user per business — posting again updates it
  db.prepare(`INSERT INTO reviews (user_id, business_id, rating, comment) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, business_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, created_at = datetime('now')`)
    .run(req.user.id, biz.id, Math.round(rating), comment);
  res.status(201).json({ ok: true });
});

app.delete('/api/reviews/:id', auth(), (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found.' });
  if (review.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not allowed.' });
  db.prepare('DELETE FROM reviews WHERE id = ?').run(review.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- enquiries ("Get best price")

app.post('/api/businesses/:id/enquiries', auth(false), (req, res) => {
  const biz = getBiz(req.params.id);
  if (!biz || !biz.is_approved) return res.status(404).json({ error: 'Business not found.' });
  const name = clean(req.body.name), phone = clean(req.body.phone), message = clean(req.body.message);
  const hidePhone = !!req.body.hide_phone;
  if (!name || !phone || !message) return res.status(400).json({ error: 'Name, phone and message are required.' });
  if (!validPhone(phone)) return res.status(400).json({ error: 'Please enter a valid phone number.' });
  if (hidePhone && !req.user) return res.status(401).json({ error: 'Log in to use Privacy Mode, so replies can reach you in the app.' });
  db.prepare('INSERT INTO enquiries (user_id, business_id, name, phone, message, hide_phone) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user?.id ?? null, biz.id, name, phone, message.slice(0, 1000), hidePhone ? 1 : 0);
  res.status(201).json({ ok: true });
});

// ---------------------------------------------------------------- favourites

app.get('/api/favorites', auth(), (req, res) => {
  const rows = db.prepare(`${BIZ_SELECT} JOIN favorites f ON f.business_id = b.id WHERE f.user_id = ? AND b.is_approved = 1 ORDER BY f.created_at DESC`)
    .all(req.user.id);
  res.json(rows.map(formatBiz));
});

app.post('/api/favorites/:id', auth(), (req, res) => {
  if (!getBiz(req.params.id)) return res.status(404).json({ error: 'Business not found.' });
  db.prepare('INSERT OR IGNORE INTO favorites (user_id, business_id) VALUES (?, ?)').run(req.user.id, Number(req.params.id));
  res.json({ isFavorite: true });
});

app.delete('/api/favorites/:id', auth(), (req, res) => {
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND business_id = ?').run(req.user.id, Number(req.params.id));
  res.json({ isFavorite: false });
});

// ---------------------------------------------------------------- "my" pages

app.get('/api/my/reviews', auth(), (req, res) => {
  res.json(db.prepare(`SELECT r.*, b.name AS business_name FROM reviews r JOIN businesses b ON b.id = r.business_id
    WHERE r.user_id = ? ORDER BY r.created_at DESC`).all(req.user.id));
});

app.get('/api/my/businesses', auth(), allow('business', 'admin'), (req, res) => {
  const rows = db.prepare(`${BIZ_SELECT} WHERE b.owner_id = ? ORDER BY b.created_at DESC`).all(req.user.id).map(formatBiz);
  rows.forEach((b) => {
    b.enquiry_count = db.prepare("SELECT COUNT(*) AS n FROM enquiries WHERE business_id = ? AND status = 'new'").get(b.id).n;
  });
  res.json(rows);
});

// Hides the customer's number when they chose Privacy Mode: "xxxxxxxx10"
function maskPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  return `xxxxxxxx${digits.slice(-2)}`;
}

app.get('/api/my/enquiries', auth(), allow('business', 'admin'), (req, res) => {
  const rows = db.prepare(`SELECT e.*, b.name AS business_name,
      (SELECT COUNT(*) FROM enquiry_messages m WHERE m.enquiry_id = e.id) AS message_count
    FROM enquiries e JOIN businesses b ON b.id = e.business_id
    WHERE b.owner_id = ? ORDER BY e.created_at DESC`).all(req.user.id);
  res.json(rows.map((e) => (e.hide_phone ? { ...e, phone: maskPhone(e.phone), phone_hidden: true } : e)));
});

// Enquiries the logged-in customer has sent, with reply counts
app.get('/api/my/sent-enquiries', auth(), (req, res) => {
  res.json(db.prepare(`SELECT e.id, e.message, e.status, e.hide_phone, e.created_at, e.business_id, b.name AS business_name,
      (SELECT COUNT(*) FROM enquiry_messages m WHERE m.enquiry_id = e.id AND m.sender = 'business') AS reply_count
    FROM enquiries e JOIN businesses b ON b.id = e.business_id
    WHERE e.user_id = ? ORDER BY e.created_at DESC`).all(req.user.id));
});

// In-app chat on an enquiry (only the customer and the business owner can see it)
function enquiryForUser(id, user) {
  const e = db.prepare(`SELECT e.*, b.owner_id, b.name AS business_name FROM enquiries e
    JOIN businesses b ON b.id = e.business_id WHERE e.id = ?`).get(id);
  if (!e) return { error: [404, 'Enquiry not found.'] };
  const role = e.user_id === user.id ? 'customer' : e.owner_id === user.id || user.role === 'admin' ? 'business' : null;
  if (!role) return { error: [403, 'Not allowed.'] };
  return { e, role };
}

app.get('/api/enquiries/:id/messages', auth(), (req, res) => {
  const { e, role, error } = enquiryForUser(req.params.id, req.user);
  if (error) return res.status(error[0]).json({ error: error[1] });
  const messages = db.prepare('SELECT id, sender, text, created_at FROM enquiry_messages WHERE enquiry_id = ? ORDER BY id').all(e.id);
  res.json({ role, enquiry: { id: e.id, message: e.message, name: e.name, business_name: e.business_name, created_at: e.created_at }, messages });
});

app.post('/api/enquiries/:id/messages', auth(), (req, res) => {
  const { e, role, error } = enquiryForUser(req.params.id, req.user);
  if (error) return res.status(error[0]).json({ error: error[1] });
  const text = clean(req.body.text || '').slice(0, 1000);
  if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
  db.prepare('INSERT INTO enquiry_messages (enquiry_id, sender, text) VALUES (?, ?, ?)').run(e.id, role, text);
  if (role === 'business' && e.status === 'new') db.prepare("UPDATE enquiries SET status = 'contacted' WHERE id = ?").run(e.id);
  res.status(201).json({ ok: true });
});

// Owner sets a live status: available now / busy / closed today
app.patch('/api/businesses/:id/live-status', auth(), (req, res) => {
  const biz = getBiz(req.params.id);
  if (!biz) return res.status(404).json({ error: 'Business not found.' });
  if (!canEdit(req.user, biz)) return res.status(403).json({ error: 'Only the owner can set live status.' });
  const status = req.body.status || null;
  if (status && !['available', 'busy', 'closed_today'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  db.prepare("UPDATE businesses SET live_status = ?, live_status_at = datetime('now') WHERE id = ?").run(status, biz.id);
  res.json(getBiz(biz.id));
});

app.patch('/api/enquiries/:id', auth(), (req, res) => {
  const enq = db.prepare('SELECT e.*, b.owner_id FROM enquiries e JOIN businesses b ON b.id = e.business_id WHERE e.id = ?').get(req.params.id);
  if (!enq) return res.status(404).json({ error: 'Enquiry not found.' });
  if (enq.owner_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not allowed.' });
  if (!['new', 'contacted', 'closed'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status.' });
  db.prepare('UPDATE enquiries SET status = ? WHERE id = ?').run(req.body.status, enq.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- admin

const admin = [auth(), allow('admin')];

app.get('/api/admin/stats', ...admin, (req, res) => {
  const n = (sql) => db.prepare(sql).get().n;
  res.json({
    users: n('SELECT COUNT(*) AS n FROM users'),
    businesses: n('SELECT COUNT(*) AS n FROM businesses'),
    pending: n('SELECT COUNT(*) AS n FROM businesses WHERE is_approved = 0'),
    reviews: n('SELECT COUNT(*) AS n FROM reviews'),
    enquiries: n('SELECT COUNT(*) AS n FROM enquiries'),
    categories: n('SELECT COUNT(*) AS n FROM categories'),
    byCategory: db.prepare(`SELECT c.name, c.color, COUNT(b.id) AS count FROM categories c
      LEFT JOIN businesses b ON b.category_id = c.id GROUP BY c.id ORDER BY count DESC`).all(),
    byCity: db.prepare('SELECT city AS name, COUNT(*) AS count FROM businesses GROUP BY city ORDER BY count DESC').all(),
  });
});

app.get('/api/admin/businesses', ...admin, (req, res) => {
  const { status = 'all', q = '' } = req.query;
  const where = [], params = [];
  if (status === 'pending') where.push('b.is_approved = 0');
  if (status === 'approved') where.push('b.is_approved = 1');
  if (status === 'featured') where.push('b.is_featured = 1');
  if (q) { where.push('(LOWER(b.name) LIKE ? OR LOWER(b.city) LIKE ?)'); params.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`); }
  const rows = db.prepare(`${BIZ_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY b.is_approved ASC, b.created_at DESC`)
    .all(...params);
  res.json(rows.map(formatBiz));
});

app.patch('/api/admin/businesses/:id', ...admin, (req, res) => {
  const biz = getBiz(req.params.id);
  if (!biz) return res.status(404).json({ error: 'Business not found.' });
  for (const field of ['is_approved', 'is_featured', 'is_verified']) {
    if (field in req.body) db.prepare(`UPDATE businesses SET ${field} = ? WHERE id = ?`).run(req.body[field] ? 1 : 0, biz.id);
  }
  res.json(getBiz(biz.id));
});

app.get('/api/admin/users', ...admin, (req, res) => {
  res.json(db.prepare(`SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
      (SELECT COUNT(*) FROM businesses b WHERE b.owner_id = u.id) AS listings,
      (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id) AS reviews
    FROM users u ORDER BY u.id`).all());
});

app.delete('/api/admin/users/:id', ...admin, (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account.' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/categories', ...admin, (req, res) => {
  const name = clean(req.body.name);
  if (!name) return res.status(400).json({ error: 'Category name is required.' });
  const slug = name.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug) return res.status(400).json({ error: 'Use English letters or numbers in the category name.' });
  if (db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug)) return res.status(409).json({ error: 'Category already exists.' });
  const info = db.prepare('INSERT INTO categories (name, slug, icon, color, keywords) VALUES (?, ?, ?, ?, ?)')
    .run(name, slug, clean(req.body.icon) || 'Store', /^#[0-9a-f]{6}$/i.test(req.body.color) ? req.body.color : '#FFC567', clean(req.body.keywords) || '');
  res.status(201).json(db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid));
});

app.delete('/api/admin/categories/:id', ...admin, (req, res) => {
  const used = db.prepare('SELECT COUNT(*) AS n FROM businesses WHERE category_id = ?').get(req.params.id).n;
  if (used) return res.status(400).json({ error: `This category has ${used} businesses. Move or delete them first.` });
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------------------------------------------------------------- frontend + errors

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));

// Serve the built React app (client/dist) so one server runs everything
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/uploads')) return res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    next();
  });
}

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.startsWith('Only ')) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be under 5 MB.' : err.message });
  }
  const status = err.status || err.statusCode;
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: status === 413 ? 'That request is too large.' : 'Invalid request.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mohalla server running at http://localhost:${PORT}`);
  // Addresses the Android app can use (phone and laptop on the same Wi-Fi or hotspot)
  const lan = Object.entries(os.networkInterfaces())
    .filter(([name]) => !/virtualbox|vmware|vethernet|wsl|loopback/i.test(name))
    .flatMap(([, list]) => list || [])
    .filter((a) => a.family === 'IPv4' && !a.internal && !a.address.startsWith('192.168.56.')) // .56 = VirtualBox
    .map((a) => a.address);
  for (const ip of lan) console.log(`On your phone: http://${ip}:${PORT}`);
});

