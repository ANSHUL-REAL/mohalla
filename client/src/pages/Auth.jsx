import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Store, User } from 'lucide-react';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { Logo } from '../components/Layout';

const homeFor = (user) => (user.role === 'admin' ? '/admin' : user.role === 'business' ? '/dashboard' : '/');

export function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(form.email, form.password);
      toast(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(location.state?.from || homeFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <h1>Log in</h1>
        <p className="muted">Welcome back! Log in to save, review and manage listings.</p>
        {error && <div className="alert">{error}</div>}
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" /></label>
        <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required autoComplete="current-password" /></label>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <p className="muted center">New here? <Link to="/register" state={location.state}>Create an account</Link></p>
      </form>
    </div>
  );
}

export function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', role: params.get('role') === 'business' ? 'business' : 'user',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await register(form);
      toast('Account created successfully!');
      navigate(user.role === 'business' ? '/dashboard/new' : location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Logo />
        <h1>Create account</h1>
        <div className="role-picker">
          <button type="button" className={form.role === 'user' ? 'active' : ''} onClick={() => setForm({ ...form, role: 'user' })}>
            <User size={22} /><strong>Customer</strong><span>Find & review businesses</span>
          </button>
          <button type="button" className={form.role === 'business' ? 'active' : ''} onClick={() => setForm({ ...form, role: 'business' })}>
            <Store size={22} /><strong>Business owner</strong><span>List & manage my business</span>
          </button>
        </div>
        {error && <div className="alert">{error}</div>}
        <label>Full name<input value={form.name} onChange={set('name')} required autoComplete="name" /></label>
        <label>Email<input type="email" value={form.email} onChange={set('email')} required autoComplete="email" /></label>
        <label>Mobile number<input value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="+91 98765 43210" autoComplete="tel" /></label>
        <label>Password<input type="password" value={form.password} onChange={set('password')} required minLength={6} autoComplete="new-password" /></label>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="muted center">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
