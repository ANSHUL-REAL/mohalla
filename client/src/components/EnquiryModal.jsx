import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast } from './Toast';

// "Get best price" form — sends an enquiry to the business owner's dashboard
export function EnquiryForm({ business, onDone, compact }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    message: `Hi, I am interested in your services. Please share details and best price.`,
  });
  const [sending, setSending] = useState(false);
  const [hidePhone, setHidePhone] = useState(!!user);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api(`/businesses/${business.id}/enquiries`, { method: 'POST', body: { ...form, hide_phone: hidePhone } });
      toast(hidePhone ? `Sent privately! ${business.name} will reply in the app — see Profile → My enquiries.`
        : `Enquiry sent to ${business.name}. They will contact you soon.`);
      onDone?.();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className={`form ${compact ? 'form-compact' : ''}`}>
      <label>Your name<input value={form.name} onChange={set('name')} required /></label>
      <label>Mobile number<input value={form.phone} onChange={set('phone')} required inputMode="tel" placeholder="+91 98765 43210" /></label>
      <label>Requirement<textarea rows={3} value={form.message} onChange={set('message')} required /></label>
      <PrivacyToggle checked={hidePhone} onChange={setHidePhone} />
      <button className="btn btn-primary btn-block" disabled={sending}>{sending ? 'Sending…' : 'Get Best Price'}</button>
    </form>
  );
}

// "No spam calls" switch: the business replies inside the app and never sees your number
export function PrivacyToggle({ checked, onChange }) {
  const { user } = useAuth();
  if (!user) {
    return (
      <p className="privacy-toggle off small">
        <Lock size={15} /> <span><Link to="/login">Log in</Link> to use <b>Privacy Mode</b> — hide your number, get replies in the app.</span>
      </p>
    );
  }
  return (
    <label className={`privacy-toggle ${checked ? 'on' : 'off'}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <Lock size={15} />
      <span><b>Privacy Mode</b> — hide my number, reply in app. No spam calls.</span>
    </label>
  );
}

export default function EnquiryModal({ business, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <div>
            <h3>Get best price</h3>
            <p className="muted small">from {business.name}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <EnquiryForm business={business} onDone={onClose} />
      </div>
    </div>
  );
}
