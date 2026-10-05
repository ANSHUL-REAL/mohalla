import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, Inbox, LayoutDashboard, Lock, LogOut, MessageSquareText, Shield, Trash2 } from 'lucide-react';
import EnquiryThread from '../components/EnquiryThread';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { BusinessTile } from '../components/BusinessCard';
import { Stars } from '../components/Stars';
import { initials, timeAgo } from '../utils';

export default function Profile() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'saved';
  const [saved, setSaved] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [enquiries, setEnquiries] = useState(null);
  const [openThread, setOpenThread] = useState(null);

  useEffect(() => {
    api('/favorites').then(setSaved).catch(() => setSaved([]));
    api('/my/reviews').then(setReviews).catch(() => setReviews([]));
    api('/my/sent-enquiries').then(setEnquiries).catch(() => setEnquiries([]));
  }, []);

  const deleteReview = async (id) => {
    if (!confirm('Delete this review?')) return;
    await api(`/reviews/${id}`, { method: 'DELETE' });
    setReviews(reviews.filter((r) => r.id !== id));
    toast('Review deleted');
  };

  const roleLabel = { user: 'Customer', business: 'Business owner', admin: 'Administrator' }[user.role];

  return (
    <div className="container page">
      <div className="profile-card">
        <span className="avatar avatar-lg">{initials(user.name)}</span>
        <div>
          <h1>{user.name}</h1>
          <p className="muted">{user.email}{user.phone && ` · ${user.phone}`}</p>
          <span className="tag static">{roleLabel}</span>
        </div>
        <div className="profile-actions">
          {user.role !== 'user' && <Link to="/dashboard" className="btn btn-outline btn-sm"><LayoutDashboard size={16} /> Dashboard</Link>}
          {user.role === 'admin' && <Link to="/admin" className="btn btn-outline btn-sm"><Shield size={16} /> Admin</Link>}
          <button className="btn btn-outline btn-sm danger" onClick={() => { logout(); navigate('/'); }}><LogOut size={16} /> Log out</button>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'saved' ? 'active' : ''} onClick={() => setParams({ tab: 'saved' })}>
          <Heart size={16} /> Saved ({saved?.length ?? 0})
        </button>
        <button className={tab === 'reviews' ? 'active' : ''} onClick={() => setParams({ tab: 'reviews' })}>
          <MessageSquareText size={16} /> My reviews ({reviews?.length ?? 0})
        </button>
        <button className={tab === 'enquiries' ? 'active' : ''} onClick={() => setParams({ tab: 'enquiries' })}>
          <Inbox size={16} /> My enquiries ({enquiries?.length ?? 0})
        </button>
      </div>

      {tab === 'saved' && saved && (
        saved.length === 0 ? (
          <div className="empty"><Heart size={48} /><h3>Nothing saved yet</h3><p className="muted">Tap “Save” on any business to find it here later.</p>
            <Link to="/search" className="btn btn-primary">Explore businesses</Link></div>
        ) : <div className="tile-grid">{saved.map((b) => <BusinessTile key={b.id} business={b} />)}</div>
      )}

      {tab === 'enquiries' && enquiries && (
        enquiries.length === 0 ? (
          <div className="empty"><Inbox size={48} /><h3>No enquiries yet</h3>
            <p className="muted">Send an enquiry with Privacy Mode on and businesses reply here — no spam calls.</p></div>
        ) : (
          <div className="manage-list">
            {enquiries.map((e) => (
              <div key={e.id} className="enquiry">
                <div className="enquiry-top">
                  <div>
                    <Link to={`/business/${e.business_id}`}><strong>{e.business_name}</strong></Link>
                    <span className="muted small"> · {timeAgo(e.created_at)}</span>
                  </div>
                  {e.hide_phone ? <span className="privacy-badge"><Lock size={13} /> Number hidden</span> : <span className="status">{e.status}</span>}
                </div>
                <p>{e.message}</p>
                <button className="btn btn-enquiry btn-sm" onClick={() => setOpenThread(openThread === e.id ? null : e.id)}>
                  <MessageSquareText size={15} /> {openThread === e.id ? 'Close chat' : e.reply_count ? `${e.reply_count} new ${e.reply_count === 1 ? 'reply' : 'replies'}` : 'Open chat'}
                </button>
                {openThread === e.id && <EnquiryThread enquiryId={e.id} />}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'reviews' && reviews && (
        reviews.length === 0 ? (
          <div className="empty"><MessageSquareText size={48} /><h3>No reviews yet</h3><p className="muted">Your reviews help others choose better.</p></div>
        ) : (
          <div className="manage-list">
            {reviews.map((r) => (
              <div key={r.id} className="card review-card">
                <div className="review-top">
                  <Link to={`/business/${r.business_id}`}><strong>{r.business_name}</strong></Link>
                  <span className="muted small">{timeAgo(r.created_at)}</span>
                </div>
                <Stars value={r.rating} />
                {r.comment && <p>{r.comment}</p>}
                <button className="link small danger" onClick={() => deleteReview(r.id)}><Trash2 size={13} /> Delete</button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
