import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Send } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from './Toast';
import { RatingBadge } from './Stars';
import { PrivacyToggle } from './EnquiryModal';

// "Get the list of top plumbers" — one form, sent to the 5 best matching businesses
export default function LeadForm({ filters, label }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', need: '' });
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState(null);
  const [hidePhone, setHidePhone] = useState(!!user);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { q, city, category, lat, lng, maxKm } = filters;
      const d = await api('/leads', {
        method: 'POST',
        body: { ...form, need: form.need || `Looking for ${label}`, q, city, category, lat, lng, maxKm, hide_phone: hidePhone },
      });
      setSentTo(d.sentTo);
      toast(`Sent to ${d.sentTo.length} top businesses!`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <div className="lead-card">
        <h3><CheckCircle2 size={20} /> Requirement sent!</h3>
        <p className="small">These businesses will call you shortly:</p>
        <ul className="lead-list">
          {sentTo.map((b) => (
            <li key={b.id}>
              <Link to={`/business/${b.id}`}><strong>{b.name}</strong></Link>
              <RatingBadge rating={b.rating} size="sm" />
            </li>
          ))}
        </ul>
        <button className="link small" onClick={() => setSentTo(null)}>Send another requirement</button>
      </div>
    );
  }

  return (
    <form className="lead-card form form-compact" onSubmit={submit}>
      <h3>Get the list of top {label.toLowerCase()}</h3>
      <p className="small">We’ll send your requirement to the 5 best-rated businesses — they’ll contact you.</p>
      <input placeholder="Your name" value={form.name} onChange={set('name')} required aria-label="Your name" />
      <input placeholder="Mobile number" value={form.phone} onChange={set('phone')} required inputMode="tel" aria-label="Mobile number" />
      <input placeholder="What do you need? (optional)" value={form.need} onChange={set('need')} aria-label="Requirement" />
      <PrivacyToggle checked={hidePhone} onChange={setHidePhone} />
      <button className="btn btn-primary btn-block" disabled={busy}><Send size={16} /> {busy ? 'Sending…' : 'Send Enquiry'}</button>
    </form>
  );
}
