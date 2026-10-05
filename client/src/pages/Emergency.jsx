import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ambulance, Flame, Landmark, LocateFixed, Navigation, Phone, Pill, ShieldAlert, Siren, Stethoscope } from 'lucide-react';
import { api, qs } from '../api';
import { useToast } from '../components/Toast';
import { HoursLine } from '../components/BusinessCard';
import { directionsLink, findNearby, formatDistance, getSavedLocation, telLink } from '../utils';

const HELPLINES = [
  ['112', 'Emergency', ShieldAlert],
  ['108', 'Ambulance', Ambulance],
  ['100', 'Police', Siren],
  ['101', 'Fire', Flame],
  ['1091', 'Women Helpline', Phone],
];

const SECTIONS = [
  { key: 'doctors', title: 'Hospitals & clinics', icon: Stethoscope, q: '' },
  { key: 'pharmacy', title: 'Pharmacies', icon: Pill, q: '' },
  { key: 'banks', title: 'ATMs & banks', icon: Landmark, q: '' },
];

// One tap: nearest hospitals, pharmacies and ATMs from real map data + helpline numbers
export default function Emergency() {
  const toast = useToast();
  const [loc, setLoc] = useState(getSavedLocation());
  const [lists, setLists] = useState({});
  const [locating, setLocating] = useState(false);

  const locate = async () => {
    setLocating(true);
    try {
      const r = await findNearby();
      setLoc([...r.loc]);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => { if (!loc) locate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!loc) return;
    SECTIONS.forEach((s) => {
      api(`/businesses${qs({ category: s.key, lat: loc[0], lng: loc[1], sort: 'distance', maxKm: 10, limit: 4 })}`)
        .then((d) => setLists((prev) => ({ ...prev, [s.key]: d.results })))
        .catch(() => {});
    });
  }, [loc]);

  return (
    <div className="container page emergency">
      <div className="sos-head">
        <Siren size={34} />
        <div>
          <h1>Emergency help near you</h1>
          <p>Nearest hospitals, pharmacies and ATMs from live map data — with directions.</p>
        </div>
      </div>

      <div className="helplines">
        {HELPLINES.map(([num, label, Icon]) => (
          <a key={num} href={`tel:${num}`} className="helpline">
            <Icon size={22} />
            <strong>{num}</strong>
            <span>{label}</span>
          </a>
        ))}
      </div>

      {!loc && (
        <div className="empty">
          <LocateFixed size={48} />
          <h3>We need your location</h3>
          <p className="muted">To show the closest help, allow location access.</p>
          <button className="btn btn-accent" onClick={locate} disabled={locating}>{locating ? 'Locating…' : 'Turn on location'}</button>
        </div>
      )}

      {loc && SECTIONS.map(({ key, title, icon: Icon }) => (
        <section key={key} className="section">
          <div className="section-head">
            <h2><Icon size={22} className="inline-icon" /> {title}</h2>
            <Link className="link" to={`/search${qs({ category: key, lat: loc[0], lng: loc[1], sort: 'distance', maxKm: 5 })}`}>See all</Link>
          </div>
          {!lists[key] ? <div className="skeleton" style={{ height: 90 }} /> : lists[key].length === 0 ? (
            <p className="muted">Nothing found within 10 km.</p>
          ) : (
            <div className="sos-list">
              {lists[key].map((b) => (
                <div key={b.id} className="sos-row">
                  <div className="sos-info">
                    <Link to={`/business/${b.id}`}><strong>{b.name}</strong></Link>
                    <span className="muted small">{formatDistance(b.distance)} · {b.area || b.city}</span>
                    <HoursLine hours={b.hours} />
                  </div>
                  <div className="sos-actions">
                    {b.phone && <a className="btn btn-call btn-sm" href={telLink(b.phone)}><Phone size={15} /> Call</a>}
                    <a className="btn btn-outline btn-sm" href={directionsLink(b)} target="_blank" rel="noreferrer"><Navigation size={15} /> Go</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
