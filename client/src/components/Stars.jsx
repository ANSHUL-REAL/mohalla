import { useState } from 'react';
import { Star } from 'lucide-react';

// Green rating box like "4.3 ★"
export function RatingBadge({ rating, count, size = 'md' }) {
  const level = rating >= 4 ? 'good' : rating >= 3 ? 'ok' : rating > 0 ? 'bad' : 'none';
  return (
    <span className="rating-wrap">
      <span className={`rating-badge rating-${level} rating-${size}`}>
        {rating > 0 ? rating.toFixed(1) : 'New'} <Star size={size === 'lg' ? 15 : 12} fill="currentColor" />
      </span>
      {count != null && <span className="muted small">{count} {count === 1 ? 'rating' : 'ratings'}</span>}
    </span>
  );
}

export function Stars({ value, size = 14 }) {
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= Math.round(value) ? 'star-on' : 'star-off'} fill="currentColor" />
      ))}
    </span>
  );
}

// Clickable stars for writing a review
export function StarInput({ value, onChange }) {
  const [hover, setHover] = useState(0);
  const labels = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Excellent'];
  return (
    <div className="star-input">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          type="button"
          key={i}
          aria-label={`${i} star`}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
        >
          <Star size={30} className={i <= (hover || value) ? 'star-on' : 'star-off'} fill="currentColor" />
        </button>
      ))}
      <span className="muted">{labels[hover || value]}</span>
    </div>
  );
}
