import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Building2, Check, Clock, Inbox, LayoutGrid, MessageSquareText, Plus, Star, Trash2, Users, X } from 'lucide-react';
import { api, qs } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { Cover } from '../components/BusinessCard';
import { RatingBadge } from '../components/Stars';
import { CategoryIcon, ICON_NAMES, inkOn } from '../utils';

const PALETTE = ['#FFC567', '#FB7DA8', '#FD5A46', '#552CB7', '#00995E', '#058CD7'];

function BarChart({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="chart">
      {rows.map((r, i) => (
        <div key={r.name} className="bar-row">
          <span className="bar-label">{r.name}</span>
          <div className="bar"><div style={{ width: `${(r.count / max) * 100}%`, background: r.color || PALETTE[i % PALETTE.length] }} /></div>
          <span className="bar-value">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

function Overview() {
  const [s, setS] = useState(null);
  useEffect(() => { api('/admin/stats').then(setS); }, []);
  if (!s) return <div className="skeleton skeleton-lg" />;
  return (
    <>
      <div className="stat-grid">
        <div className="stat stat-yellow"><Building2 /><div><strong>{s.businesses}</strong><span>Businesses</span></div></div>
        <div className="stat stat-pink"><Clock /><div><strong>{s.pending}</strong><span>Pending approval</span></div></div>
        <div className="stat stat-blue"><Users /><div><strong>{s.users}</strong><span>Users</span></div></div>
        <div className="stat stat-green"><MessageSquareText /><div><strong>{s.reviews}</strong><span>Reviews</span></div></div>
        <div className="stat stat-purple"><Inbox /><div><strong>{s.enquiries}</strong><span>Enquiries</span></div></div>
        <div className="stat stat-red"><LayoutGrid /><div><strong>{s.categories}</strong><span>Categories</span></div></div>
      </div>
      <div className="grid-2">
        <div className="card"><h3>Listings by category</h3><BarChart rows={s.byCategory} /></div>
        <div className="card"><h3>Listings by city</h3><BarChart rows={s.byCity} /></div>
      </div>
    </>
  );
}

function Listings() {
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);

  const load = () => api(`/admin/businesses${qs({ status, q })}`).then(setRows);
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (b, changes, msg) => {
    const updated = await api(`/admin/businesses/${b.id}`, { method: 'PATCH', body: changes });
    setRows(rows.map((r) => (r.id === b.id ? updated : r)));
    toast(msg);
  };
  const remove = async (b) => {
    if (!confirm(`Delete "${b.name}"?`)) return;
    await api(`/businesses/${b.id}`, { method: 'DELETE' });
    setRows(rows.filter((r) => r.id !== b.id));
    toast('Listing deleted');
  };

  return (
    <>
      <div className="toolbar">
        <div className="pill-group">
          {['pending', 'approved', 'featured', 'all'].map((s) => (
            <button key={s} className={`pill ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="inline-search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or city" />
          <button className="btn btn-outline btn-sm">Search</button>
        </form>
      </div>
      {!rows ? <div className="skeleton" /> : rows.length === 0 ? (
        <div className="empty"><Check size={48} /><h3>Nothing here</h3><p className="muted">No listings match this filter.</p></div>
      ) : (
        <div className="manage-list">
          {rows.map((b) => (
            <div key={b.id} className="manage-row">
              <Cover business={b} className="thumb" />
              <div className="manage-info">
                <Link to={`/business/${b.id}`}><strong>{b.name}</strong></Link>
                <span className="muted small">{b.category_name} · {[b.area, b.city].filter(Boolean).join(", ")}{b.phone && ` · ${b.phone}`}</span>
                <div className="manage-meta">
                  <span className={`status ${b.is_approved ? 'status-live' : 'status-pending'}`}>{b.is_approved ? 'Live' : 'Pending'}</span>
                  {b.is_featured && <span className="status status-featured">Featured</span>}
                  {b.is_verified && <span className="status status-verified">Verified</span>}
                  <RatingBadge rating={b.rating} count={b.review_count} size="sm" />
                </div>
              </div>
              <div className="manage-actions wrap">
                {b.is_approved
                  ? <button className="btn btn-outline btn-sm" onClick={() => patch(b, { is_approved: false }, 'Listing hidden')}><X size={15} /> Unpublish</button>
                  : <button className="btn btn-call btn-sm" onClick={() => patch(b, { is_approved: true }, 'Listing approved')}><Check size={15} /> Approve</button>}
                <button className="btn btn-outline btn-sm" onClick={() => patch(b, { is_featured: !b.is_featured }, b.is_featured ? 'Removed from featured' : 'Marked as featured')}>
                  <Star size={15} /> {b.is_featured ? 'Unfeature' : 'Feature'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => patch(b, { is_verified: !b.is_verified }, b.is_verified ? 'Verification removed' : 'Marked as verified')}>
                  <BadgeCheck size={15} /> {b.is_verified ? 'Unverify' : 'Verify'}
                </button>
                <button className="btn btn-outline btn-sm danger" onClick={() => remove(b)} aria-label="Delete"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function UsersTab() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  useEffect(() => { api('/admin/users').then(setRows); }, []);
  const remove = async (u) => {
    if (!confirm(`Delete user ${u.name}? Their reviews will also be removed.`)) return;
    await api(`/admin/users/${u.id}`, { method: 'DELETE' });
    setRows(rows.filter((r) => r.id !== u.id));
    toast('User deleted');
  };
  if (!rows) return <div className="skeleton" />;
  return (
    <div className="table-wrap card">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Listings</th><th>Reviews</th><th></th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td><strong>{u.name}</strong></td>
              <td className="muted">{u.email}</td>
              <td><span className={`status status-role-${u.role}`}>{u.role}</span></td>
              <td>{u.listings}</td>
              <td>{u.reviews}</td>
              <td>{u.id !== me.id && <button className="icon-btn danger" onClick={() => remove(u)} aria-label="Delete user"><Trash2 size={16} /></button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Categories() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ name: '', icon: 'Store', color: PALETTE[0], keywords: '' });
  const load = () => api('/categories').then(setRows);
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/categories', { method: 'POST', body: form });
      toast('Category added');
      setForm({ ...form, name: '', keywords: '' });
      load();
    } catch (err) { toast(err.message, 'error'); }
  };
  const remove = async (c) => {
    try {
      await api(`/admin/categories/${c.id}`, { method: 'DELETE' });
      toast('Category deleted');
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className="grid-2 align-start">
      <form className="card form" onSubmit={add}>
        <h3>Add category</h3>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label>Search keywords<input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="e.g. tailor stitching boutique" /></label>
        <label>Icon
          <select value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })}>
            {ICON_NAMES.map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label>Colour</label>
        <div className="swatches">
          {PALETTE.map((c) => (
            <button type="button" key={c} className={form.color === c ? 'active' : ''} style={{ background: c }} onClick={() => setForm({ ...form, color: c })} aria-label={c} />
          ))}
        </div>
        <button className="btn btn-primary"><Plus size={16} /> Add category</button>
      </form>
      <div className="card">
        <h3>All categories</h3>
        <ul className="cat-list">
          {rows.map((c) => (
            <li key={c.id}>
              <span className="category-icon sm" style={{ background: c.color, color: inkOn(c.color) }}><CategoryIcon name={c.icon} size={18} /></span>
              <span>{c.name}</span>
              <span className="muted small">{c.count}</span>
              <button className="icon-btn danger" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('overview');
  const tabs = [['overview', 'Overview'], ['listings', 'Listings'], ['users', 'Users'], ['categories', 'Categories']];
  return (
    <div className="container page">
      <div className="page-head">
        <div><h1>Admin panel</h1><p className="muted">Approve listings, manage users and categories.</p></div>
      </div>
      <div className="tabs">
        {tabs.map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'listings' && <Listings />}
      {tab === 'users' && <UsersTab />}
      {tab === 'categories' && <Categories />}
    </div>
  );
}
