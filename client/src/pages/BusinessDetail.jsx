import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BadgeCheck, CalendarDays, Clock, Eye, Heart, Mail, MapPin, MessageCircle, Navigation, Pencil, Phone, Share2, Trash2,
} from 'lucide-react';
import { api, assetUrl } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import { RatingBadge, StarInput, Stars } from '../components/Stars';
import { Badges, BusinessTile, Cover, HoursLine, LiveStatus } from '../components/BusinessCard';
import { EnquiryForm } from '../components/EnquiryModal';
import MapView from '../components/MapView';
import { categoryImage, closedDaysText, directionsLink, hoursText, initials, telLink, timeAgo, waLink } from '../utils';
import { Store } from 'lucide-react';
import { BRAND } from '../config';

function ReviewForm({ business, existing, onSaved }) {
  const toast = useToast();
  const [rating, setRating] = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || '');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return toast('Please select a star rating.', 'error');
    setSaving(true);
    try {
      await api(`/businesses/${business.id}/reviews`, { method: 'POST', body: { rating, comment } });
      toast(existing ? 'Your review was updated.' : 'Thanks! Your review was posted.');
      onSaved();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="review-form" onSubmit={submit}>
      <h4>{existing ? 'Update your review' : 'Rate this business'}</h4>
      <StarInput value={rating} onChange={setRating} />
      <textarea rows={3} placeholder="Share your experience (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : existing ? 'Update review' : 'Submit review'}</button>
    </form>
  );
}

export default function BusinessDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [biz, setBiz] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [photo, setPhoto] = useState(0);

  const load = useCallback(() => {
    api(`/businesses/${id}`).then(setBiz).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { setBiz(null); setPhoto(0); setTab('overview'); load(); }, [load]);

  if (error) return <div className="container empty"><h2>{error}</h2><Link to="/search" className="btn btn-primary">Browse businesses</Link></div>;
  if (!biz) return <div className="container"><div className="skeleton skeleton-lg" /></div>;

  const myReview = user && biz.reviews.find((r) => r.user_id === user.id);
  const isOwner = user && biz.owner_id === user.id;

  const toggleFavorite = async () => {
    if (!user) return navigate('/login', { state: { from: `/business/${id}` } });
    const d = await api(`/favorites/${biz.id}`, { method: biz.isFavorite ? 'DELETE' : 'POST' });
    setBiz({ ...biz, isFavorite: d.isFavorite });
    toast(d.isFavorite ? 'Saved to your favourites' : 'Removed from favourites');
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: biz.name, text: `Check out ${biz.name} on ${BRAND.name}`, url });
      else { await navigator.clipboard.writeText(url); toast('Link copied to clipboard'); }
    } catch { /* user cancelled */ }
  };

  const deleteReview = async (reviewId) => {
    if (!confirm('Delete your review?')) return;
    await api(`/reviews/${reviewId}`, { method: 'DELETE' });
    toast('Review deleted');
    load();
  };

  const totalReviews = biz.review_count || 1;
  const canClaim = !biz.owner_id && (user?.role === 'business' || user?.role === 'admin');

  const claim = async () => {
    if (!confirm(`Claim "${biz.name}" as your business? You will be able to edit it and receive enquiries.`)) return;
    try {
      await api(`/businesses/${biz.id}/claim`, { method: 'POST' });
      toast('Business claimed! You can now edit this listing.');
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div className="detail">
      <div className="container">
        {!biz.is_approved && <div className="notice">This listing is waiting for admin approval and is not visible to the public yet.</div>}

        <div className="gallery">
          {biz.photos.length ? (
            <>
              <img className="gallery-main" src={assetUrl(biz.photos[photo])} alt={biz.name} referrerPolicy="no-referrer" />
              {biz.photos.length > 1 && (
                <div className="gallery-thumbs">
                  {biz.photos.map((p, i) => (
                    <button key={p} className={i === photo ? 'active' : ''} onClick={() => setPhoto(i)}>
                      <img src={assetUrl(p)} alt="" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : <Cover business={biz} className="gallery-main" big />}
          {!biz.photos.length && biz.source === 'local' && categoryImage(biz) && <span className="photo-note">Representative photo</span>}
          {biz.photos[photo]?.includes('wikimedia.org') && <span className="photo-note">Photo: Wikimedia Commons</span>}
        </div>

        <div className="detail-head">
          <div>
            <div className="breadcrumb muted small">
              <Link to={`/search?category=${biz.category_slug}`}>{biz.category_name}</Link> · <Link to={`/search?city=${biz.city}`}>{biz.city}</Link>
            </div>
            <h1>{biz.name} {biz.is_verified && <BadgeCheck className="verified" size={26} aria-label="Verified" />}</h1>
            <div className="detail-meta">
              <RatingBadge rating={biz.rating} count={biz.review_count} size="lg" />
              {biz.is_featured && <span className="tag tag-featured static">Featured</span>}
              {biz.is_verified && <span className="tag tag-verified">Verified</span>}
              <span className="muted small"><Eye size={14} /> {biz.views} views</span>
            </div>
            <p className="muted"><MapPin size={16} /> {biz.address}</p>
            <Badges business={biz} max={5} />
            <div className="status-row">
              <LiveStatus status={biz.live_status} />
              {biz.live_status !== 'closed_today' && <HoursLine hours={biz.hours} />}
            </div>
          </div>
          {biz.canEdit && (
            <Link to={`/dashboard/edit/${biz.id}`} className="btn btn-outline btn-sm"><Pencil size={16} /> Edit listing</Link>
          )}
          {canClaim && <button className="btn btn-accent btn-sm" onClick={claim}><Store size={16} /> Claim this business</button>}
        </div>

        <div className="action-bar">
          {biz.phone && (
            <>
              <a className="btn btn-call" href={telLink(biz.phone)}><Phone size={18} /> {biz.phone}</a>
              <a className="btn btn-whatsapp" href={waLink(biz.whatsapp || biz.phone, `Hi, I found ${biz.name} on ${BRAND.name}.`)} target="_blank" rel="noreferrer">
                <MessageCircle size={18} /> WhatsApp
              </a>
            </>
          )}
          <a className="btn btn-outline" href={directionsLink(biz)} target="_blank" rel="noreferrer"><Navigation size={18} /> Directions</a>
          <button className="btn btn-outline" onClick={share}><Share2 size={18} /> Share</button>
          <button className={`btn btn-outline ${biz.isFavorite ? 'fav-on' : ''}`} onClick={toggleFavorite}>
            <Heart size={18} fill={biz.isFavorite ? 'currentColor' : 'none'} /> {biz.isFavorite ? 'Saved' : 'Save'}
          </button>
        </div>

        <div className="detail-layout">
          <div>
            <div className="tabs">
              {[['overview', 'Overview'], ['reviews', `Reviews (${biz.review_count})`], ['photos', `Photos (${biz.photos.length})`]].map(([k, l]) => (
                <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="panel">
                <h3>About</h3>
                <p>{biz.description || 'No description added yet.'}</p>

                {biz.services.length > 0 && (
                  <>
                    <h3>Services</h3>
                    <div className="chips">{biz.services.map((s) => <span key={s} className="chip chip-lg">{s}</span>)}</div>
                  </>
                )}

                <h3>Details</h3>
                <ul className="info-list">
                  <li><Clock size={18} /> {biz.hours.unknown ? <span className="muted">Timings not available</span>
                    : <span>{hoursText(biz.hours)} <span className="muted">· {closedDaysText(biz.hours)}</span></span>}</li>
                  {biz.phone && <li><Phone size={18} /> <a href={telLink(biz.phone)}>{biz.phone}</a></li>}
                  {biz.website && <li><Share2 size={18} /> <a href={biz.website} target="_blank" rel="noreferrer">{biz.website.replace(/^https?:\/\//, '')}</a></li>}
                  {biz.email && <li><Mail size={18} /> <a href={`mailto:${biz.email}`}>{biz.email}</a></li>}
                  {biz.established && <li><CalendarDays size={18} /> Established in {biz.established}</li>}
                  <li><MapPin size={18} /> {biz.address}</li>
                </ul>

                {biz.source === 'osm' && (
                  <p className="muted small source-note">
                    Real business data from <a href={`https://www.openstreetmap.org/${biz.osm_id}`} target="_blank" rel="noreferrer">OpenStreetMap</a> contributors.
                    {!biz.owner_id && ' Own this business? Create a business account and claim it to add photos, phone and timings.'}
                  </p>
                )}
                {biz.lat != null && (
                  <>
                    <h3>Location</h3>
                    <MapView points={[{ id: biz.id, lat: biz.lat, lng: biz.lng, color: biz.category_color }]} zoom={15} height={280} />
                  </>
                )}
              </div>
            )}

            {tab === 'reviews' && (
              <div className="panel">
                <div className="review-summary">
                  <div className="review-score">
                    <strong>{biz.rating ? biz.rating.toFixed(1) : '–'}</strong>
                    <Stars value={biz.rating} size={18} />
                    <span className="muted small">{biz.review_count} ratings</span>
                  </div>
                  <div className="review-bars">
                    {biz.breakdown.map(({ star, count }) => (
                      <div key={star} className="bar-row">
                        <span>{star}★</span>
                        <div className="bar"><div style={{ width: `${(count / totalReviews) * 100}%` }} /></div>
                        <span className="muted small">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {user && !isOwner && <ReviewForm key={myReview?.id || 'new'} business={biz} existing={myReview} onSaved={load} />}
                {!user && (
                  <div className="notice">
                    <Link to="/login" state={{ from: `/business/${id}` }}>Log in</Link> to write a review.
                  </div>
                )}

                <div className="reviews">
                  {biz.reviews.length === 0 && <p className="muted">No reviews yet. Be the first to review!</p>}
                  {biz.reviews.map((r) => (
                    <div key={r.id} className="review">
                      <span className="avatar">{initials(r.user_name)}</span>
                      <div className="review-body">
                        <div className="review-top">
                          <strong>{r.user_name}</strong>
                          <span className="muted small">{timeAgo(r.created_at)}</span>
                        </div>
                        <Stars value={r.rating} />
                        {r.comment && <p>{r.comment}</p>}
                        {(user?.id === r.user_id || user?.role === 'admin') && (
                          <button className="link small danger" onClick={() => deleteReview(r.id)}><Trash2 size={13} /> Delete</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'photos' && (
              <div className="panel">
                {biz.photos.length === 0 ? <p className="muted">No photos uploaded yet.</p> : (
                  <div className="photo-grid">
                    {biz.photos.map((p) => <a key={p} href={assetUrl(p)} target="_blank" rel="noreferrer"><img src={assetUrl(p)} alt="" /></a>)}
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="sidebar">
            {!isOwner && (
              <div className="card sticky">
                <h3>Get the best price</h3>
                <p className="muted small">Share your requirement and {biz.name} will contact you.</p>
                <EnquiryForm business={biz} compact />
              </div>
            )}
          </aside>
        </div>

        {biz.similar.length > 0 && (
          <section className="section">
            <h2>Similar {biz.category_name.toLowerCase()} in {biz.city}</h2>
            <div className="tile-grid">{biz.similar.map((b) => <BusinessTile key={b.id} business={b} />)}</div>
          </section>
        )}
      </div>
    </div>
  );
}
