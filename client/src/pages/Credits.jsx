import { useEffect, useState } from 'react';
import { BRAND } from '../config';

// Attribution for the Creative Commons photos and OpenStreetMap data used in the app
export default function Credits() {
  const [credits, setCredits] = useState(null);
  useEffect(() => {
    fetch('/img/credits.json').then((r) => r.json()).then(setCredits).catch(() => setCredits({}));
  }, []);

  return (
    <div className="container page narrow">
      <h1>Photo & data credits</h1>
      <div className="card">
        <h3>Business data</h3>
        <p>
          Real businesses shown near you come from <a className="link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          © OpenStreetMap contributors</a>, available under the Open Database License (ODbL). Maps by OpenStreetMap.
        </p>
        <p>
          Real places without their own photo show a satellite view of their exact location — imagery © Esri, Maxar, Earthstar Geographics.
          Photos of well-known places come from Wikimedia Commons via Wikidata.
        </p>
        <p className="muted small">{BRAND.name} is a college project. Sample listings with “Shop No.” addresses are demo data.</p>
      </div>
      <div className="card">
        <h3>Category photos</h3>
        <p className="muted small">Creative Commons photos found through Openverse. Businesses without their own photos show a representative photo.</p>
        {!credits ? <div className="skeleton" /> : (
          <ul className="credit-list">
            {Object.entries(credits).filter(([k]) => k !== '_rejected').flatMap(([, items]) => items).map((c) => (
              <li key={c.file}>
                <img src={`/img/${c.file}`} alt="" loading="lazy" />
                <span>
                  <a href={c.source} target="_blank" rel="noreferrer">“{c.title || 'Untitled'}”</a> by {c.creator || 'unknown'} ·{' '}
                  CC {c.license?.toUpperCase()} {c.license_version}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
