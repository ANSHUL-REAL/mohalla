// Fetches REAL businesses around a location from OpenStreetMap (free, no API key)
// and saves them as listings, so users see actual shops, clinics and restaurants near them.
import { db, transaction } from './db.js';

const OVERPASS_SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const HEADERS = { 'User-Agent': 'Mohalla-College-Project/1.0 (local business directory demo)' };
const RESYNC_HOURS = 24;

// OpenStreetMap tag value → our category slug
const TAG_MAP = {
  amenity: {
    restaurant: 'restaurants', fast_food: 'restaurants', cafe: 'restaurants', food_court: 'restaurants', ice_cream: 'restaurants',
    doctors: 'doctors', clinic: 'doctors', dentist: 'doctors', hospital: 'doctors',
    pharmacy: 'pharmacy', bank: 'banks', atm: 'banks',
    school: 'education', college: 'education', university: 'education', kindergarten: 'education',
    training: 'coaching', language_school: 'coaching',
    driving_school: 'coaching', music_school: 'coaching', prep_school: 'coaching',
    car_wash: 'car-repair', car_repair: 'car-repair',
  },
  shop: {
    supermarket: 'grocery', convenience: 'grocery', grocery: 'grocery', greengrocer: 'grocery', bakery: 'grocery', dairy: 'grocery',
    chemist: 'pharmacy', medical_supply: 'pharmacy',
    beauty: 'beauty-spa', hairdresser: 'beauty-spa', massage: 'beauty-spa', cosmetics: 'beauty-spa',
    car_repair: 'car-repair', tyres: 'car-repair', car_parts: 'car-repair',
    hardware: 'plumbers', doityourself: 'plumbers', bathroom_furnishing: 'plumbers',
    electrical: 'electricians', electronics: 'electricians', lighting: 'electricians',
    appliance: 'ac-repair',
  },
  tourism: { hotel: 'hotels', guest_house: 'hotels', hostel: 'hotels', motel: 'hotels' },
  leisure: { fitness_centre: 'gyms', sports_centre: 'gyms' },
  craft: { plumber: 'plumbers', electrician: 'electricians', hvac: 'ac-repair' },
  office: { moving_company: 'packers-movers', educational_institution: 'education' },
};

function categoryFor(tags) {
  for (const [key, values] of Object.entries(TAG_MAP)) {
    if (tags[key] && values[tags[key]]) return values[tags[key]];
  }
  if (tags.healthcare) return tags.healthcare === 'pharmacy' ? 'pharmacy' : 'doctors';
  return null;
}

// Search the area once for named places, then keep only the business types we know
function buildQuery(lat, lng, radius) {
  const filters = Object.entries(TAG_MAP).map(
    ([key, values]) => `nwr.a["${key}"~"^(${Object.keys(values).join('|')})$"];`,
  );
  filters.push('nwr.a["healthcare"];');
  return `[out:json][timeout:25];nwr(around:${radius},${lat},${lng})["name"]->.a;(${filters.join('')});out center tags 400;`;
}

// "Mo-Sa 09:00-21:00" → { open: '09:00', close: '21:00', closed: ['sun'] }. Unknown formats → hours unknown.
function parseHours(text) {
  if (!text) return { open: '09:00', close: '21:00', closed: [], unknown: true };
  if (/^24\/7$/.test(text.trim())) return { open: '00:00', close: '23:59', closed: [] };
  const time = text.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!time) return { open: '09:00', close: '21:00', closed: [], unknown: true };
  const pad = (t) => t.padStart(5, '0');
  let close = pad(time[2]);
  if (close === '24:00' || close < pad(time[1])) close = '23:59';
  const closed = [];
  if (/^Mo-Sa\b/.test(text) && !/Su/.test(text)) closed.push('sun');
  if (/Su\s+off/i.test(text)) closed.push('sun');
  return { open: pad(time[1]), close, closed: [...new Set(closed)] };
}

function servicesFrom(tags) {
  const s = [];
  if (tags.cuisine) tags.cuisine.split(/[;,]/).forEach((c) => s.push(c.trim().replace(/_/g, ' ').replace(/^\w/, (x) => x.toUpperCase())));
  if (tags['healthcare:speciality']) tags['healthcare:speciality'].split(';').forEach((c) => s.push(c.replace(/_/g, ' ').replace(/^\w/, (x) => x.toUpperCase())));
  if (tags.delivery === 'yes') s.push('Home Delivery');
  if (tags.takeaway === 'yes') s.push('Takeaway');
  if (tags.outdoor_seating === 'yes') s.push('Outdoor Seating');
  if (tags['diet:vegetarian'] === 'yes' || tags['diet:vegetarian'] === 'only') s.push('Vegetarian');
  if (tags.internet_access === 'wlan' || tags.internet_access === 'yes') s.push('Free WiFi');
  if (tags.wheelchair === 'yes') s.push('Wheelchair Accessible');
  if (tags.air_conditioning === 'yes') s.push('Air Conditioned');
  if (tags.atm === 'yes') s.push('ATM');
  if (tags.amenity === 'hospital') s.push('Hospital');
  if (tags.emergency === 'yes') s.push('Emergency');
  if (tags.brand) s.push(tags.brand);
  if (tags['payment:upi'] === 'yes') s.push('UPI Accepted');
  return [...new Set(s)].slice(0, 8);
}

const KIND = {
  restaurants: 'restaurant', hotels: 'place to stay', doctors: 'healthcare provider', plumbers: 'hardware & plumbing supplier',
  electricians: 'electrical & electronics business', 'ac-repair': 'appliance & AC business', 'beauty-spa': 'beauty & grooming business',
  gyms: 'fitness centre', coaching: 'education & training centre', 'car-repair': 'car service business',
  'packers-movers': 'moving company', pharmacy: 'pharmacy', grocery: 'grocery & daily needs store', banks: 'bank / ATM',
  education: 'school / college / university', places: 'place',
};

async function fetchJson(url, options) {
  const res = await fetch(url, { ...options, headers: { ...HEADERS, ...options?.headers }, signal: AbortSignal.timeout(options?.method === 'POST' ? 30000 : 8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// One reverse-geocode call to name the area (used when a place has no address tags)
async function placeName(lat, lng) {
  try {
    const d = await fetchJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat=${lat}&lon=${lng}`);
    const a = d.address || {};
    return {
      area: a.suburb || a.neighbourhood || a.quarter || a.residential || a.village || a.road || '',
      city: a.city || a.town || a.city_district || a.state_district || a.county || a.village || 'Nearby',
    };
  } catch {
    return { area: '', city: 'Nearby' };
  }
}

async function overpass(query) {
  let lastError;
  // Public servers are sometimes busy: try each one, then the main one again
  for (const url of [...OVERPASS_SERVERS, OVERPASS_SERVERS[0]]) {
    try {
      return await fetchJson(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
      });
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`OpenStreetMap is not responding right now (${lastError?.message}). Please try again.`);
}

// Real photo of the place if OpenStreetMap links one (direct image or Wikimedia Commons file)
const COMMONS = (file) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/^File:/, ''))}?width=800`;
function photoFromTags(t) {
  if (t.image && /^https?:\/\/.+\.(jpe?g|png|webp)(\?.*)?$/i.test(t.image)) return t.image;
  if (t.image && /^File:/.test(t.image)) return COMMONS(t.image);
  if (t.wikimedia_commons && /^File:/.test(t.wikimedia_commons)) return COMMONS(t.wikimedia_commons);
  return null;
}

// Look up the main photo (P18) of Wikidata items, 50 at a time
async function wikidataPhotos(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    try {
      const d = await fetchJson(`https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids=${ids.slice(i, i + 50).join('|')}`);
      for (const [id, e] of Object.entries(d.entities || {})) {
        const file = e.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
        if (file) out[id] = COMMONS(file);
      }
    } catch { /* photos are optional */ }
  }
  return out;
}

// Save OpenStreetMap elements as listings. `fallbackSlug` is used for places that don't fit a category.
async function importElements(elements, place, fallbackSlug = null) {
  const catIds = Object.fromEntries(db.prepare('SELECT slug, id FROM categories').all().map((c) => [c.slug, c.id]));
  const upsert = db.prepare(`
    INSERT INTO businesses (category_id, name, description, phone, whatsapp, email, website, address, area, city, lat, lng,
                            hours, services, is_approved, source, osm_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'osm', ?)
    ON CONFLICT(osm_id) DO UPDATE SET
      name = excluded.name, phone = excluded.phone, whatsapp = excluded.whatsapp, website = excluded.website,
      address = excluded.address, lat = excluded.lat, lng = excluded.lng, hours = excluded.hours, services = excluded.services
    WHERE businesses.owner_id IS NULL`); // never overwrite a listing its owner has claimed

  const photos = {};      // osm_id -> photo url
  const wikidata = {};    // wikidata id -> osm_id (for places without a direct photo)
  let imported = 0;
  transaction(() => {
    for (const el of elements) {
      const t = el.tags || {};
      const slug = categoryFor(t) || fallbackSlug;
      if (!slug || !catIds[slug] || !t.name) continue;
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (elLat == null) continue;

      const osmId = `${el.type}/${el.id}`;
      const phone = (t.phone || t['contact:phone'] || t['contact:mobile'] || '').split(';')[0].trim();
      const area = t['addr:suburb'] || t['addr:neighbourhood'] || t['addr:place'] || t['addr:street'] || place.area;
      const city = t['addr:city'] || place.city;
      const street = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(', ');
      const address = [...new Set([street, area, city].filter(Boolean))].join(', ') || `${place.area || 'Near you'}, ${city}`;
      const extra = t.description ? ` ${t.description}` : '';
      const description = `${t.name} is a ${KIND[slug] || 'place'} in ${area || city}.${extra}`;

      upsert.run(
        catIds[slug], t.name, description, phone, phone || null, t.email || t['contact:email'] || null,
        t.website || t['contact:website'] || null, address, area || '', city, elLat, elLng,
        JSON.stringify(parseHours(t.opening_hours)), JSON.stringify(servicesFrom(t)), osmId,
      );
      imported++;
      const photo = photoFromTags(t);
      if (photo) photos[osmId] = photo;
      else if (/^Q\d+$/.test(t.wikidata || '')) wikidata[t.wikidata] = osmId;
    }
  });

  // Add real photos (never replaces photos an owner uploaded)
  const fromWikidata = await wikidataPhotos(Object.keys(wikidata));
  for (const [q, url] of Object.entries(fromWikidata)) photos[wikidata[q]] = url;
  // Links typed into OpenStreetMap by hand are often dead — keep only ones that really return an image
  await Promise.all(Object.entries(photos).map(async ([osmId, url]) => {
    if (url.startsWith('https://commons.wikimedia.org/')) return;
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: HEADERS, signal: AbortSignal.timeout(5000) });
      if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image/')) delete photos[osmId];
    } catch {
      delete photos[osmId];
    }
  }));
  const setPhoto = db.prepare(`UPDATE businesses SET photos = ? WHERE osm_id = ? AND owner_id IS NULL AND photos = '[]'`);
  for (const [osmId, url] of Object.entries(photos)) setPhoto.run(JSON.stringify([url]), osmId);

  return imported;
}

function cached(key) {
  return db.prepare(`SELECT found FROM synced_areas WHERE area_key = ? AND synced_at > datetime('now', ?)`)
    .get(key, `-${RESYNC_HOURS} hours`);
}
function remember(key, found) {
  db.prepare(`INSERT INTO synced_areas (area_key, found) VALUES (?, ?)
    ON CONFLICT(area_key) DO UPDATE SET synced_at = datetime('now'), found = excluded.found`).run(key, found);
}

/**
 * Downloads real businesses within `radius` metres of lat/lng and saves them.
 * Returns { imported, cached, area } — cached=true when this area was fetched recently.
 */
export async function syncNearby(lat, lng, radius = 2000) {
  // Round to ~1 km grid so nearby requests share the same cache entry
  const areaKey = `${lat.toFixed(2)},${lng.toFixed(2)},${radius}`;
  const recent = cached(areaKey);
  if (recent) return { imported: recent.found, cached: true };

  const [data, place] = await Promise.all([overpass(buildQuery(lat, lng, radius)), placeName(lat, lng)]);
  const imported = await importElements(data.elements || [], place);
  remember(areaKey, imported);
  return { imported, cached: false, area: place };
}

// Kinds of OpenStreetMap results that are real places (not roads, cities or borders)
const PLACE_CLASSES = new Set(['amenity', 'shop', 'tourism', 'leisure', 'office', 'craft', 'healthcare', 'historic', 'club']);

/**
 * Finds any place by NAME anywhere in India (e.g. "Graphic Era University") using OpenStreetMap search,
 * and saves the matches. Used when our own database has few results for a search.
 */
export async function searchByName(q, { lat, lng, city } = {}) {
  const key = `q:${q.toLowerCase().trim()}|${city || ''}|${lat ? `${(+lat).toFixed(1)},${(+lng).toFixed(1)}` : ''}`;
  if (cached(key)) return 0;

  const params = new URLSearchParams({
    format: 'jsonv2', q: city ? `${q}, ${city}` : q, limit: '15', extratags: '1', addressdetails: '1', countrycodes: 'in',
  });
  if (lat && lng) params.set('viewbox', `${+lng - 0.4},${+lat + 0.4},${+lng + 0.4},${+lat - 0.4}`); // prefer results near the user
  const results = await fetchJson(`https://nominatim.openstreetmap.org/search?${params}`);

  const elements = results
    .filter((r) => PLACE_CLASSES.has(r.category) && (r.name || r.display_name))
    .map((r) => {
      const a = r.address || {};
      return {
        type: r.osm_type, id: r.osm_id, lat: +r.lat, lon: +r.lon,
        tags: {
          ...(r.extratags || {}),
          name: r.name || r.display_name.split(',')[0],
          [r.category]: r.type,
          'addr:street': a.road, 'addr:suburb': a.suburb || a.neighbourhood || a.village,
          'addr:city': a.city || a.town || a.state_district || a.county,
        },
      };
    });
  const imported = await importElements(elements, { area: '', city: city || 'India' }, 'places');
  remember(key, imported);
  return imported;
}
