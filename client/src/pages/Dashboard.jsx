import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Eye, Inbox, Lock, MessageCircle, MessageSquareText, Pencil, Phone, Plus, Star, Trash2 } from 'lucide-react';
import EnquiryThread from '../components/EnquiryThread';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { Cover } from '../components/BusinessCard';
import { RatingBadge } from '../components/Stars';
import { telLink, timeAgo, waLink } from '../utils';

export default function Dashboard() {
  const toast = useToast();
  const [listings, setListings] = useState(null);
  const [enquiries, setEnquiries] = useState([]);
  const [tab, setTab] = useState('listings');
  const [openThread, setOpenThread] = useState(null);

  const load = () => {
    api('/my/businesses').then(setListings).catch((e) => toast(e.message, 'error'));
    api('/my/enquiries').then(setEnquiries).catch(() => {});
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (b) => {
    if (!confirm(`Delete "${b.name}" permanently?`)) return;
    await api(`/businesses/${b.id}`, { method: 'DELETE' });
    toast('Listing deleted');
    load();
  };

  const setLive = async (b, status) => {
    try {
      const updated = await api(`/businesses/${b.id}/live-status`, { method: 'PATCH', body: { status: b.live_status === status ? null : status } });
      setListings(listings.map((x) => (x.id === b.id ? { ...x, live_status: updated.live_status } : x)));
      toast(updated.live_status ? 'Live status updated — customers see it now' : 'Live status cleared');
    } catch (err) { toast(err.message, 'error'); }
  };

  const setStatus = async (enq, status) => {
    await api(`/enquiries/${enq.id}`, { method: 'PATCH', body: { status } });
    setEnquiries(enquiries.map((e) => (e.id === enq.id ? { ...e, status } : e)));
  };

  if (!listings) return <div className="container"><div className="skeleton skeleton-lg" /></div>;

  const totalViews = listings.reduce((s, b) => s + b.views, 0);
  const rated = listings.filter((b) => b.rating > 0);
  const avgRating = rated.length ? (rated.reduce((s, b) => s + b.rating, 0) / rated.length).toFixed(1) : '–';
  const newEnquiries = enquiries.filter((e) => e.status === 'new').length;

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Business dashboard</h1>
          <p className="muted">Manage your listings and respond to customer enquiries.</p>
        </div>
        <Link to="/dashboard/new" className="btn btn-primary"><Plus size={18} /> Add business</Link>
      </div>

      <div className="stat-grid">
        <div className="stat stat-yellow"><Building2 /><div><strong>{listings.length}</strong><span>Listings</span></div></div>
        <div className="stat stat-pink"><Eye /><div><strong>{totalViews}</strong><span>Total views</span></div></div>
        <div className="stat stat-blue"><Inbox /><div><strong>{enquiries.length}</strong><span>Enquiries ({newEnquiries} new)</span></div></div>
        <div className="stat stat-green"><Star /><div><strong>{avgRating}</strong><span>Average rating</span></div></div>
      </div>

      <div className="tabs">
        <button className={tab === 'listings' ? 'active' : ''} onClick={() => setTab('listings')}>My listings</button>
        <button className={tab === 'enquiries' ? 'active' : ''} onClick={() => setTab('enquiries')}>
          Enquiries {newEnquiries > 0 && <span className="count">{newEnquiries}</span>}
        </button>
      </div>

      {tab === 'listings' && (
        listings.length === 0 ? (
          <div className="empty">
            <Building2 size={48} />
            <h3>You have no listings yet</h3>
            <p className="muted">Add your business so customers can find you.</p>
            <Link to="/dashboard/new" className="btn btn-primary"><Plus size={18} /> Add your first business</Link>
          </div>
        ) : (
          <div className="manage-list">
            {listings.map((b) => (
              <div key={b.id} className="manage-row">
                <Cover business={b} className="thumb" />
                <div className="manage-info">
                  <Link to={`/business/${b.id}`}><strong>{b.name}</strong></Link>
                  <span className="muted small">{b.category_name} · {b.area}, {b.city}</span>
                  <div className="manage-meta">
                    <span className={`status ${b.is_approved ? 'status-live' : 'status-pending'}`}>{b.is_approved ? 'Live' : 'Pending approval'}</span>
                    <RatingBadge rating={b.rating} count={b.review_count} size="sm" />
                    <span className="muted small"><Eye size={13} /> {b.views}</span>
                    {b.enquiry_count > 0 && <span className="muted small"><Inbox size={13} /> {b.enquiry_count} new</span>}
                  </div>
                  {b.is_approved && (
                    <div className="live-setter">
                      <span className="small"><b>Live status:</b></span>
                      {[['available', 'Available now'], ['busy', 'Busy'], ['closed_today', 'Closed today']].map(([k, l]) => (
                        <button key={k} className={`pill live-pill-${k} ${b.live_status === k ? 'active' : ''}`} onClick={() => setLive(b, k)}>{l}</button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="manage-actions">
                  <Link to={`/dashboard/edit/${b.id}`} className="btn btn-outline btn-sm"><Pencil size={15} /> Edit</Link>
                  <button className="btn btn-outline btn-sm danger" onClick={() => remove(b)} aria-label="Delete"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'enquiries' && (
        enquiries.length === 0 ? (
          <div className="empty"><Inbox size={48} /><h3>No enquiries yet</h3><p className="muted">Customer enquiries will appear here.</p></div>
        ) : (
          <div className="manage-list">
            {enquiries.map((e) => (
              <div key={e.id} className={`enquiry ${e.status === 'new' ? 'enquiry-new' : ''}`}>
                <div className="enquiry-top">
                  <div>
                    <strong>{e.name}</strong> <span className="muted small">for {e.business_name} · {timeAgo(e.created_at)}</span>
                  </div>
                  <select value={e.status} onChange={(ev) => setStatus(e, ev.target.value)} aria-label="Status">
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <p>{e.message}</p>
                <div className="enquiry-actions">
                  {e.phone_hidden ? (
                    <span className="privacy-badge"><Lock size={14} /> Privacy Mode · {e.phone}</span>
                  ) : (
                    <>
                      <a className="btn btn-call btn-sm" href={telLink(e.phone)}><Phone size={15} /> {e.phone}</a>
                      <a className="btn btn-whatsapp btn-sm" href={waLink(e.phone, `Hi ${e.name}, thanks for your enquiry about ${e.business_name}.`)} target="_blank" rel="noreferrer">
                        <MessageCircle size={15} /> WhatsApp
                      </a>
                    </>
                  )}
                  {e.user_id && (
                    <button className="btn btn-enquiry btn-sm" onClick={() => setOpenThread(openThread === e.id ? null : e.id)}>
                      <MessageSquareText size={15} /> {openThread === e.id ? 'Close chat' : `Reply in app${e.message_count ? ` (${e.message_count})` : ''}`}
                    </button>
                  )}
                </div>
                {openThread === e.id && <EnquiryThread enquiryId={e.id} />}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
