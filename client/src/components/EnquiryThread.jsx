import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, Send } from 'lucide-react';
import { api } from '../api';
import { useToast } from './Toast';
import { timeAgo } from '../utils';

// In-app chat for an enquiry — lets businesses reply without ever seeing a Privacy Mode customer's number
export default function EnquiryThread({ enquiryId }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const load = useCallback(() => {
    api(`/enquiries/${enquiryId}/messages`).then(setData).catch((e) => toast(e.message, 'error'));
  }, [enquiryId, toast]);

  // Check for new replies every 5 seconds while the chat is open
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [data?.messages.length]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api(`/enquiries/${enquiryId}/messages`, { method: 'POST', body: { text } });
      setText('');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  if (!data) return <div className="thread"><p className="muted small">Loading chat…</p></div>;
  const mine = data.role;

  return (
    <div className="thread">
      <p className="thread-note small"><Lock size={13} /> Private chat · phone numbers are never shared here</p>
      <div className="thread-msgs">
        <div className={`msg ${mine === 'customer' ? 'msg-me' : ''}`}>
          <span>{data.enquiry.message}</span>
          <small>{data.enquiry.name} · {timeAgo(data.enquiry.created_at)}</small>
        </div>
        {data.messages.map((m) => (
          <div key={m.id} className={`msg ${m.sender === mine ? 'msg-me' : ''}`}>
            <span>{m.text}</span>
            <small>{m.sender === 'business' ? data.enquiry.business_name : data.enquiry.name} · {timeAgo(m.created_at)}</small>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="thread-input" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={mine === 'business' ? 'Reply with price, time…' : 'Write a message…'} />
        <button className="btn btn-primary btn-sm" disabled={sending || !text.trim()} aria-label="Send"><Send size={16} /></button>
      </form>
    </div>
  );
}
