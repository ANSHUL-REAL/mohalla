import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LocateFixed, MapPin, MessageSquareText, Navigation, PhoneCall, Search, Siren, Sparkles, Star, Store } from 'lucide-react';
import { SMART_EXAMPLES } from '../smartAsk';
import { api, qs } from '../api';
import SearchBar from '../components/SearchBar';
import { BusinessTile } from '../components/BusinessCard';
import { CategoryIcon, findNearby, getSavedCity, getSavedLocation, inkOn, NEAR_KM } from '../utils';
import { useToast } from '../components/Toast';
import { announceNearby } from '../components/LocationPrompt';
import { BRAND } from '../config';
import CATEGORY_IMAGES from '../data/categoryImages.json';

const img = (slug, i = 0) => `/img/${CATEGORY_IMAGES[slug][i % CATEGORY_IMAGES[slug].length]}`;

// Big coloured service banners (like JustDial's B2B / Repairs / Doctors tiles)
const BANNERS = [
  { title: 'Home Services', sub: 'Plumbers, electricians & AC repair', cta: 'Get nearest vendor', color: 'var(--blue)', image: img('plumbers', 4), q: 'home repair', category: 'plumbers' },
  { title: 'Doctors', sub: 'Clinics, dentists & hospitals', cta: 'Find a doctor', color: 'var(--red)', image: img('doctors', 4), category: 'doctors' },
  { title: 'Eat Out', sub: 'Restaurants, cafes & sweets', cta: 'Explore food', color: 'var(--purple)', image: img('restaurants', 1), category: 'restaurants' },
  { title: 'Daily Needs', sub: 'Grocery, pharmacy & ATMs', cta: 'Shop nearby', color: 'var(--green)', image: img('grocery', 0), category: 'grocery' },
];

const TRENDING = [
  { label: 'AC Repair & Services', category: 'ac-repair', image: img('ac-repair', 5) },
  { label: 'Gyms & Fitness', category: 'gyms', image: img('gyms', 3) },
  { label: 'Beauty Parlours', category: 'beauty-spa', image: img('beauty-spa', 3) },
  { label: 'Packers & Movers', category: 'packers-movers', image: img('packers-movers', 1) },
  { label: 'Coaching Classes', category: 'coaching', image: img('coaching', 0) },
  { label: 'Car Service', category: 'car-repair', image: img('car-repair', 1) },
  { label: 'Hotels & Stays', category: 'hotels', image: img('hotels', 2) },
  { label: 'Pharmacies', category: 'pharmacy', image: img('pharmacy', 1) },
];

const POPULAR_SEARCHES = ['Dentist', 'Biryani', 'Pizza', 'Haircut', 'JEE Coaching', 'Water Tank Cleaning', 'Inverter Installation', 'Bridal Makeup', 'House Shifting', 'ATM'];

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [cities, setCities] = useState([]);
  const [stats, setStats] = useState(null);
  const city = getSavedCity();
  const toast = useToast();
  const [loc, setLoc] = useState(getSavedLocation());
  const [nearby, setNearby] = useState([]);
  const [nearTotal, setNearTotal] = useState(0);
  const [locating, setLocating] = useState(false);

  // With location on, links search around the user; otherwise in the chosen city
  const where = loc ? { lat: loc[0], lng: loc[1], sort: 'distance', maxKm: NEAR_KM } : { city };

  // Reload "Near you" whenever new nearby data arrives (from the location pop-up or button)
  useEffect(() => {
    const onNearby = () => setLoc(getSavedLocation());
    window.addEventListener('mohalla:nearby', onNearby);
    return () => window.removeEventListener('mohalla:nearby', onNearby);
  }, []);

  useEffect(() => {
    if (!loc) return;
    api(`/businesses${qs({ lat: loc[0], lng: loc[1], sort: 'distance', maxKm: NEAR_KM, limit: 12 })}`)
      .then((d) => { setNearby(d.results); setNearTotal(d.total); })
      .catch(() => {});
  }, [loc]);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const r = await findNearby();
      toast(r.message);
      setLoc([...r.loc]);
      announceNearby();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    api('/categories').then(setCategories).catch(() => {});
    api('/cities').then(setCities).catch(() => {});
    api('/stats').then(setStats).catch(() => {});
    api(`/businesses${qs({ featured: 1, limit: 8, city })}`).then((d) => setFeatured(d.results)).catch(() => {});
    api(`/businesses${qs({ sort: 'rating', limit: 8, city })}`).then((d) => setTopRated(d.results)).catch(() => {});
  }, [city]);

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>Everything in your <span>mohalla</span>, one tap away</h1>
          <p className="hero-sub">Find real shops, doctors, plumbers, restaurants and salons near you — with ratings, timings and instant contact.</p>
          <SearchBar large />
          <div className="hero-actions">
            <button className="btn btn-accent" onClick={useMyLocation} disabled={locating}>
              <LocateFixed size={18} /> {locating ? 'Finding places near you…' : loc ? 'Refresh places near me' : 'Show places near me'}
            </button>
            <Link to="/emergency" className="btn btn-sos"><Siren size={18} /> Emergency</Link>
          </div>
          <div className="hero-popular">
            <span><Sparkles size={15} /> Try asking:</span>
            {SMART_EXAMPLES.slice(0, 3).map((t) => (
              <button key={t} type="button" onClick={() => document.dispatchEvent(new CustomEvent('mohalla:ask', { detail: t }))}>“{t}”</button>
            ))}
          </div>
        </div>
      </section>

      <section className="container banners">
        {BANNERS.map((b) => (
          <Link key={b.title} to={`/search${qs({ category: b.category, ...where })}`} className="banner" style={{ background: b.color }}>
            <div className="banner-text">
              <h3>{b.title}</h3>
              <p>{b.sub}</p>
              <span className="banner-cta">{b.cta} <ArrowRight size={14} /></span>
            </div>
            <img src={b.image} alt="" loading="lazy" />
          </Link>
        ))}
      </section>

      <section className="container section">
        <div className="section-head">
          <h2>Browse categories</h2>
          <Link to="/search" className="link">View all <ArrowRight size={16} /></Link>
        </div>
        <div className="category-grid">
          {categories.map((c) => (
            <Link key={c.id} to={`/search${qs({ category: c.slug, ...where })}`} className="category-card">
              <span className="category-icon" style={{ background: c.color, color: inkOn(c.color) }}>
                <CategoryIcon name={c.icon} size={26} />
              </span>
              <span className="category-name">{c.name}</span>
              <span className="muted small">{loc ? 'Near you' : `${c.count} listings`}</span>
            </Link>
          ))}
        </div>
      </section>

      {loc && nearby.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <h2><Navigation size={22} className="inline-icon" /> Near you</h2>
            <Link to={`/search${qs(where)}`} className="link">See all {nearTotal} <ArrowRight size={16} /></Link>
          </div>
          <div className="tile-grid">{nearby.map((b) => <BusinessTile key={b.id} business={b} />)}</div>
        </section>
      )}

      <section className="container section">
        <div className="section-head">
          <h2>Trending searches {loc ? 'near you' : city ? `in ${city}` : ''}</h2>
          <span className="tag static tag-new">New</span>
        </div>
        <div className="trend-row">
          {TRENDING.map((t) => (
            <Link key={t.label} to={`/search${qs({ category: t.category, ...where })}`} className="trend-card">
              <img src={t.image} alt="" loading="lazy" />
              <strong>{t.label}</strong>
              <span className="link small">Explore <ArrowRight size={13} /></span>
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="container section">
          <div className="section-head">
            <h2>Featured {city ? `in ${city}` : 'businesses'}</h2>
            <Link to={`/search${qs({ city, featured: 1 })}`} className="link">See more <ArrowRight size={16} /></Link>
          </div>
          <div className="tile-grid">{featured.map((b) => <BusinessTile key={b.id} business={b} />)}</div>
        </section>
      )}

      <section className="container section">
        <div className="section-head">
          <h2>Top rated {city ? `in ${city}` : ''}</h2>
          <Link to={`/search${qs({ city, sort: 'rating' })}`} className="link">See more <ArrowRight size={16} /></Link>
        </div>
        <div className="tile-grid">{topRated.map((b) => <BusinessTile key={b.id} business={b} />)}</div>
      </section>

      <section className="container section">
        <h2>How {BRAND.name} works</h2>
        <div className="steps">
          <div className="step"><Search /><h4>1. Search</h4><p className="muted">Type what you need and pick your city or use your location.</p></div>
          <div className="step"><Star /><h4>2. Compare</h4><p className="muted">Check ratings, reviews, timings, services and photos.</p></div>
          <div className="step"><PhoneCall /><h4>3. Connect</h4><p className="muted">Call, WhatsApp or send an enquiry to get the best price.</p></div>
          <div className="step"><MessageSquareText /><h4>4. Review</h4><p className="muted">Share your experience to help others choose better.</p></div>
        </div>
      </section>

      <section className="container section">
        <h2>Popular searches</h2>
        <div className="city-row">
          {POPULAR_SEARCHES.map((q) => (
            <Link key={q} to={`/search${qs({ q, ...where })}`} className="city-chip"><Search size={15} /> {q}</Link>
          ))}
        </div>
      </section>

      <section className="container section">
        <h2>Popular cities</h2>
        <div className="city-row">
          {cities.map((c) => (
            <Link key={c.name} to={`/search${qs({ city: c.name })}`} className="city-chip">
              <MapPin size={16} /> {c.name} <span className="muted small">{c.count}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="cta">
          <div>
            <h2>Own a business? Get discovered by customers nearby.</h2>
            <p>Create a free listing, receive enquiries and grow with genuine reviews.</p>
          </div>
          <Link to="/register?role=business" className="btn btn-accent btn-lg"><Store size={18} /> List your business — free</Link>
        </div>
      </section>

      {stats && (
        <section className="container section stats-row">
          <div><strong>{stats.businesses}+</strong><span>Businesses</span></div>
          <div><strong>{stats.reviews}+</strong><span>Reviews</span></div>
          <div><strong>{stats.users}+</strong><span>Users</span></div>
          <div><strong>{stats.cities}</strong><span>Cities</span></div>
        </section>
      )}
    </>
  );
}
