// Small helper for talking to the Express API.
// On the web the API is on the same server. In the Android app the pages are inside the APK,
// so the app needs the server's address: saved in Server settings, or VITE_API_URL from the build
// (the online server on Render). The key was renamed so laptop addresses saved by older APKs are ignored.
const SERVER_KEY = 'mohalla_server';
export const DEFAULT_SERVER = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export const IS_APP = import.meta.env.VITE_APP === '1';

export function getServerUrl() {
  let saved = null;
  try { saved = localStorage.getItem(SERVER_KEY); } catch { /* storage unavailable */ }
  return (saved || DEFAULT_SERVER).replace(/\/$/, '');
}

// Changing the server reloads the app, so reading it once here is enough
export const API_BASE = getServerUrl();

export function saveServerUrl(url) {
  try {
    // Saving the built-in address just clears the override
    if (url.replace(/\/$/, '') === DEFAULT_SERVER) localStorage.removeItem(SERVER_KEY);
    else localStorage.setItem(SERVER_KEY, url.replace(/\/$/, ''));
  } catch { /* storage unavailable */ }
}

// Tidies what people type: "192.168.1.7" becomes "http://192.168.1.7:5000"
export function normaliseServerUrl(input) {
  let url = input.trim().replace(/\/$/, '');
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
  if (/^http:\/\/[\d.]+$/i.test(url)) url += ':5000';
  return url;
}

// Checks that an address answers like a Mohalla server
export async function pingServer(url, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url + '/api/categories', { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Category photos (/img/...) ship inside the app; uploaded photos come from the server
export const assetUrl = (url) => (!url ? '' : url.startsWith('http') || (IS_APP && url.startsWith('/img/')) ? url : API_BASE + url);

export function getToken() {
  try { return localStorage.getItem('lk_token'); } catch { return null; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem('lk_token', token);
    else localStorage.removeItem('lk_token');
  } catch { /* storage unavailable */ }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { method, headers, body: payload });
  } catch {
    throw new Error(IS_APP
      ? 'Cannot reach the Mohalla server. Check the laptop is on and on the same Wi-Fi (Menu → Server settings).'
      : 'Cannot reach the server. Check your internet connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

// Build a query string, skipping empty values
export const qs = (params) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== '' && v != null && v !== false) p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};
