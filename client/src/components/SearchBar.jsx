import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, LayoutGrid, MapPin, Search } from 'lucide-react';
import { api, qs } from '../api';
import { findNearby, getSavedCity, getSavedLocation, NEAR_KM, saveCity } from '../utils';
import { smartAsk } from '../smartAsk';

export default function SearchBar({ initialQuery = '', initialCity, large = false }) {
  const navigate = useNavigate();
  const [q, setQ] = useState(initialQuery);
  const [city, setCity] = useState(initialCity ?? getSavedCity());
  const [cities, setCities] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => { api('/cities').then(setCities).catch(() => {}); }, []);
  useEffect(() => { setQ(initialQuery); }, [initialQuery]);
  useEffect(() => { if (initialCity !== undefined) setCity(initialCity); }, [initialCity]);

  // Fetch suggestions as the user types (debounced)
  useEffect(() => {
    if (q.trim().length < 2) { setSuggestions([]); return; }
    const t = setTimeout(() => api(`/suggest${qs({ q })}`).then(setSuggestions).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);

  // Home page "Try asking" examples fill the box and search
  const submitRef = useRef(null);
  useEffect(() => {
    const onAsk = (e) => { setQ(e.detail); setTimeout(() => submitRef.current?.click(), 0); };
    document.addEventListener('mohalla:ask', onAsk);
    return () => document.removeEventListener('mohalla:ask', onAsk);
  }, []);

  useEffect(() => {
    const close = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const go = (params) => {
    setOpen(false);
    navigate(`/search${qs({ city, ...params })}`);
  };

  const submit = async (e) => {
    e.preventDefault();
    const text = q.trim();
    // Smart Ask: turn a normal sentence into filters ("need plumber urgently near me")
    const smart = smartAsk(text);
    if (smart.isSmart) {
      let where = { city };
      if (smart.near) {
        let loc = getSavedLocation();
        if (!loc) { try { loc = (await findNearby()).loc; } catch { loc = null; } }
        if (loc) where = { lat: loc[0], lng: loc[1], maxKm: smart.params.openNow ? 5 : NEAR_KM };
      }
      setOpen(false);
      navigate(`/search${qs({ ...where, ...smart.params, ask: text })}`);
      return;
    }
    go({ q: text });
  };

  const changeCity = (e) => {
    setCity(e.target.value);
    saveCity(e.target.value);
  };

  return (
    <form className={`searchbar ${large ? 'searchbar-lg' : ''}`} onSubmit={submit} ref={boxRef}>
      <div className="searchbar-city">
        <MapPin size={18} />
        <select value={city} onChange={changeCity} aria-label="City">
          <option value="">All cities</option>
          {cities.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </div>
      <div className="searchbar-input">
        <Search size={18} />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={large ? 'Search or ask: “AC not cooling, need help now”' : 'Search or ask anything…'}
          aria-label="Search"
        />
        {open && suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.map((s) => (
              <li key={s.type + (s.id || s.slug)}>
                <button
                  type="button"
                  onClick={() => (s.type === 'category' ? go({ category: s.slug }) : navigate(`/business/${s.id}`))}
                >
                  {s.type === 'category' ? <LayoutGrid size={16} /> : <Building2 size={16} />}
                  <span>{s.label}</span>
                  <small>{s.type === 'category' ? 'Category' : s.sub}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button className="btn btn-primary searchbar-btn" type="submit" ref={submitRef}>
        <Search size={18} /> <span>Search</span>
      </button>
    </form>
  );
}
