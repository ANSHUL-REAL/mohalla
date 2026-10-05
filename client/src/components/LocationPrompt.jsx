import { useEffect, useState } from 'react';
import { LocateFixed, MapPin, X } from 'lucide-react';
import { findNearby, getSavedLocation } from '../utils';
import { useToast } from './Toast';

const DISMISS_KEY = 'lk_loc_prompt';

// Tell the rest of the app (home page, search) that new nearby data is ready
export const announceNearby = () => window.dispatchEvent(new Event('mohalla:nearby'));

/**
 * When the app opens:
 * - first time: asks the user to turn on location
 * - location already allowed: quietly refreshes real businesses around them
 */
export default function LocationPrompt() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = !!sessionStorage.getItem(DISMISS_KEY); } catch { /* ignore */ }

    const refreshQuietly = () => findNearby().then(announceNearby).catch(() => {});

    if (getSavedLocation()) {
      // Only refresh silently if permission was already granted (never pop a browser prompt by surprise)
      navigator.permissions?.query({ name: 'geolocation' })
        .then((p) => { if (p.state === 'granted') refreshQuietly(); })
        .catch(() => {});
      return;
    }
    if (dismissed) return;
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setOpen(false);
  };

  const turnOn = async () => {
    setBusy(true);
    try {
      const r = await findNearby();
      toast(r.message);
      announceNearby();
      setOpen(false);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal location-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="icon-btn close-x" onClick={close} aria-label="Close"><X size={18} /></button>
        <div className="location-art"><MapPin size={44} strokeWidth={2.4} /></div>
        <h2>What’s in your mohalla?</h2>
        <p className="muted">
          Turn on location to see <b>real shops, clinics, restaurants and services</b> around you — sorted by distance.
        </p>
        <button className="btn btn-primary btn-block btn-lg" onClick={turnOn} disabled={busy}>
          <LocateFixed size={20} /> {busy ? 'Finding places near you…' : 'Turn on location'}
        </button>
        <button className="btn btn-ghost btn-block" onClick={close}>Not now</button>
      </div>
    </div>
  );
}
