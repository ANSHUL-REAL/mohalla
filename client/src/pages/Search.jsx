import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BadgeCheck, ChevronRight, Clock, List, LocateFixed, Map as MapIcon, SearchX, SlidersHorizontal, Star, X, Zap,
} from 'lucide-react';
import { api, qs } from '../api';
import SearchBar from '../components/SearchBar';
import BusinessCard from '../components/BusinessCard';
import MapView from '../components/MapView';
import LeadForm from '../components/LeadForm';
import { useToast } from '../components/Toast';
import { useAuth } from '../auth';
import { findNearby, getSavedLocation, NEAR_KM } from '../utils';
import { smartAsk } from '../smartAsk';
import { Sparkles } from 'lucide-react';

const SORTS = [
  ['relevance', 'Relevance'], ['rating', 'Top rated'], ['reviews', 'Most reviewed'], ['distance', 'Nearest'], ['newest', 'Newest'],
];

export default function Search() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState({ results: [], total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [view, setView] = useState('list');
  const [showFilters, setShowFilters] = useState(false);
  const [locating, setLocating] = useState(false);
  const { user } = useAuth();
  const addPlaceLink = user && user.role !== 'user' ? '/dashboard/new' : '/register?role=business';

  const filters = Object.fromEntries(params.entries());
  const key = params.toString();

  useEffect(() => { api('/categories').then(setCategories).catch(() => {}); }, []);

  // A sentence opened as a plain link (?q=need a plumber now) gets the same Smart Ask treatment as the search bar
  useEffect(() => {
    if (!filters.q || filters.ask || filters.category) return;
    const smart = smartAsk(filters.q);
    if (!smart.isSmart) return;
    const loc = smart.near ? getSavedLocation() : null;
    const where = loc ? { lat: loc[0], lng: loc[1], maxKm: smart.params.openNow ? 5 : NEAR_KM } : { city: filters.city };
    navigate(`/search${qs({ ...where, ...smart.params, ask: filters.q })}`, { replace: true });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load first page whenever filters change.
  // If strict filters find nothing, relax them step by step instead of showing an empty page.
  const [relaxed, setRelaxed] = useState([]);
  useEffect(() => {
    setLoading(true);
    setPage(1);
    (async () => {
      let f = { ...filters };
      const dropped = [];
      let d = await api(`/businesses${qs({ ...f, page: 1, limit: 12 })}`);
      for (const k of ['openNow', 'maxKm']) {
        if (d.total > 0 || !f[k]) continue;
        delete f[k];
        dropped.push(k);
        d = await api(`/businesses${qs({ ...f, page: 1, limit: 12 })}`);
      }
      setRelaxed(dropped);
      setData(d);
    })()
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    const next = page + 1;
    const f = { ...filters };
    relaxed.forEach((k) => delete f[k]);
    const d = await api(`/businesses${qs({ ...f, page: next, limit: 12 })}`);
    setData((prev) => ({ ...d, results: [...prev.results, ...d.results] }));
    setPage(next);
  };

  const update = (changes) => {
    const p = new URLSearchParams(params);
    Object.entries(changes).forEach(([k, v]) => (v === '' || v == null ? p.delete(k) : p.set(k, v)));
    setParams(p);
  };
  const toggle = (k, v = '1') => update({ [k]: filters[k] === v ? '' : v });

  const nearMe = async () => {
    setLocating(true);
    try {
      const r = await findNearby();
      update({ lat: r.loc[0], lng: r.loc[1], sort: 'distance', maxKm: filters.maxKm || NEAR_KM, city: '' });
      toast(r.message);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLocating(false);
    }
  };

  const category = categories.find((c) => c.slug === filters.category);
  const what = category?.name || (filters.q ? `“${filters.q}”` : filters.featured ? 'Featured businesses' : 'Businesses');
  const where = filters.lat ? 'near you' : filters.city ? `in ${filters.city}` : 'across India';
  const activeCount = ['category', 'minRating', 'openNow', 'verified', 'quick', 'lat'].filter((k) => filters[k]).length;
  const empty = filters.lat
    ? 'Nothing found this close. Try a bigger distance or a different word.'
    : 'Try a different word, another city or remove some filters.';

  return (
    <div className="container search-page">
      <div className="search-top"><SearchBar initialQuery={filters.q || filters.ask || ''} initialCity={filters.city || ''} /></div>

      {filters.ask && (
        <div className="smart-banner">
          <Sparkles size={20} />
          <div>
            <strong>Smart Ask understood:</strong>
            <div className="chips">
              {category && <span className="chip">{category.name}</span>}
              {filters.openNow && <span className="chip">Open now</span>}
              {filters.sort === 'distance' && <span className="chip">Nearest first</span>}
              {filters.sort === 'rating' && <span className="chip">Top rated</span>}
              {filters.minRating && <span className="chip">{filters.minRating}+ ★</span>}
              {filters.lat && filters.maxKm && <span className="chip">Within {filters.maxKm} km</span>}
            </div>
          </div>
        </div>
      )}

      <nav className="crumbs small" aria-label="Breadcrumb">
        <Link to="/">Home</Link><ChevronRight size={14} />
        {filters.city ? <Link to={`/search${qs({ city: filters.city })}`}>{filters.city}</Link> : <span>{filters.lat ? 'Near you' : 'All cities'}</span>}
        {category && <><ChevronRight size={14} /><span>{category.name}</span></>}
        {!loading && <span className="muted">· {data.total}+ listings</span>}
      </nav>
      <h1 className="results-title">{what} {where}</h1>

      {/* JustDial-style quick filter chips */}
      <div className="chip-bar">
        <label className="chip-select">
          <span>Sort by</span>
          <select value={filters.sort || 'relevance'} onChange={(e) => update({ sort: e.target.value })} aria-label="Sort by">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <button className={`fchip ${filters.sort === 'rating' ? 'on' : ''}`} onClick={() => update({ sort: filters.sort === 'rating' ? '' : 'rating' })}>
          <Star size={15} /> Top Rated
        </button>
        <button className={`fchip ${filters.verified ? 'on' : ''}`} onClick={() => toggle('verified')}><BadgeCheck size={15} /> Verified</button>
        <button className={`fchip ${filters.quick ? 'on' : ''}`} onClick={() => toggle('quick')}><Zap size={15} /> Quick Response</button>
        <button className={`fchip ${filters.openNow ? 'on' : ''}`} onClick={() => toggle('openNow')}><Clock size={15} /> Open Now</button>
        <button className={`fchip ${filters.minRating === '4' ? 'on' : ''}`} onClick={() => toggle('minRating', '4')}>4.0+ ★</button>
        <button className={`fchip fchip-near ${filters.lat ? 'on' : ''}`} onClick={nearMe} disabled={locating}>
          <LocateFixed size={15} /> {locating ? 'Locating…' : 'Near me'}
        </button>
        <button className="fchip show-sm" onClick={() => setShowFilters(true)}>
          <SlidersHorizontal size={15} /> All Filters {activeCount > 0 && `(${activeCount})`}
        </button>
        <div className="seg chip-seg">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} aria-label="List view"><List size={18} /></button>
          <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')} aria-label="Map view"><MapIcon size={18} /></button>
        </div>
      </div>

      <div className="search-layout">
        <aside className={`filters ${showFilters ? 'filters-open' : ''}`}>
          <div className="filters-head">
            <h3>All filters</h3>
            <button className="icon-btn show-sm" onClick={() => setShowFilters(false)} aria-label="Close filters"><X size={20} /></button>
          </div>

          <label className="field-label">Category</label>
          <select value={filters.category || ''} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>

          <label className="field-label">Rating</label>
          <div className="pill-group">
            {[['', 'Any'], ['3', '3+'], ['4', '4+'], ['4.5', '4.5+']].map(([v, l]) => (
              <button key={l} className={`pill ${(filters.minRating || '') === v ? 'active' : ''}`} onClick={() => update({ minRating: v })}>
                {l} {v && '★'}
              </button>
            ))}
          </div>

          {filters.lat && (
            <>
              <label className="field-label">Distance</label>
              <div className="pill-group">
                {[['1', '1 km'], ['3', '3 km'], ['5', '5 km'], ['', 'Any']].map(([v, l]) => (
                  <button key={l} className={`pill ${(filters.maxKm || '') === v ? 'active' : ''}`} onClick={() => update({ maxKm: v })}>{l}</button>
                ))}
              </div>
              <button className="link small" onClick={() => update({ lat: '', lng: '', maxKm: '', sort: '' })}>Clear location</button>
            </>
          )}

          <label className="toggle">
            <input type="checkbox" checked={filters.openNow === '1'} onChange={() => toggle('openNow')} />
            <span>Open now</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={filters.verified === '1'} onChange={() => toggle('verified')} />
            <span>Verified only</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={filters.quick === '1'} onChange={() => toggle('quick')} />
            <span>Quick response</span>
          </label>

          {activeCount > 0 && (
            <button className="btn btn-outline btn-block" onClick={() => navigate(`/search${qs({ q: filters.q, city: filters.city })}`)}>
              Reset all filters
            </button>
          )}
          <button className="btn btn-primary btn-block show-sm" onClick={() => setShowFilters(false)}>Show {data.total} results</button>

          <div className="hide-sm">
            <LeadForm filters={filters} label={category?.name || filters.q || 'businesses'} />
          </div>
        </aside>

        <section className="results">
          {view === 'map' && data.results.length > 0 && (
            <MapView
              height={420}
              points={data.results.map((b) => ({
                id: b.id, lat: b.lat, lng: b.lng, label: b.name,
                sub: `${b.rating || 'New'} ★ · ${b.area || b.city}`, color: b.category_color,
              }))}
              onSelect={(id) => navigate(`/business/${id}`)}
            />
          )}

          {!loading && relaxed.length > 0 && data.total > 0 && (
            <div className="notice relax-notice">
              {relaxed.includes('openNow') ? 'Nobody is open right now — showing the closest places with their next opening time.'
                : `Nothing within ${filters.maxKm} km — showing the nearest places further away.`}
            </div>
          )}
          {loading ? (
            <div className="list">{[1, 2, 3].map((i) => <div key={i} className="skeleton" />)}</div>
          ) : data.results.length === 0 ? (
            <div className="empty">
              <SearchX size={48} />
              <h3>No businesses found</h3>
              <p className="muted">{empty}</p>
              <div className="empty-actions">
                {!filters.lat && <button className="btn btn-accent" onClick={nearMe}><LocateFixed size={16} /> Search near me</button>}
                <Link className="btn btn-outline" to={addPlaceLink}>Can’t find it? Add this place</Link>
              </div>
            </div>
          ) : (
            <div className="list">
              {data.results.map((b, i) => (
                <Fragment key={b.id}>
                  <BusinessCard business={b} />
                  {/* On phones the "get best quotes" form sits inside the list, like JustDial */}
                  {i === 2 && <div className="show-sm-block"><LeadForm filters={filters} label={category?.name || filters.q || 'businesses'} /></div>}
                </Fragment>
              ))}
              {page < data.pages && <button className="btn btn-outline btn-block" onClick={loadMore}>Load more</button>}
              {filters.q && page >= data.pages && (
                <div className="missing-place">
                  <span>Not seeing the place you searched for?</span>
                  <Link className="btn btn-outline btn-sm" to={addPlaceLink}>Add a missing place — free</Link>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
