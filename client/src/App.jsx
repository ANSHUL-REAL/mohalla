import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { API_BASE, IS_APP, pingServer } from './api';
import { AuthProvider, useAuth } from './auth';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';
import Home from './pages/Home';
import Search from './pages/Search';
import BusinessDetail from './pages/BusinessDetail';
import { Login, Register } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import BusinessForm from './pages/BusinessForm';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Credits from './pages/Credits';
import Emergency from './pages/Emergency';
import ServerSetup from './pages/ServerSetup';

// Only lets logged-in users (optionally with certain roles) see a page
function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="container"><div className="skeleton skeleton-lg" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="container empty">
        <h2>Business account needed</h2>
        <p className="muted">This page is for business owners. Create a business account to list your business.</p>
        <Link to="/" className="btn btn-primary">Go home</Link>
      </div>
    );
  }
  return children;
}

function NotFound() {
  return (
    <div className="container empty">
      <h1 className="big-404">404</h1>
      <h2>Page not found</h2>
      <Link to="/" className="btn btn-primary">Back to home</Link>
    </div>
  );
}

// Android app: check the laptop server is reachable before showing the app
function ServerGate({ children }) {
  const [status, setStatus] = useState(IS_APP ? 'checking' : 'ok');
  useEffect(() => {
    if (!IS_APP) return;
    let cancelled = false;
    (API_BASE ? pingServer(API_BASE) : Promise.resolve(false))
      .then((ok) => { if (!cancelled) setStatus(ok ? 'ok' : 'down'); });
    return () => { cancelled = true; };
  }, []);
  if (status === 'checking') return <div className="splash"><img src="/logo.svg" alt="" /><p>Connecting…</p></div>;
  if (status === 'down') return <ServerSetup firstRun />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ServerGate>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="search" element={<Search />} />
              <Route path="business/:id" element={<BusinessDetail />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="dashboard" element={<RequireAuth roles={['business', 'admin']}><Dashboard /></RequireAuth>} />
              <Route path="dashboard/new" element={<RequireAuth roles={['business', 'admin']}><BusinessForm /></RequireAuth>} />
              <Route path="dashboard/edit/:id" element={<RequireAuth roles={['business', 'admin']}><BusinessForm /></RequireAuth>} />
              <Route path="admin" element={<RequireAuth roles={['admin']}><Admin /></RequireAuth>} />
              <Route path="credits" element={<Credits />} />
              <Route path="emergency" element={<Emergency />} />
              <Route path="server" element={<ServerSetup />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
      </ServerGate>
    </BrowserRouter>
  );
}
