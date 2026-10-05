// Database setup using SQLite (built into Node.js 22+, no install needed)
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DB_FILE lets tests use a separate database
export const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, 'data.db'));

db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    phone       TEXT,
    role        TEXT NOT NULL DEFAULT 'user',      -- user | business | admin
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    slug      TEXT NOT NULL UNIQUE,
    icon      TEXT NOT NULL DEFAULT 'Store',
    color     TEXT NOT NULL DEFAULT '#FFC567',
    keywords  TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS businesses (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    category_id   INTEGER NOT NULL REFERENCES categories(id),
    name          TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    phone         TEXT NOT NULL,
    whatsapp      TEXT,
    email         TEXT,
    website       TEXT,
    address       TEXT NOT NULL,
    area          TEXT NOT NULL DEFAULT '',
    city          TEXT NOT NULL,
    lat           REAL,
    lng           REAL,
    hours         TEXT NOT NULL DEFAULT '{"open":"09:00","close":"21:00","closed":[]}',
    services      TEXT NOT NULL DEFAULT '[]',
    photos        TEXT NOT NULL DEFAULT '[]',
    established   INTEGER,
    is_approved   INTEGER NOT NULL DEFAULT 0,
    is_featured   INTEGER NOT NULL DEFAULT 0,
    is_verified   INTEGER NOT NULL DEFAULT 0,
    views         INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id  INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment      TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, business_id)
  );

  CREATE TABLE IF NOT EXISTS enquiries (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    business_id  INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    phone        TEXT NOT NULL,
    message      TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'new',      -- new | contacted | closed
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id  INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, business_id)
  );

  -- Areas already fetched from OpenStreetMap, so we don't download the same place twice
  CREATE TABLE IF NOT EXISTS synced_areas (
    area_key    TEXT PRIMARY KEY,
    synced_at   TEXT NOT NULL DEFAULT (datetime('now')),
    found       INTEGER NOT NULL DEFAULT 0
  );
`);

// In-app replies for Privacy Mode enquiries (customer's number stays hidden)
db.exec(`
  CREATE TABLE IF NOT EXISTS enquiry_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    enquiry_id  INTEGER NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
    sender      TEXT NOT NULL,            -- customer | business
    text        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Columns added after the first version (safe to run every start)
function addColumn(table, name, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}
addColumn('businesses', 'source', "TEXT NOT NULL DEFAULT 'local'");
addColumn('businesses', 'osm_id', 'TEXT');
addColumn('businesses', 'live_status', 'TEXT');        // available | busy | closed_today
addColumn('businesses', 'live_status_at', 'TEXT');
addColumn('enquiries', 'hide_phone', 'INTEGER NOT NULL DEFAULT 0');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_osm ON businesses(osm_id)');
// Speed: the search counts reviews per business, and dashboards look up by owner
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);
  CREATE INDEX IF NOT EXISTS idx_enquiries_business ON enquiries(business_id);
  CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_id);
`);
// Faster writes: the write-ahead log lets reads continue while a write is saved
db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');

// Run several statements as one transaction
export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// Known city centres, used for "near me" defaults and new listings without a map pin
export const CITY_COORDS = {
  Dehradun: [30.3165, 78.0322],
  Delhi: [28.6139, 77.209],
  Mumbai: [19.076, 72.8777],
  Bengaluru: [12.9716, 77.5946],
  Pune: [18.5204, 73.8567],
  Jaipur: [26.9124, 75.7873],
  Hyderabad: [17.385, 78.4867],
};
