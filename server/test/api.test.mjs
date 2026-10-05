// Mohalla API test suite — run against a separate test server:
//   DB_FILE=./test/test.db PORT=5055 node --no-warnings index.js
//   node --test test/api.test.mjs
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

const BASE = process.env.API_BASE || 'http://127.0.0.1:5055';
const RUN = Date.now().toString(36);

async function api(method, path, { token, body, headers = {}, raw, form } = {}) {
  const h = { ...headers };
  let payload;
  if (form) payload = form;
  else if (raw !== undefined) payload = raw;
  else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  if (token) h.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers: h, body: payload });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, body: json, text, headers: res.headers };
}
const get = (p, o) => api('GET', p, o);
const post = (p, body, o = {}) => api('POST', p, { ...o, body });
const put = (p, body, o = {}) => api('PUT', p, { ...o, body });
const patch = (p, body, o = {}) => api('PATCH', p, { ...o, body });
const del = (p, o) => api('DELETE', p, o);

async function login(email, password) {
  const r = await post('/api/auth/login', { email, password });
  assert.equal(r.status, 200, `login ${email}: ${r.text}`);
  return r.body;
}

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
function fileForm(buf, type, filename) {
  const f = new FormData();
  f.append('photos', new Blob([buf], { type }), filename);
  return f;
}

const T = {}; // tokens
const U = {}; // users
let ownerBiz;      // approved Dehradun listing owned by owner@mohalla.test
let otherBiz;      // approved listing NOT owned by the owner (unowned)

before(async () => {
  for (const [k, e, p] of [
    ['admin', 'admin@mohalla.test', 'admin123'],
    ['owner', 'owner@mohalla.test', 'owner123'],
    ['user', 'user@mohalla.test', 'user123'],
    ['aarav', 'aarav.gupta@example.com', 'password123'],
  ]) { const r = await login(e, p); T[k] = r.token; U[k] = r.user; }
  const r = await post('/api/auth/register', { name: 'Second Owner', email: `owner2.${RUN}@test.dev`, password: 'secret12', role: 'business' });
  assert.equal(r.status, 201);
  T.owner2 = r.body.token; U.owner2 = r.body.user;

  const mine = await get('/api/my/businesses', { token: T.owner });
  ownerBiz = mine.body.find((b) => b.is_approved);
  assert.ok(ownerBiz, 'owner should have an approved listing');
  const delhi = await get('/api/businesses?city=Delhi&category=restaurants');
  otherBiz = delhi.body.results.find((b) => b.owner_id == null);
  assert.ok(otherBiz, 'need an unowned approved business');
});

// ------------------------------------------------------------------ auth
describe('auth', () => {
  const email = `new.${RUN}@test.dev`;
  it('registers a valid user (201, token, role user, no password hash)', async () => {
    const r = await post('/api/auth/register', { name: 'New User', email, password: 'abcdef', phone: '9999999999' });
    assert.equal(r.status, 201);
    assert.ok(r.body.token);
    assert.equal(r.body.user.role, 'user');
    assert.equal(r.body.user.password, undefined);
  });
  it('rejects duplicate email (409), case-insensitively', async () => {
    const r = await post('/api/auth/register', { name: 'Dup', email: email.toUpperCase(), password: 'abcdef' });
    assert.equal(r.status, 409);
  });
  it('rejects bad email (400)', async () => {
    for (const bad of ['notanemail', 'a@b', 'a b@c.com', '@x.com']) {
      const r = await post('/api/auth/register', { name: 'X', email: bad, password: 'abcdef' });
      assert.equal(r.status, 400, bad);
    }
  });
  it('rejects short password (400)', async () => {
    const r = await post('/api/auth/register', { name: 'X', email: `short.${RUN}@t.dev`, password: '12345' });
    assert.equal(r.status, 400);
  });
  it('rejects missing fields (400)', async () => {
    for (const body of [{}, { email: `m1.${RUN}@t.dev`, password: 'abcdef' }, { name: 'X', password: 'abcdef' }, { name: 'X', email: `m2.${RUN}@t.dev` }, { name: '   ', email: `m3.${RUN}@t.dev`, password: 'abcdef' }]) {
      const r = await post('/api/auth/register', body);
      assert.equal(r.status, 400, JSON.stringify(body));
    }
  });
  it('role=admin on register does NOT create an admin', async () => {
    const r = await post('/api/auth/register', { name: 'Hacker', email: `hack.${RUN}@t.dev`, password: 'abcdef', role: 'admin' });
    assert.equal(r.status, 201);
    assert.equal(r.body.user.role, 'user');
    const me = await get('/api/auth/me', { token: r.body.token });
    assert.equal(me.body.user.role, 'user');
    assert.equal((await get('/api/admin/stats', { token: r.body.token })).status, 403);
  });
  it('role=business is honoured', async () => {
    const r = await post('/api/auth/register', { name: 'Biz', email: `biz.${RUN}@t.dev`, password: 'abcdef', role: 'business' });
    assert.equal(r.body.user.role, 'business');
  });
  it('login: wrong password / unknown email → 401 with same message', async () => {
    const a = await post('/api/auth/login', { email: 'user@mohalla.test', password: 'nope' });
    const b = await post('/api/auth/login', { email: 'nobody@nowhere.dev', password: 'nope' });
    assert.equal(a.status, 401); assert.equal(b.status, 401);
    assert.equal(a.body.error, b.body.error, 'no user enumeration');
  });
  it('login is email case-insensitive and trims', async () => {
    const r = await post('/api/auth/login', { email: '  USER@Mohalla.TEST ', password: 'user123' });
    assert.equal(r.status, 200);
  });
  it('/auth/me: no token, garbage token, tampered token, wrong-secret token → 401', async () => {
    assert.equal((await get('/api/auth/me')).status, 401);
    assert.equal((await get('/api/auth/me', { token: 'garbage' })).status, 401);
    const [h, p, s] = T.user.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    payload.id = U.admin.id; payload.role = 'admin';
    const tampered = `${h}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${s}`;
    assert.equal((await get('/api/auth/me', { token: tampered })).status, 401);
    const wrong = jwt.sign({ id: U.admin.id, role: 'admin' }, 'some-other-secret');
    assert.equal((await get('/api/auth/me', { token: wrong })).status, 401);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ id: 1, role: 'admin' })).toString('base64url')}.`;
    assert.equal((await get('/api/auth/me', { token: none })).status, 401);
    assert.equal((await get('/api/auth/me', { headers: { Authorization: 'Basic abc' } })).status, 401);
  });
  it('/auth/me with valid token returns user', async () => {
    const r = await get('/api/auth/me', { token: T.user });
    assert.equal(r.status, 200);
    assert.equal(r.body.user.email, 'user@mohalla.test');
  });
  it('SECURITY: a token forged with the hard-coded default JWT secret must be rejected', async () => {
    const forged = jwt.sign({ id: U.admin.id, role: 'admin' }, 'mohalla-dev-secret-change-me');
    const r = await get('/api/admin/users', { token: forged });
    assert.notEqual(r.status, 200, 'forged admin token accepted — JWT_SECRET falls back to a public default');
  });
});

// ------------------------------------------------------------------ search
describe('search /api/businesses', () => {
  it('default returns paged shape', async () => {
    const r = await get('/api/businesses?category=restaurants');
    assert.equal(r.status, 200);
    for (const k of ['results', 'total', 'page', 'pages']) assert.ok(k in r.body, k);
    assert.ok(r.body.results.length <= 12);
    assert.ok(r.body.results.every((b) => b.is_approved));
  });
  it('q=plumber matches plumbers (plural/singular)', async () => {
    const r = await get('/api/businesses?q=plumbers');
    assert.equal(r.status, 200);
    assert.ok(r.body.total >= 6);
    assert.ok(r.body.results.every((b) => b.category_slug === 'plumbers' || /plumb/i.test(JSON.stringify(b))));
  });
  it('city filter (case-insensitive)', async () => {
    const r = await get('/api/businesses?city=dElHi&limit=50');
    assert.ok(r.body.total > 0);
    assert.ok(r.body.results.every((b) => b.city === 'Delhi'));
  });
  it('category filter', async () => {
    const r = await get('/api/businesses?category=doctors&limit=50');
    assert.ok(r.body.total > 0);
    assert.ok(r.body.results.every((b) => b.category_slug === 'doctors'));
  });
  it('minRating filter', async () => {
    const r = await get('/api/businesses?category=restaurants&minRating=4&limit=50');
    assert.ok(r.body.results.every((b) => b.rating >= 4));
  });
  it('openNow / verified / quick / featured filters', async () => {
    const o = await get('/api/businesses?category=hotels&openNow=1&limit=50');
    assert.ok(o.body.results.every((b) => b.open_now === true && b.live_status !== 'closed_today'));
    const v = await get('/api/businesses?category=restaurants&verified=1&limit=50');
    assert.ok(v.body.results.every((b) => b.is_verified));
    const q = await get('/api/businesses?category=restaurants&quick=1&limit=50');
    assert.ok(q.body.results.every((b) => b.owner_id != null));
    const f = await get('/api/businesses?category=restaurants&featured=1&limit=50');
    assert.ok(f.body.results.every((b) => b.is_featured));
  });
  it('sort variants', async () => {
    const isSorted = (arr, key, desc = true) => arr.every((b, i) => i === 0 || (desc ? arr[i - 1][key] >= b[key] : arr[i - 1][key] <= b[key]));
    const r = await get('/api/businesses?category=restaurants&sort=rating&limit=50');
    assert.ok(isSorted(r.body.results, 'rating'));
    const rv = await get('/api/businesses?category=restaurants&sort=reviews&limit=50');
    assert.ok(isSorted(rv.body.results, 'review_count'));
    const n = await get('/api/businesses?category=restaurants&sort=newest&limit=50');
    assert.ok(isSorted(n.body.results, 'created_at'));
    const d = await get('/api/businesses?category=restaurants&sort=distance&lat=30.3165&lng=78.0322&limit=50');
    assert.ok(isSorted(d.body.results, 'distance', false));
    assert.equal((await get('/api/businesses?category=restaurants&sort=relevance')).status, 200);
    assert.equal((await get('/api/businesses?category=restaurants&sort=bogus')).status, 200);
    assert.equal((await get('/api/businesses?category=restaurants&sort=distance')).status, 200); // no coords
  });
  it('sort=__proto__ / constructor (prototype keys) must not 500', async () => {
    for (const s of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      const r = await get(`/api/businesses?category=restaurants&sort=${s}`);
      assert.ok(r.status < 500, `sort=${s} → ${r.status}`);
    }
  });
  it('lat/lng + maxKm', async () => {
    const r = await get('/api/businesses?category=restaurants&lat=30.3165&lng=78.0322&maxKm=10&limit=50');
    assert.ok(r.body.total > 0);
    assert.ok(r.body.results.every((b) => b.distance != null && b.distance <= 10));
    const bad = await get('/api/businesses?category=restaurants&lat=abc&lng=xyz&maxKm=-5');
    assert.equal(bad.status, 200);
  });
  it('paging: beyond end, negative, NaN, huge limit capped at 50', async () => {
    const beyond = await get('/api/businesses?category=restaurants&page=999');
    assert.equal(beyond.status, 200); assert.equal(beyond.body.results.length, 0); assert.ok(beyond.body.total > 0);
    const neg = await get('/api/businesses?category=restaurants&page=-3');
    assert.equal(neg.body.page, 1);
    const nan = await get('/api/businesses?category=restaurants&page=abc&limit=abc');
    assert.equal(nan.body.page, 1); assert.ok(nan.body.results.length <= 12);
    const huge = await get('/api/businesses?limit=100000');
    assert.ok(huge.body.results.length <= 50);
  });
  it('negative limit must still be capped (≤50 results, pages ≥ 0)', async () => {
    const r = await get('/api/businesses?limit=-1');
    assert.equal(r.status, 200);
    assert.ok(r.body.results.length <= 50, `limit=-1 returned ${r.body.results.length} results (pages=${r.body.pages})`);
    assert.ok(r.body.pages >= 0, `pages=${r.body.pages}`);
  });
  it('weird inputs never 500 (with category, and page=2 to avoid OSM lookups)', async () => {
    const inputs = ["' OR 1=1 --", '%', '_', '%%', '__', '"; DROP TABLE users; --', '😀🍕', 'दिल्ली में डॉक्टर', '<script>alert(1)</script>',
      'x'.repeat(5000), '\\', '\u0000', '((((', '*', 'a'.repeat(3) + '\n' + 'b'];
    for (const s of inputs) {
      const qs = encodeURIComponent(s);
      for (const url of [`/api/businesses?q=${qs}&category=restaurants`, `/api/businesses?q=${qs}&page=2`, `/api/businesses?city=${qs}&category=doctors`,
        `/api/businesses?category=${qs}`, `/api/suggest?q=${qs}`]) {
        const r = await get(url);
        assert.ok(r.status < 500, `${url.slice(0, 80)} → ${r.status}`);
      }
    }
    const inj = await get(`/api/businesses?city=${encodeURIComponent("Delhi' OR '1'='1")}&category=restaurants`);
    assert.equal(inj.body.total, 0, 'SQL injection in city must not match everything');
  });
  it('repeated query params (arrays) must not 500', async () => {
    for (const url of ['/api/businesses?category=restaurants&q=a&q=b', '/api/businesses?city=Delhi&city=Pune&category=doctors',
      '/api/businesses?category=a&category=b', '/api/suggest?q=pl&q=do', '/api/businesses?category=restaurants&sort=rating&sort=reviews']) {
      const r = await get(url);
      assert.ok(r.status < 500, `${url} → ${r.status} ${r.text.slice(0, 80)}`);
    }
  });
  it('/api/suggest', async () => {
    const r = await get('/api/suggest?q=pl');
    assert.equal(r.status, 200);
    assert.ok(r.body.some((s) => s.type === 'category' && s.slug === 'plumbers'));
    assert.deepEqual((await get('/api/suggest?q=a')).body, []);
    assert.deepEqual((await get('/api/suggest')).body, []);
  });
  it('/api/categories, /api/cities, /api/stats', async () => {
    const c = await get('/api/categories');
    assert.ok(c.body.length >= 16 && c.body.every((x) => typeof x.count === 'number'));
    const ci = await get('/api/cities');
    const dd = ci.body.find((x) => x.name === 'Dehradun');
    assert.ok(dd && Array.isArray(dd.coords));
    const s = await get('/api/stats');
    for (const k of ['businesses', 'reviews', 'users', 'cities']) assert.equal(typeof s.body[k], 'number');
  });
});

// ------------------------------------------------------------------ detail
describe('business detail', () => {
  it('valid id returns full detail', async () => {
    const r = await get(`/api/businesses/${otherBiz.id}`);
    assert.equal(r.status, 200);
    for (const k of ['reviews', 'breakdown', 'similar', 'isFavorite']) assert.ok(k in r.body, k);
    assert.equal(r.body.category_keywords, undefined);
    assert.ok(r.body.reviews.every((rv) => !('email' in rv) && !('password' in rv)));
  });
  it('anonymous detail response includes canEdit: false', async () => {
    const r = await get(`/api/businesses/${otherBiz.id}`);
    assert.equal(r.body.canEdit, false, `canEdit is ${JSON.stringify(r.body.canEdit)} (key ${'canEdit' in r.body ? 'present' : 'missing'})`);
  });
  it('nonexistent / non-numeric / weird ids → 404', async () => {
    for (const id of ['999999', 'abc', '1.5', '-1', '0', "1' OR '1'='1", '%20']) {
      const r = await get(`/api/businesses/${encodeURIComponent(id)}`);
      assert.equal(r.status, 404, id);
    }
  });
  it('views counter increments', async () => {
    const a = await get(`/api/businesses/${otherBiz.id}`);
    const b = await get(`/api/businesses/${otherBiz.id}`);
    assert.equal(b.body.views, a.body.views + 1);
  });
  it('seeded unapproved listing hidden from public & other users, visible to admin', async () => {
    const pend = await get('/api/admin/businesses?status=pending', { token: T.admin });
    assert.ok(pend.body.length > 0);
    const id = pend.body[0].id;
    assert.equal((await get(`/api/businesses/${id}`)).status, 404);
    assert.equal((await get(`/api/businesses/${id}`, { token: T.user })).status, 404);
    assert.equal((await get(`/api/businesses/${id}`, { token: T.admin })).status, 200);
    const s = await get(`/api/businesses?category=${pend.body[0].category_slug}&limit=50`);
    assert.ok(!s.body.results.some((b) => b.id === id));
  });
});

// ------------------------------------------------------------------ CRUD + approval
describe('create / update / delete business', () => {
  const body = () => ({ name: `Test Plumbing ${RUN}`, category_id: 4, phone: '+91 9876500000', address: '1 Test Road', city: 'Dehradun', services: ['Leak Repair'] });
  let newId;
  it('customer cannot create (403), anonymous 401', async () => {
    assert.equal((await post('/api/businesses', body(), { token: T.user })).status, 403);
    assert.equal((await post('/api/businesses', body())).status, 401);
  });
  it('validation errors → 400', async () => {
    for (const k of ['name', 'category_id', 'phone', 'address', 'city']) {
      const b = body(); delete b[k];
      assert.equal((await post('/api/businesses', b, { token: T.owner })).status, 400, k);
    }
    assert.equal((await post('/api/businesses', { ...body(), category_id: 99999 }, { token: T.owner })).status, 400);
    assert.equal((await post('/api/businesses', { ...body(), category_id: 'abc' }, { token: T.owner })).status, 400);
  });
  it('owner creates → unapproved, hidden from public, visible to owner & admin', async () => {
    const r = await post('/api/businesses', body(), { token: T.owner });
    assert.equal(r.status, 201);
    assert.equal(r.body.is_approved, false);
    assert.equal(r.body.owner_id, U.owner.id);
    assert.deepEqual([r.body.lat, r.body.lng], [30.3165, 78.0322]); // city default coords
    newId = r.body.id;
    assert.equal((await get(`/api/businesses/${newId}`)).status, 404);
    assert.equal((await get(`/api/businesses/${newId}`, { token: T.owner })).status, 200);
    assert.equal((await get(`/api/businesses/${newId}`, { token: T.admin })).status, 200);
    const s = await get('/api/businesses?category=plumbers&limit=50');
    assert.ok(!s.body.results.some((b) => b.id === newId));
    assert.equal((await get(`/api/admin/businesses?status=pending`, { token: T.admin })).body.some((b) => b.id === newId), true);
  });
  it('unapproved: cannot be reviewed or enquired', async () => {
    assert.equal((await post(`/api/businesses/${newId}/reviews`, { rating: 5 }, { token: T.user })).status, 404);
    assert.equal((await post(`/api/businesses/${newId}/enquiries`, { name: 'a', phone: '9876543210', message: 'x' })).status, 404);
  });
  it('admin approves / features / verifies → visible publicly', async () => {
    const r = await patch(`/api/admin/businesses/${newId}`, { is_approved: true, is_featured: true, is_verified: true }, { token: T.admin });
    assert.equal(r.status, 200);
    assert.equal(r.body.is_approved, true); assert.equal(r.body.is_featured, true); assert.equal(r.body.is_verified, true);
    assert.equal((await get(`/api/businesses/${newId}`)).status, 200);
    const s = await get('/api/businesses?category=plumbers&featured=1&verified=1&limit=50');
    assert.ok(s.body.results.some((b) => b.id === newId));
    assert.equal((await patch(`/api/admin/businesses/${newId}`, { is_featured: false }, { token: T.owner })).status, 403);
    assert.equal((await patch(`/api/admin/businesses/999999`, { is_featured: false }, { token: T.admin })).status, 404);
  });
  it('owner2 cannot edit/delete owner listing (403); admin can edit', async () => {
    assert.equal((await put(`/api/businesses/${newId}`, body(), { token: T.owner2 })).status, 403);
    assert.equal((await del(`/api/businesses/${newId}`, { token: T.owner2 })).status, 403);
    assert.equal((await del(`/api/businesses/${newId}`, { token: T.user })).status, 403);
    const r = await put(`/api/businesses/${newId}`, { ...body(), name: 'Admin Edited' }, { token: T.admin });
    assert.equal(r.status, 200); assert.equal(r.body.name, 'Admin Edited');
    assert.equal(r.body.owner_id, U.owner.id, 'admin edit keeps owner');
  });
  it('owner edits own listing; validation applies on update', async () => {
    const r = await put(`/api/businesses/${newId}`, { ...body(), name: 'Owner Edited', hours: { open: '10:00', close: '18:00', closed: ['sun', 'xyz'] } }, { token: T.owner });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.hours.closed, ['sun']);
    assert.equal((await put(`/api/businesses/${newId}`, { ...body(), category_id: 424242 }, { token: T.owner })).status, 400);
    assert.equal((await put(`/api/businesses/999999`, body(), { token: T.owner })).status, 404);
  });
  it('admin create is approved immediately', async () => {
    const r = await post('/api/businesses', { ...body(), name: `Admin Biz ${RUN}` }, { token: T.admin });
    assert.equal(r.status, 201); assert.equal(r.body.is_approved, true);
    assert.equal((await del(`/api/businesses/${r.body.id}`, { token: T.admin })).status, 200);
  });
  it('owner deletes own listing', async () => {
    assert.equal((await del(`/api/businesses/${newId}`, { token: T.owner })).status, 200);
    assert.equal((await get(`/api/businesses/${newId}`, { token: T.admin })).status, 404);
    assert.equal((await del(`/api/businesses/${newId}`, { token: T.owner })).status, 404);
  });
});

// ------------------------------------------------------------------ photos
describe('photos', () => {
  let photoUrl;
  it('valid PNG upload by owner', async () => {
    const r = await api('POST', `/api/businesses/${ownerBiz.id}/photos`, { token: T.owner, form: fileForm(PNG, 'image/png', 'pic.png') });
    assert.equal(r.status, 200, r.text);
    photoUrl = r.body.photos.at(-1);
    assert.match(photoUrl, /^\/uploads\/[0-9a-f-]+\.png$/);
    const f = await fetch(BASE + photoUrl);
    assert.equal(f.status, 200);
    assert.match(f.headers.get('content-type'), /^image\/png/);
  });
  it('non-image file rejected (400)', async () => {
    const r = await api('POST', `/api/businesses/${ownerBiz.id}/photos`, { token: T.owner, form: fileForm(Buffer.from('hello'), 'text/plain', 'a.txt') });
    assert.equal(r.status, 400);
  });
  it('>5MB rejected (400)', async () => {
    const r = await api('POST', `/api/businesses/${ownerBiz.id}/photos`, { token: T.owner, form: fileForm(Buffer.alloc(5.5 * 1024 * 1024, 1), 'image/png', 'big.png') });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /5 MB/);
  });
  it('unauthenticated 401, other owner 403, missing business 404', async () => {
    assert.equal((await api('POST', `/api/businesses/${ownerBiz.id}/photos`, { form: fileForm(PNG, 'image/png', 'p.png') })).status, 401);
    assert.equal((await api('POST', `/api/businesses/${ownerBiz.id}/photos`, { token: T.owner2, form: fileForm(PNG, 'image/png', 'p.png') })).status, 403);
    assert.equal((await api('POST', `/api/businesses/999999/photos`, { token: T.owner, form: fileForm(PNG, 'image/png', 'p.png') })).status, 404);
  });
  it('SECURITY: HTML/SVG disguised with image/png MIME must not be served as active content', async () => {
    for (const [name, content] of [['evil.html', '<script>alert(document.domain)</script>'], ['evil.svg', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>']]) {
      const r = await api('POST', `/api/businesses/${ownerBiz.id}/photos`, { token: T.owner, form: fileForm(Buffer.from(content), 'image/png', name) });
      if (r.status === 200) {
        const url = r.body.photos.at(-1);
        const f = await fetch(BASE + url);
        const ct = f.headers.get('content-type');
        await del(`/api/businesses/${ownerBiz.id}/photos?url=${encodeURIComponent(url)}`, { token: T.owner }); // clean up
        assert.ok(/^image\/(png|jpeg|gif|webp)/.test(ct), `${name} accepted and served as "${ct}" at ${url}`);
      }
    }
  });
  it('photo delete: other owner 403, unknown url 404, owner ok and file removed', async () => {
    assert.equal((await del(`/api/businesses/${ownerBiz.id}/photos?url=${encodeURIComponent(photoUrl)}`, { token: T.owner2 })).status, 403);
    assert.equal((await del(`/api/businesses/${ownerBiz.id}/photos?url=/uploads/nope.png`, { token: T.owner })).status, 404);
    const r = await del(`/api/businesses/${ownerBiz.id}/photos?url=${encodeURIComponent(photoUrl)}`, { token: T.owner });
    assert.equal(r.status, 200);
    assert.ok(!r.body.photos.includes(photoUrl));
    assert.equal((await fetch(BASE + photoUrl)).status, 404);
  });
});

// ------------------------------------------------------------------ reviews
describe('reviews', () => {
  let reviewId;
  const count = async () => (await get(`/api/businesses/${otherBiz.id}`)).body.reviews.length;
  it('create review (201)', async () => {
    const before = await count();
    const r = await post(`/api/businesses/${otherBiz.id}/reviews`, { rating: 4, comment: 'Nice place' }, { token: T.user });
    assert.equal(r.status, 201);
    assert.equal(await count(), before + 1);
  });
  it('posting again updates (upsert), no duplicate', async () => {
    const before = await count();
    await post(`/api/businesses/${otherBiz.id}/reviews`, { rating: 2, comment: 'Changed my mind' }, { token: T.user });
    assert.equal(await count(), before);
    const mine = await get('/api/my/reviews', { token: T.user });
    const rv = mine.body.find((x) => x.business_id === otherBiz.id);
    assert.equal(rv.rating, 2); assert.equal(rv.comment, 'Changed my mind');
    reviewId = rv.id;
  });
  it('rating out of range / invalid → 400', async () => {
    for (const rating of [0, 6, -1, 5.6, 'abc', null, undefined, '']) {
      const r = await post(`/api/businesses/${otherBiz.id}/reviews`, { rating }, { token: T.aarav });
      assert.equal(r.status, 400, String(rating));
    }
  });
  it('anonymous 401, nonexistent business 404', async () => {
    assert.equal((await post(`/api/businesses/${otherBiz.id}/reviews`, { rating: 5 })).status, 401);
    assert.equal((await post(`/api/businesses/999999/reviews`, { rating: 5 }, { token: T.user })).status, 404);
  });
  it('owner cannot review own business (400)', async () => {
    assert.equal((await post(`/api/businesses/${ownerBiz.id}/reviews`, { rating: 5 }, { token: T.owner })).status, 400);
  });
  it('delete: other user 403, own ok, admin can delete anyone', async () => {
    assert.equal((await del(`/api/reviews/${reviewId}`, { token: T.aarav })).status, 403);
    assert.equal((await del(`/api/reviews/${reviewId}`, { token: T.owner })).status, 403);
    assert.equal((await del(`/api/reviews/${reviewId}`, { token: T.user })).status, 200);
    assert.equal((await del(`/api/reviews/${reviewId}`, { token: T.user })).status, 404);
    await post(`/api/businesses/${otherBiz.id}/reviews`, { rating: 3 }, { token: T.aarav });
    const id = (await get('/api/my/reviews', { token: T.aarav })).body.find((x) => x.business_id === otherBiz.id).id;
    assert.equal((await del(`/api/reviews/${id}`, { token: T.admin })).status, 200);
  });
});

// ------------------------------------------------------------------ enquiries + privacy mode
describe('enquiries & Privacy Mode', () => {
  const PHONE = '+91 97531 86420';
  const tag = `privacy-${RUN}`;
  let enqId;
  it('anonymous normal enquiry ok (201)', async () => {
    const r = await post(`/api/businesses/${ownerBiz.id}/enquiries`, { name: 'Anon', phone: '9876543210', message: `anon ${tag}` });
    assert.equal(r.status, 201);
  });
  it('anonymous hide_phone rejected (401)', async () => {
    const r = await post(`/api/businesses/${ownerBiz.id}/enquiries`, { name: 'Anon', phone: '9876543210', message: 'x', hide_phone: true });
    assert.equal(r.status, 401);
  });
  it('validation: missing fields / bad phone → 400', async () => {
    for (const b of [{ phone: '9876543210', message: 'x' }, { name: 'a', message: 'x' }, { name: 'a', phone: '9876543210' }, { name: 'a', phone: 'abc', message: 'x' }, { name: 'a', phone: '123', message: 'x' }]) {
      assert.equal((await post(`/api/businesses/${ownerBiz.id}/enquiries`, b)).status, 400, JSON.stringify(b));
    }
  });
  it('phone validation should require a plausible number of digits', async () => {
    for (const phone of ['1-------', '1       1', '+-------']) {
      const r = await post(`/api/businesses/${ownerBiz.id}/enquiries`, { name: 'a', phone, message: 'x' });
      assert.equal(r.status, 400, `phone "${phone}" accepted (${r.status})`);
    }
  });
  it('logged-in hide_phone → owner sees masked phone, no full digits anywhere', async () => {
    const r = await post(`/api/businesses/${ownerBiz.id}/enquiries`, { name: 'Private Person', phone: PHONE, message: `secret ${tag}`, hide_phone: true }, { token: T.user });
    assert.equal(r.status, 201);
    const list = await get('/api/my/enquiries', { token: T.owner });
    const e = list.body.find((x) => x.message === `secret ${tag}`);
    assert.ok(e);
    enqId = e.id;
    assert.equal(e.phone_hidden, true);
    const digits = PHONE.replace(/\D/g, '');
    assert.ok(!e.phone.replace(/\D/g, '').includes(digits.slice(2)), `masked phone ${e.phone}`);
    assert.ok(!list.text.includes('9753186420') && !list.text.includes('97531 86420'), 'raw phone leaked in /my/enquiries');
    const msgs = await get(`/api/enquiries/${enqId}/messages`, { token: T.owner });
    assert.ok(!msgs.text.includes('97531'), 'phone leaked in messages endpoint');
  });
  it('Privacy Mode masking reveals at most the last 2 digits', async () => {
    const phone = '9123456780';
    await post(`/api/businesses/${ownerBiz.id}/enquiries`, { name: 'Short', phone, message: `short ${tag}`, hide_phone: true }, { token: T.user });
    const e = (await get('/api/my/enquiries', { token: T.owner })).body.find((x) => x.message === `short ${tag}`);
    const shown = e.phone.replace(/\D/g, '');
    assert.ok(shown.length <= 2 && phone.endsWith(shown), `masked "${e.phone}" reveals ${shown.length}/${phone.length} digits`);
  });
  it('rejects 8-digit phone numbers', async () => {
    const r = await post(`/api/businesses/${ownerBiz.id}/enquiries`, { name: 'Short', phone: '12345678', message: 'x' });
    assert.equal(r.status, 400);
  });
  it('owner replies; status → contacted; customer sees reply', async () => {
    const r = await post(`/api/enquiries/${enqId}/messages`, { text: 'Hello, we can help!' }, { token: T.owner });
    assert.equal(r.status, 201);
    const c = await get(`/api/enquiries/${enqId}/messages`, { token: T.user });
    assert.equal(c.status, 200);
    assert.equal(c.body.role, 'customer');
    assert.ok(c.body.messages.some((m) => m.sender === 'business' && m.text === 'Hello, we can help!'));
    const sent = await get('/api/my/sent-enquiries', { token: T.user });
    const s = sent.body.find((x) => x.id === enqId);
    assert.equal(s.reply_count, 1); assert.equal(s.status, 'contacted');
    assert.equal((await post(`/api/enquiries/${enqId}/messages`, { text: 'Thanks' }, { token: T.user })).status, 201);
  });
  it('third user gets 403; anonymous 401; unknown 404', async () => {
    assert.equal((await get(`/api/enquiries/${enqId}/messages`, { token: T.aarav })).status, 403);
    assert.equal((await post(`/api/enquiries/${enqId}/messages`, { text: 'hi' }, { token: T.aarav })).status, 403);
    assert.equal((await get(`/api/enquiries/${enqId}/messages`, { token: T.owner2 })).status, 403);
    assert.equal((await get(`/api/enquiries/${enqId}/messages`)).status, 401);
    assert.equal((await get(`/api/enquiries/999999/messages`, { token: T.user })).status, 404);
  });
  it('empty / whitespace message rejected (400)', async () => {
    for (const text of ['', '   ', undefined]) {
      assert.equal((await post(`/api/enquiries/${enqId}/messages`, { text }, { token: T.owner })).status, 400);
    }
  });
  it('status PATCH: customer/other 403, invalid 400, owner & admin ok', async () => {
    assert.equal((await patch(`/api/enquiries/${enqId}`, { status: 'closed' }, { token: T.user })).status, 403);
    assert.equal((await patch(`/api/enquiries/${enqId}`, { status: 'closed' }, { token: T.owner2 })).status, 403);
    assert.equal((await patch(`/api/enquiries/${enqId}`, { status: 'bogus' }, { token: T.owner })).status, 400);
    assert.equal((await patch(`/api/enquiries/${enqId}`, { status: 'closed' }, { token: T.owner })).status, 200);
    assert.equal((await patch(`/api/enquiries/${enqId}`, { status: 'new' }, { token: T.admin })).status, 200);
    assert.equal((await patch(`/api/enquiries/999999`, { status: 'new' }, { token: T.admin })).status, 404);
  });
  it('/my/enquiries requires business role', async () => {
    assert.equal((await get('/api/my/enquiries', { token: T.user })).status, 403);
  });
});

// ------------------------------------------------------------------ leads
describe('/api/leads', () => {
  it('validation', async () => {
    assert.equal((await post('/api/leads', { phone: '9876543210', category: 'plumbers' })).status, 400);
    assert.equal((await post('/api/leads', { name: 'a', category: 'plumbers' })).status, 400);
    assert.equal((await post('/api/leads', { name: 'a', phone: 'x1', category: 'plumbers' })).status, 400);
  });
  it('fans out to top 5 by rating', async () => {
    const r = await post('/api/leads', { name: 'Lead', phone: '9876543210', category: 'plumbers', need: 'Leaky tap' });
    assert.equal(r.status, 201);
    assert.ok(r.body.sentTo.length >= 1 && r.body.sentTo.length <= 5);
    assert.ok(r.body.sentTo.every((b, i, a) => i === 0 || a[i - 1].rating >= b.rating));
  });
  it('no matches → 404', async () => {
    assert.equal((await post('/api/leads', { name: 'a', phone: '9876543210', category: 'no-such-cat' })).status, 404);
  });
  it('hide_phone anonymous → 401; logged-in → masked for owner', async () => {
    assert.equal((await post('/api/leads', { name: 'a', phone: '9876543210', category: 'plumbers', city: 'Dehradun', hide_phone: true })).status, 401);
    const r = await post('/api/leads', { name: 'LeadPriv', phone: '+91 91111 22222', category: 'plumbers', city: 'Dehradun', need: `lead-${RUN}`, hide_phone: true }, { token: T.user });
    assert.equal(r.status, 201);
    const list = await get('/api/my/enquiries', { token: T.owner });
    const e = list.body.find((x) => x.message === `lead-${RUN}`);
    if (e) assert.ok(!e.phone.includes('91111 22222') && e.phone_hidden);
  });
});

// ------------------------------------------------------------------ live status
describe('live status', () => {
  it('owner sets status; shows in search', async () => {
    const r = await patch(`/api/businesses/${ownerBiz.id}/live-status`, { status: 'busy' }, { token: T.owner });
    assert.equal(r.status, 200); assert.equal(r.body.live_status, 'busy');
    const s = await get(`/api/businesses?category=${ownerBiz.category_slug}&city=Dehradun&limit=50`);
    assert.equal(s.body.results.find((b) => b.id === ownerBiz.id).live_status, 'busy');
  });
  it('other user 403, anon 401, invalid 400, missing 404', async () => {
    assert.equal((await patch(`/api/businesses/${ownerBiz.id}/live-status`, { status: 'busy' }, { token: T.owner2 })).status, 403);
    assert.equal((await patch(`/api/businesses/${ownerBiz.id}/live-status`, { status: 'busy' }, { token: T.user })).status, 403);
    assert.equal((await patch(`/api/businesses/${ownerBiz.id}/live-status`, { status: 'busy' })).status, 401);
    assert.equal((await patch(`/api/businesses/${ownerBiz.id}/live-status`, { status: 'party' }, { token: T.owner })).status, 400);
    assert.equal((await patch(`/api/businesses/999999/live-status`, { status: 'busy' }, { token: T.owner })).status, 404);
  });
  it('closed_today excluded from openNow; null clears', async () => {
    await patch(`/api/businesses/${ownerBiz.id}/live-status`, { status: 'closed_today' }, { token: T.owner });
    const o = await get(`/api/businesses?category=${ownerBiz.category_slug}&openNow=1&limit=50`);
    assert.ok(!o.body.results.some((b) => b.id === ownerBiz.id));
    const r = await patch(`/api/businesses/${ownerBiz.id}/live-status`, { status: null }, { token: T.owner });
    assert.equal(r.status, 200); assert.equal(r.body.live_status, null);
  });
});

// ------------------------------------------------------------------ favorites & claim
describe('favorites', () => {
  it('add / list / detail flag / remove', async () => {
    assert.equal((await post(`/api/favorites/${otherBiz.id}`, {}, { token: T.user })).body.isFavorite, true);
    assert.equal((await post(`/api/favorites/${otherBiz.id}`, {}, { token: T.user })).status, 200); // idempotent
    assert.ok((await get('/api/favorites', { token: T.user })).body.some((b) => b.id === otherBiz.id));
    assert.equal((await get(`/api/businesses/${otherBiz.id}`, { token: T.user })).body.isFavorite, true);
    assert.equal((await del(`/api/favorites/${otherBiz.id}`, { token: T.user })).body.isFavorite, false);
    assert.ok(!(await get('/api/favorites', { token: T.user })).body.some((b) => b.id === otherBiz.id));
  });
  it('nonexistent 404, anon 401', async () => {
    assert.equal((await post('/api/favorites/999999', {}, { token: T.user })).status, 404);
    assert.equal((await post('/api/favorites/abc', {}, { token: T.user })).status, 404);
    assert.equal((await get('/api/favorites')).status, 401);
  });
});

describe('claim', () => {
  it('customer cannot claim (403); missing 404', async () => {
    assert.equal((await post(`/api/businesses/${otherBiz.id}/claim`, {}, { token: T.user })).status, 403);
    assert.equal((await post(`/api/businesses/999999/claim`, {}, { token: T.owner2 })).status, 404);
  });
  it('business user claims unowned listing; second claim 409', async () => {
    const r = await post(`/api/businesses/${otherBiz.id}/claim`, {}, { token: T.owner2 });
    assert.equal(r.status, 200);
    assert.equal(r.body.owner_id, U.owner2.id);
    assert.equal((await post(`/api/businesses/${otherBiz.id}/claim`, {}, { token: T.owner })).status, 409);
    assert.equal((await post(`/api/businesses/${otherBiz.id}/claim`, {}, { token: T.owner2 })).status, 409);
    assert.equal((await get(`/api/businesses/${otherBiz.id}`, { token: T.owner2 })).body.canEdit, true);
  });
});

// ------------------------------------------------------------------ admin
describe('admin', () => {
  it('non-admin 403, anon 401 on every admin route', async () => {
    for (const [m, p] of [['GET', '/api/admin/stats'], ['GET', '/api/admin/businesses'], ['PATCH', `/api/admin/businesses/${otherBiz.id}`], ['GET', '/api/admin/users'],
      ['DELETE', '/api/admin/users/5'], ['POST', '/api/admin/categories'], ['DELETE', '/api/admin/categories/1']]) {
      assert.equal((await api(m, p, { token: T.owner, body: m === 'GET' ? undefined : {} })).status, 403, `${m} ${p}`);
      assert.equal((await api(m, p, { token: T.user, body: m === 'GET' ? undefined : {} })).status, 403, `${m} ${p}`);
      assert.equal((await api(m, p, { body: m === 'GET' ? undefined : {} })).status, 401, `${m} ${p}`);
    }
  });
  it('stats', async () => {
    const r = await get('/api/admin/stats', { token: T.admin });
    for (const k of ['users', 'businesses', 'pending', 'reviews', 'enquiries', 'categories', 'byCategory', 'byCity']) assert.ok(k in r.body, k);
  });
  it('businesses list filters', async () => {
    for (const s of ['all', 'pending', 'approved', 'featured']) assert.equal((await get(`/api/admin/businesses?status=${s}`, { token: T.admin })).status, 200);
    assert.equal((await get(`/api/admin/businesses?q=${encodeURIComponent("%' OR 1=1 --")}`, { token: T.admin })).status, 200);
  });
  it('users list has no password hashes', async () => {
    const r = await get('/api/admin/users', { token: T.admin });
    assert.ok(r.body.length > 20);
    assert.ok(!r.text.includes('$2a$') && !r.text.includes('$2b$'));
  });
  it('cannot delete self; can delete another user', async () => {
    assert.equal((await del(`/api/admin/users/${U.admin.id}`, { token: T.admin })).status, 400);
    const v = await post('/api/auth/register', { name: 'Victim', email: `victim.${RUN}@t.dev`, password: 'abcdef' });
    assert.equal((await del(`/api/admin/users/${v.body.user.id}`, { token: T.admin })).status, 200);
    assert.equal((await get('/api/auth/me', { token: v.body.token })).status, 401);
  });
  it('categories: add, duplicate 409, delete in-use 400, delete empty ok', async () => {
    const name = `Tailors ${RUN}`;
    const r = await post('/api/admin/categories', { name, keywords: 'stitch' }, { token: T.admin });
    assert.equal(r.status, 201);
    assert.equal((await post('/api/admin/categories', { name: name.toUpperCase() }, { token: T.admin })).status, 409);
    assert.equal((await post('/api/admin/categories', { name: '  ' }, { token: T.admin })).status, 400);
    assert.equal((await del('/api/admin/categories/1', { token: T.admin })).status, 400);
    assert.equal((await del(`/api/admin/categories/${r.body.id}`, { token: T.admin })).status, 200);
  });
  it('category name without latin letters/digits must be rejected (empty slug)', async () => {
    const r = await post('/api/admin/categories', { name: 'दर्जी' }, { token: T.admin });
    if (r.status === 201) await del(`/api/admin/categories/${r.body.id}`, { token: T.admin });
    assert.equal(r.status, 400, `created category with slug "${r.body?.slug}"`);
  });
});

// ------------------------------------------------------------------ robustness: bad bodies / types
describe('robustness: malformed bodies & wrong types never 500', () => {
  const cases = [
    ['POST', '/api/auth/login', null, 'no body'],
    ['POST', '/api/auth/register', null, 'no body'],
    ['POST', '/api/auth/login', { email: 123, password: 'x' }, 'email number'],
    ['POST', '/api/auth/login', { email: 'user@mohalla.test', password: 123 }, 'password number'],
    ['POST', '/api/auth/register', { name: 'X', email: ['a@b.co'], password: 'abcdef' }, 'email array'],
    ['POST', '/api/auth/register', { name: 'X', email: `num.${RUN}@t.dev`, password: 1234567 }, 'password number'],
    ['POST', '/api/auth/register', { name: { a: 1 }, email: `obj.${RUN}@t.dev`, password: 'abcdef' }, 'name object'],
  ];
  for (const [m, p, body, label] of cases) {
    it(`${m} ${p} (${label})`, async () => {
      const r = await api(m, p, body === null ? {} : { body });
      assert.ok(r.status < 500, `${label} → ${r.status} ${r.text.slice(0, 80)}`);
    });
  }
  it('malformed JSON → 400', async () => {
    const r = await api('POST', '/api/auth/login', { raw: '{"email":', headers: { 'Content-Type': 'application/json' } });
    assert.equal(r.status, 400, `got ${r.status}`);
  });
  it('body > 1mb → 413', async () => {
    const r = await api('POST', '/api/auth/login', { raw: JSON.stringify({ email: 'x'.repeat(1.2e6) }), headers: { 'Content-Type': 'application/json' } });
    assert.equal(r.status, 413, `got ${r.status}`);
  });
  it('authenticated routes with wrong types', async () => {
    const checks = [
      ['POST', `/api/businesses/${ownerBiz.id}/reviews`, { rating: 5, comment: 12345 }, T.aarav],
      ['POST', `/api/businesses/${ownerBiz.id}/enquiries`, { name: 'a', phone: '9876543210', message: 42 }, T.user],
      ['POST', `/api/businesses/${ownerBiz.id}/enquiries`, { name: { x: 1 }, phone: '9876543210', message: 'hi' }, T.user],
      ['POST', '/api/leads', { name: 'a', phone: '9876543210', category: 'plumbers', need: 7 }, T.user],
      ['POST', '/api/leads', { name: 'a', phone: '9876543210', q: ['a', 'b'] }, T.user],
      ['POST', '/api/businesses', { name: { a: 1 }, category_id: 4, phone: '1', address: 'a', city: 'Dehradun' }, T.owner],
      ['POST', '/api/admin/categories', { name: 5 }, T.admin],
      ['POST', `/api/businesses/${ownerBiz.id}/reviews`, null, T.aarav],
      ['POST', '/api/leads', null, T.user],
    ];
    const fails = [];
    for (const [m, p, body, token] of checks) {
      const r = await api(m, p, body === null ? { token } : { token, body });
      if (r.status >= 500) fails.push(`${m} ${p} ${JSON.stringify(body)} → ${r.status}`);
    }
    // enquiry messages with non-string text
    const sent = (await get('/api/my/sent-enquiries', { token: T.user })).body[0];
    const r = await post(`/api/enquiries/${sent.id}/messages`, { text: 999 }, { token: T.user });
    if (r.status >= 500) fails.push(`POST /api/enquiries/${sent.id}/messages {"text":999} → ${r.status}`);
    assert.deepEqual(fails, []);
  });
  it('services with non-string items are rejected or sanitised', async () => {
    const r = await post('/api/businesses', { name: 'Svc Test', category_id: 4, phone: '9876543210', address: 'a', city: 'Dehradun', services: [{ evil: 1 }, 5, 'ok'] }, { token: T.owner });
    if (r.status === 201) await del(`/api/businesses/${r.body.id}`, { token: T.owner });
    assert.ok(r.status === 400 || r.body.services.every((s) => typeof s === 'string'), `stored services ${JSON.stringify(r.body?.services)}`);
  });
  it('unknown /api route → 404 JSON', async () => {
    for (const p of ['/api/xyz', '/api/businesses/1/nope', '/api']) {
      const r = await get(p);
      assert.equal(r.status, 404, p);
      assert.ok(r.body?.error, p);
    }
    assert.equal((await api('DELETE', '/api/categories')).status, 404);
  });
});

// ------------------------------------------------------------------ OpenStreetMap (real network, called once each)
describe('OpenStreetMap integration (live network)', { skip: !!process.env.SKIP_OSM }, () => {
  it('POST /api/nearby invalid coords → 400 (no network)', async () => {
    assert.equal((await post('/api/nearby', { lat: 0, lng: 0 })).status, 400);
    assert.equal((await post('/api/nearby', { lat: 'abc', lng: 5 })).status, 400);
    assert.equal((await post('/api/nearby', { lat: 91, lng: 5 })).status, 400);
  });
  it('POST /api/nearby Dehradun (one real call)', { timeout: 120000 }, async () => {
    const r = await post('/api/nearby', { lat: 30.3245, lng: 78.0418 });
    console.log(`# nearby → ${r.status} ${r.text.slice(0, 200)}`);
    assert.ok(r.status === 200 || r.status === 502, `status ${r.status}`);
  });
  it('GET /api/businesses?q=graphic era (one real name search)', { timeout: 60000 }, async () => {
    await new Promise((r) => setTimeout(r, 1500)); // be polite to Nominatim
    const r = await get('/api/businesses?q=graphic%20era');
    console.log(`# name search → ${r.status} total=${r.body?.total} first=${r.body?.results?.[0]?.name}`);
    assert.ok(r.status < 500, `status ${r.status}`);
  });
});
