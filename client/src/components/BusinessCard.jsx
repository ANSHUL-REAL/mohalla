import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Clock, Flame, MapPin, MessageCircle, Navigation, Phone, Search, Send, Zap } from 'lucide-react';
import { assetUrl } from '../api';
import { CategoryIcon, categoryImage, directionsLink, formatDistance, hoursStatus, placeLine, telLink, waLink, walkTime } from '../utils';
import { RatingBadge } from './Stars';
import EnquiryModal from './EnquiryModal';
import { BRAND } from '../config';

// Which map tile (at zoom z) contains a point, with the fractional position inside it
function tileOf(lat, lng, z) {
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return [((lng + 180) / 360) * n, ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n];
}

// Real satellite view of the exact location — used for real places that have no photo yet
export function MapCover({ business, className = '', big = false }) {
  const zoom = 17;
  const cols = big ? 7 : 3, rows = 3;
  const [x, y] = tileOf(business.lat, business.lng, zoom);
  const tx = Math.floor(x), ty = Math.floor(y);
  const offsetX = ((cols - 1) / 2) * 256 + (x - tx) * 256;
  const offsetY = ((rows - 1) / 2) * 256 + (y - ty) * 256;
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const X = tx + c - (cols - 1) / 2, Y = ty + r - (rows - 1) / 2;
      tiles.push(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${Y}/${X}`);
    }
  }
  return (
    <div className={`cover cover-map ${className}`}>
      <div className="map-tiles" style={{ width: cols * 256, transform: `translate(${-offsetX}px, ${-offsetY}px)` }}>
        {tiles.map((src) => <img key={src} src={src} alt="" draggable="false" />)}
      </div>
      <span className="map-cover-pin" style={{ background: business.category_color }}>
        <CategoryIcon name={business.category_icon} size={big ? 22 : 16} strokeWidth={2.4} />
      </span>
      <span className="map-cover-credit">Imagery © Esri, Maxar</span>
    </div>
  );
}

export function Cover({ business, className = '', big = false }) {
  const [broken, setBroken] = useState(false);
  if (business.photos?.length && !broken) {
    return (
      <img className={`cover ${className}`} src={assetUrl(business.photos[0])} alt={business.name} loading="lazy"
        referrerPolicy="no-referrer" onError={() => setBroken(true)} />
    );
  }
  // Real places: show their real location instead of a stock photo
  if (business.source !== 'local' && business.lat != null) return <MapCover business={business} className={className} big={big} />;
  const stock = categoryImage(business);
  if (stock) return <img className={`cover ${className}`} src={stock} alt={business.category_name} loading="lazy" />;
  return (
    <div className={`cover cover-placeholder ${className}`} style={{ backgroundColor: business.category_color || '#FFC567' }}>
      <span className="cover-icon"><CategoryIcon name={business.category_icon} size={34} strokeWidth={2.2} /></span>
    </div>
  );
}

// Small trust badges like JustDial: Top Search, Trending, Verified, Quick Response, years in business
export function Badges({ business: b, max = 4 }) {
  const list = [];
  if (b.is_verified) list.push(['verified', <BadgeCheck size={13} />, 'Verified']);
  if (b.badges?.topSearch) list.push(['top', <Search size={13} />, 'Top Search']);
  if (b.badges?.trending) list.push(['trending', <Flame size={13} />, 'Trending']);
  if (b.badges?.quickResponse) list.push(['quick', <Zap size={13} />, 'Quick Response']);
  if (b.badges?.years >= 2) list.push(['years', <Clock size={13} />, `${b.badges.years} Yrs in Business`]);
  if (!list.length) return null;
  return (
    <div className="badges">
      {list.slice(0, max).map(([k, icon, label]) => <span key={k} className={`badge badge-${k}`}>{icon} {label}</span>)}
    </div>
  );
}

// Live status set by the owner — something JustDial doesn't have
const LIVE = {
  available: ['live-available', 'Available right now'],
  busy: ['live-busy', 'Busy right now'],
  closed_today: ['live-closed', 'Closed today'],
};
export function LiveStatus({ status }) {
  if (!LIVE[status]) return null;
  const [cls, label] = LIVE[status];
  return <span className={`live ${cls}`}><span className="live-dot" /> {label} <small>· live</small></span>;
}

export function HoursLine({ hours }) {
  const st = hoursStatus(hours);
  if (!st) return null;
  return <p className={`open-status ${st.open ? (st.soon ? 'soon' : 'open') : 'closed'}`}>{st.text}</p>;
}

// Hides the number until tapped, like JustDial's "Show Number"
export function ShowNumber({ phone, className = '' }) {
  const [shown, setShown] = useState(false);
  return shown
    ? <a className={`btn btn-call ${className}`} href={telLink(phone)}><Phone size={16} /> {phone}</a>
    : <button className={`btn btn-call ${className}`} onClick={() => setShown(true)}><Phone size={16} /> Show Number</button>;
}

// Horizontal result card used on the search page
export default function BusinessCard({ business: b }) {
  const [enquiry, setEnquiry] = useState(false);
  return (
    <article className="biz-card">
      <Link to={`/business/${b.id}`} className="biz-card-media">
        <Cover business={b} />
        {b.is_featured && <span className="tag tag-featured">Featured</span>}
        {b.source !== 'local' && <span className="tag tag-real">Real place</span>}
      </Link>
      <div className="biz-card-body">
        <Link to={`/business/${b.id}`} className="biz-card-title">
          <h3>{b.name}</h3>
          {b.is_verified && <BadgeCheck size={18} className="verified" aria-label="Verified" />}
        </Link>
        <div className="biz-card-meta">
          <RatingBadge rating={b.rating} count={b.review_count} />
          <span className="dot">•</span>
          <span className="muted">{b.category_name}</span>
        </div>
        <Badges business={b} />
        <p className="biz-card-address">
          <MapPin size={15} /> {placeLine(b)}
          {b.distance != null && <span className="distance"><Navigation size={13} /> {formatDistance(b.distance)}{walkTime(b.distance) && ` · ${walkTime(b.distance)}`}</span>}
        </p>
        <div className="status-row">
          <LiveStatus status={b.live_status} />
          {b.live_status !== 'closed_today' && <HoursLine hours={b.hours} />}
        </div>
        <div className="chips">
          {b.services.slice(0, 3).map((s) => <span key={s} className="chip">{s}</span>)}
        </div>
        <div className="biz-card-actions">
          {b.phone ? (
            <>
              <ShowNumber phone={b.phone} />
              <a className="btn btn-whatsapp" href={waLink(b.whatsapp || b.phone, `Hi, I found ${b.name} on ${BRAND.name}.`)} target="_blank" rel="noreferrer">
                <MessageCircle size={16} /> WhatsApp
              </a>
            </>
          ) : (
            <a className="btn btn-call" href={directionsLink(b)} target="_blank" rel="noreferrer"><Navigation size={16} /> Directions</a>
          )}
          <button className="btn btn-enquiry" onClick={() => setEnquiry(true)}><Send size={16} /> Send Enquiry</button>
        </div>
      </div>
      {enquiry && <EnquiryModal business={b} onClose={() => setEnquiry(false)} />}
    </article>
  );
}

// Smaller vertical card for grids (home page, similar businesses, favourites)
export function BusinessTile({ business: b }) {
  return (
    <Link to={`/business/${b.id}`} className="biz-tile">
      <div className="biz-tile-media">
        <Cover business={b} />
        {b.is_featured && <span className="tag tag-featured">Featured</span>}
        {b.distance != null && <span className="tag tag-distance">{formatDistance(b.distance)}</span>}
      </div>
      <div className="biz-tile-body">
        <h4>{b.name} {b.is_verified && <BadgeCheck size={15} className="verified" />}</h4>
        <RatingBadge rating={b.rating} count={b.review_count} size="sm" />
        <p className="muted small"><MapPin size={13} /> {placeLine(b)}</p>
      </div>
    </Link>
  );
}
