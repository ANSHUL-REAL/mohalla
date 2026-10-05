import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ImagePlus, LocateFixed, Trash2, X } from 'lucide-react';
import { api, assetUrl } from '../api';
import { useAuth } from '../auth';
import { useToast } from '../components/Toast';
import MapView from '../components/MapView';
import { DAYS, getLocation } from '../utils';

const EMPTY = {
  name: '', category_id: '', description: '', phone: '', whatsapp: '', email: '', website: '',
  address: '', area: '', city: '', lat: '', lng: '', established: '',
  hours: { open: '09:00', close: '21:00', closed: [] }, services: [],
};

export default function BusinessForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...EMPTY, phone: user?.phone || '' });
  const [photos, setPhotos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [service, setService] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    api('/categories').then(setCategories).catch(() => {});
    api('/cities').then(setCities).catch(() => {});
    if (isEdit) {
      setLoaded(false);
      api(`/businesses/${id}`).then((b) => {
        setForm({
          name: b.name, category_id: b.category_id, description: b.description, phone: b.phone, whatsapp: b.whatsapp || '',
          email: b.email || '', website: b.website || '', address: b.address, area: b.area, city: b.city,
          lat: b.lat ?? '', lng: b.lng ?? '', established: b.established || '', hours: b.hours, services: b.services,
        });
        setPhotos(b.photos);
        setLoaded(true);
      }).catch((e) => toast(e.message, 'error'));
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setHours = (k, v) => setForm({ ...form, hours: { ...form.hours, [k]: v } });
  const toggleDay = (d) =>
    setHours('closed', form.hours.closed.includes(d) ? form.hours.closed.filter((x) => x !== d) : [...form.hours.closed, d]);

  const addService = () => {
    const s = service.trim();
    if (s && !form.services.includes(s)) setForm({ ...form, services: [...form.services, s] });
    setService('');
  };

  const useMyLocation = async () => {
    try {
      const [lat, lng] = await getLocation();
      setForm((f) => ({ ...f, lat, lng }));
    } catch (e) { toast(e.message, 'error'); }
  };

  const cityCoords = cities.find((c) => c.name.toLowerCase() === form.city.trim().toLowerCase())?.coords;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await api(`/businesses/${id}`, { method: 'PUT', body: form });
        toast('Listing updated');
        navigate('/dashboard');
      } else {
        const b = await api('/businesses', { method: 'POST', body: form });
        toast(b.is_approved ? 'Business added!' : 'Submitted for approval. Now add some photos!');
        navigate(`/dashboard/edit/${b.id}`, { replace: true });
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadPhotos = async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    const fd = new FormData();
    files.forEach((f) => fd.append('photos', f));
    setUploading(true);
    try {
      const d = await api(`/businesses/${id}/photos`, { method: 'POST', form: fd });
      setPhotos(d.photos);
      toast(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removePhoto = async (url) => {
    try {
      const d = await api(`/businesses/${id}/photos?url=${encodeURIComponent(url)}`, { method: 'DELETE' });
      setPhotos(d.photos);
    } catch (err) { toast(err.message, 'error'); }
  };

  if (!loaded) return <div className="container"><div className="skeleton skeleton-lg" /></div>;

  return (
    <div className="container page narrow">
      <div className="page-head">
        <div>
          <h1>{isEdit ? 'Edit business' : 'Add your business'}</h1>
          <p className="muted">
            {isEdit ? 'Keep your details up to date so customers can reach you.' : 'Fill in the details below. Your listing goes live after admin approval.'}
          </p>
        </div>
        {isEdit && <Link to={`/business/${id}`} className="btn btn-outline btn-sm">View listing</Link>}
      </div>

      {isEdit && (
        <section className="card">
          <h3>Photos</h3>
          <p className="muted small">Add up to 12 photos (JPG/PNG, under 5 MB each). The first photo is the cover.</p>
          <div className="photo-manage">
            {photos.map((p) => (
              <div key={p} className="photo-item">
                <img src={assetUrl(p)} alt="" />
                <button type="button" onClick={() => removePhoto(p)} aria-label="Remove photo"><Trash2 size={14} /></button>
              </div>
            ))}
            {photos.length < 12 && (
              <label className="photo-add">
                <ImagePlus size={26} />
                <span>{uploading ? 'Uploading…' : 'Add photos'}</span>
                <input type="file" accept="image/*" multiple hidden onChange={uploadPhotos} disabled={uploading} />
              </label>
            )}
          </div>
        </section>
      )}

      <form className="form card" onSubmit={submit}>
        <h3>Basic details</h3>
        <div className="grid-2">
          <label>Business name *<input value={form.name} onChange={set('name')} required /></label>
          <label>Category *
            <select value={form.category_id} onChange={set('category_id')} required>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <label>Description
          <textarea rows={4} value={form.description} onChange={set('description')} placeholder="What do you offer? What makes you special?" />
        </label>

        <label>Services offered</label>
        <div className="tag-input">
          {form.services.map((s) => (
            <span key={s} className="chip">{s}
              <button type="button" onClick={() => setForm({ ...form, services: form.services.filter((x) => x !== s) })} aria-label={`Remove ${s}`}>
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            value={service}
            onChange={(e) => setService(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addService(); } }}
            onBlur={addService}
            placeholder="Type a service and press Enter"
          />
        </div>

        <h3>Contact</h3>
        <div className="grid-2">
          <label>Phone *<input value={form.phone} onChange={set('phone')} required inputMode="tel" /></label>
          <label>WhatsApp<input value={form.whatsapp} onChange={set('whatsapp')} inputMode="tel" placeholder="Same as phone" /></label>
          <label>Email<input type="email" value={form.email} onChange={set('email')} /></label>
          <label>Year established<input type="number" min="1900" max="2100" value={form.established} onChange={set('established')} /></label>
        </div>

        <h3>Address & location</h3>
        <label>Full address *<input value={form.address} onChange={set('address')} required placeholder="Shop no, building, street" /></label>
        <div className="grid-2">
          <label>Area / locality<input value={form.area} onChange={set('area')} placeholder="e.g. Rajpur Road" /></label>
          <label>City *
            <input value={form.city} onChange={set('city')} required list="city-list" placeholder="e.g. Dehradun" />
            <datalist id="city-list">{cities.map((c) => <option key={c.name} value={c.name} />)}</datalist>
          </label>
        </div>
        <div className="map-picker-head">
          <span className="muted small">Tap the map to set your exact location{form.lat !== '' && ` (${form.lat}, ${form.lng})`}</span>
          <button type="button" className="btn btn-outline btn-sm" onClick={useMyLocation}><LocateFixed size={15} /> Use my location</button>
        </div>
        <MapView
          height={260}
          zoom={14}
          center={form.lat !== '' ? [Number(form.lat), Number(form.lng)] : cityCoords || undefined}
          points={form.lat !== '' ? [{ id: 'pin', lat: Number(form.lat), lng: Number(form.lng) }] : []}
          onPick={([lat, lng]) => setForm((f) => ({ ...f, lat, lng }))}
        />

        <h3>Working hours</h3>
        <div className="grid-2">
          <label>Opens at<input type="time" value={form.hours.open} onChange={(e) => setHours('open', e.target.value)} /></label>
          <label>Closes at<input type="time" value={form.hours.close} onChange={(e) => setHours('close', e.target.value)} /></label>
        </div>
        <label>Weekly off</label>
        <div className="pill-group">
          {DAYS.map(([k, l]) => (
            <button type="button" key={k} className={`pill ${form.hours.closed.includes(k) ? 'active' : ''}`} onClick={() => toggleDay(k)}>{l}</button>
          ))}
        </div>

        <div className="form-actions">
          <Link to="/dashboard" className="btn btn-outline">Cancel</Link>
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save changes' : 'Submit listing'}</button>
        </div>
      </form>
    </div>
  );
}
