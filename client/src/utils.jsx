import {
  AirVent, BedDouble, Car, Dumbbell, GraduationCap, Landmark, MapPin, Pill, School, ShoppingCart, Sparkles, Stethoscope, Store, Truck,
  Utensils, Wrench, Zap,
} from 'lucide-react';
import { api } from './api';
import CATEGORY_IMAGES from './data/categoryImages.json';

const ICONS = {
  AirVent, BedDouble, Car, Dumbbell, GraduationCap, Landmark, MapPin, Pill, School, ShoppingCart, Sparkles, Stethoscope, Store, Truck,
  Utensils, Wrench, Zap,
};

// Stock photo for a business without its own photos (same business always gets the same photo)
export function categoryImage(business) {
  const list = CATEGORY_IMAGES[business.category_slug];
  return list?.length ? `/img/${list[business.id % list.length]}` : null;
}
export const ICON_NAMES = Object.keys(ICONS);

// Dark palette colours get a white icon, light ones a black icon
const DARK = ['#552cb7', '#058cd7', '#00995e', '#fd5a46'];
export const inkOn = (bg = '') => (DARK.includes(bg.toLowerCase()) ? '#fff' : '#141414');

export function CategoryIcon({ name, size = 22, ...props }) {
  const Icon = ICONS[name] || Store;
  return <Icon size={size} {...props} />;
}

export const DAYS = [
  ['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun'],
];

const to12h = (t) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export function hoursText(hours) {
  if (!hours) return '';
  if (hours.open === '00:00' && hours.close === '23:59') return 'Open 24 hours';
  return `${to12h(hours.open)} – ${to12h(hours.close)}`;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_NAMES = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };

// JustDial-style timing line: "Open 24 Hrs", "Open until 9:00 PM", "Opens at 9:00 AM tomorrow"…
export function hoursStatus(hours, now = new Date()) {
  if (!hours || hours.unknown) return null;
  if (hours.open === '00:00' && hours.close === '23:59' && !hours.closed?.length) return { text: 'Open 24 Hrs', open: true };
  const today = DAY_KEYS[now.getDay()];
  const hhmm = now.toTimeString().slice(0, 5);
  const closedToday = hours.closed?.includes(today);
  if (!closedToday && hours.open <= hhmm && hhmm <= hours.close) {
    const [h, m] = hours.close.split(':').map(Number);
    const minsLeft = h * 60 + m - (now.getHours() * 60 + now.getMinutes());
    return minsLeft <= 60
      ? { text: `Closes soon · ${to12h(hours.close)}`, open: true, soon: true }
      : { text: `Open until ${to12h(hours.close)}`, open: true };
  }
  if (!closedToday && hhmm < hours.open) return { text: `Opens at ${to12h(hours.open)} today`, open: false };
  for (let i = 1; i <= 7; i++) {
    const day = DAY_KEYS[(now.getDay() + i) % 7];
    if (!hours.closed?.includes(day)) {
      return { text: `Opens at ${to12h(hours.open)} ${i === 1 ? 'tomorrow' : `on ${DAY_NAMES[day]}`}`, open: false };
    }
  }
  return { text: 'Closed', open: false };
}

export function closedDaysText(hours) {
  if (!hours?.closed?.length) return 'Open all days';
  return 'Closed on ' + hours.closed.map((d) => DAYS.find(([k]) => k === d)?.[1]).join(', ');
}

export function timeAgo(dateStr) {
  const date = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'));
  const s = Math.max(1, Math.floor((Date.now() - date) / 1000));
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, secs] of units) {
    const n = Math.floor(s / secs);
    if (n >= 1) return `${n} ${u}${n > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export const initials = (name = '') => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export const telLink = (phone) => `tel:${phone.replace(/\s/g, '')}`;
export const waLink = (phone, text = '') =>
  `https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const directionsLink = (b) =>
  b.lat != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`;

// Browser geolocation wrapped in a promise
export function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not supported on this device.'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([+pos.coords.latitude.toFixed(5), +pos.coords.longitude.toFixed(5)]),
      () => reject(new Error('Could not get your location. Please allow location access.')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

// Last known location of the user: [lat, lng] or null
export function getSavedLocation() {
  try { return JSON.parse(localStorage.getItem('lk_loc')) || null; } catch { return null; }
}
export function saveLocation(loc) {
  try { localStorage.setItem('lk_loc', JSON.stringify(loc)); } catch { /* ignore */ }
}

// Get the user's location and load REAL businesses around it from OpenStreetMap
export async function findNearby() {
  const loc = await getLocation();
  saveLocation(loc);
  try {
    const result = await api('/nearby', { method: 'POST', body: { lat: loc[0], lng: loc[1] } });
    if (result.area) savePlace([result.area.area, result.area.city].filter(Boolean).join(', '));
    return { loc, ...result, message: result.imported ? `Found ${result.imported} real places around you!` : 'Showing places around you' };
  } catch {
    // Live map data is slow right now — still show what we already have near this location
    return { loc, imported: 0, failed: true, message: 'Live map data is busy, showing saved places near you' };
  }
}

export function getSavedPlace() {
  try { return localStorage.getItem('lk_place') || ''; } catch { return ''; }
}
function savePlace(place) {
  try { localStorage.setItem('lk_place', place); } catch { /* ignore */ }
}

export const NEAR_KM = 3;

// 0.08 → "80 m", 2.4 → "2.4 km"
export const formatDistance = (km) => (km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} m` : `${km.toFixed(1)} km`);

// Average walking speed ~4.8 km/h → "6 min walk" (only shown when it's walkable)
export const walkTime = (km) => (km <= 2.5 ? `${Math.max(1, Math.round((km / 4.8) * 60))} min walk` : null);

// "Rajpur Road, Dehradun" without stray commas when the area is unknown
export const placeLine = (b) => [b.area, b.city].filter(Boolean).join(', ');

export function getSavedCity() {
  try { return localStorage.getItem('lk_city') || ''; } catch { return ''; }
}
export function saveCity(city) {
  try { localStorage.setItem('lk_city', city); } catch { /* ignore */ }
}
