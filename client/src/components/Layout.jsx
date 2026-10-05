import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Heart, Home, LayoutDashboard, LogOut, MapPin, Plus, Search, Shield, User } from 'lucide-react';
import { useAuth } from '../auth';
import { initials } from '../utils';
import { BRAND } from '../config';
import { IS_APP } from '../api';
import LocationPrompt, { announceNearby } from './LocationPrompt';
import { useToast } from './Toast';
import { findNearby, getSavedLocation, getSavedPlace } from '../utils';

// Header pill showing where results are for; tap to (re)detect location
function LocationPill() {
  const toast = useToast();
  const navigate = useNavigate();
  const [place, setPlace] = useState(getSavedLocation() ? getSavedPlace() || 'Near you' : '');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const onNearby = () => setPlace(getSavedPlace() || 'Near you');
    window.addEventListener('mohalla:nearby', onNearby);
    return () => window.removeEventListener('mohalla:nearby', onNearby);
  }, []);
  const detect = async () => {
    setBusy(true);
    try {
      const r = await findNearby();
      toast(r.message);
      announceNearby();
      navigate(`/search?lat=${r.loc[0]}&lng=${r.loc[1]}&sort=distance&maxKm=3`);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <button className="loc-pill" onClick={detect} disabled={busy} title="Use my location">
      <MapPin size={16} /> <span>{busy ? 'Locating…' : place || 'Set location'}</span>
    </button>
  );
}

export function Logo() {
  return (
    <Link to="/" className="logo">
      <img src="/logo.svg" alt="" width="34" height="34" />
      <span>{BRAND.first}<b>{BRAND.second}</b></span>
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  return (
    <div className="user-menu" ref={ref}>
      <button className="user-menu-btn" onClick={() => setOpen(!open)}>
        <span className="avatar">{initials(user.name)}</span>
        <span className="hide-sm">{user.name.split(' ')[0]}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="dropdown" onClick={() => setOpen(false)}>
          <div className="dropdown-head">
            <strong>{user.name}</strong>
            <span className="muted small">{user.email}</span>
          </div>
          <Link to="/profile"><User size={16} /> My profile</Link>
          {(user.role === 'business' || user.role === 'admin') && (
            <Link to="/dashboard"><LayoutDashboard size={16} /> Business dashboard</Link>
          )}
          {user.role === 'admin' && <Link to="/admin"><Shield size={16} /> Admin panel</Link>}
          <button onClick={() => { logout(); navigate('/'); }}><LogOut size={16} /> Log out</button>
        </div>
      )}
    </div>
  );
}

function Navbar() {
  const { user } = useAuth();
  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Logo />
        <LocationPill />
        <nav className="nav-links hide-sm">
          <NavLink to="/search">Explore</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="nav-actions">
          <Link to={user ? '/dashboard/new' : '/register?role=business'} className="btn btn-accent btn-sm">
            <Plus size={16} /> <span className="hide-sm">List your business</span><span className="show-sm">List</span>
          </Link>
          {/* On phones the bottom tab bar has Login / Account instead */}
          <div className="hide-sm">{user ? <UserMenu /> : <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>}</div>
        </div>
      </div>
    </header>
  );
}

// Android app: link to change the laptop server address, on the Login and Account pages
function AppServerLink() {
  const { pathname } = useLocation();
  if (!IS_APP || !['/login', '/profile'].includes(pathname)) return null;
  return <p className="center small"><Link to="/server" style={{ textDecoration: 'underline', fontWeight: 700 }}>Server settings</Link></p>;
}

// App-style bottom tab bar on phones (also used in the Android app)
function BottomNav() {
  const { user } = useAuth();
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end><Home size={22} /><span>Home</span></NavLink>
      <NavLink to="/search"><Search size={22} /><span>Search</span></NavLink>
      <NavLink to={user ? '/profile?tab=saved' : '/login'}><Heart size={22} /><span>Saved</span></NavLink>
      {user && user.role !== 'user'
        ? <NavLink to={user.role === 'admin' ? '/admin' : '/dashboard'}><LayoutDashboard size={22} /><span>{user.role === 'admin' ? 'Admin' : 'Business'}</span></NavLink>
        : null}
      <NavLink to={user ? '/profile' : '/login'} end><User size={22} /><span>{user ? 'Account' : 'Login'}</span></NavLink>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div>
          <Logo />
          <p className="muted small">Find trusted local businesses, compare ratings and connect instantly.</p>
        </div>
        <div className="footer-links">
          <Link to="/search">Explore businesses</Link>
          <Link to="/register?role=business">List your business</Link>
          <Link to="/login">Log in</Link>
          <Link to="/credits">Photo & data credits</Link>
          {IS_APP && <Link to="/server">Server settings</Link>}
        </div>
      </div>
      <div className="container footer-bottom muted small">© {new Date().getFullYear()} {BRAND.name} · College project</div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="app">
      <Navbar />
      <main className="main"><Outlet /><AppServerLink /></main>
      <Footer />
      <BottomNav />
      <LocationPrompt />
    </div>
  );
}
