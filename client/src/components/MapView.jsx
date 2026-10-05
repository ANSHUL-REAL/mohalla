import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const pinIcon = (color = '#FD5A46') =>
  L.divIcon({
    className: 'map-pin',
    html: `<span style="background:${color}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });

/**
 * OpenStreetMap map using Leaflet.
 * points:   [{ id, lat, lng, label, sub, color }]
 * onSelect: called with a point id when "View details" is clicked in a popup
 * onPick:   if given, clicking the map calls onPick([lat, lng]) (used to pick a business location)
 */
export default function MapView({ points = [], center, zoom = 13, height = 320, onSelect, onPick }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const callbacks = useRef({});
  callbacks.current = { onSelect, onPick };

  useEffect(() => {
    const m = L.map(el.current, { scrollWheelZoom: false }).setView(center || [22.5, 79], center ? zoom : 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on('click', (e) => callbacks.current.onPick?.([+e.latlng.lat.toFixed(5), +e.latlng.lng.toFixed(5)]));
    map.current = m;
    const resize = setTimeout(() => m.invalidateSize(), 200);
    return () => {
      clearTimeout(resize); // the page may close before the map finished sizing itself
      m.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const key = JSON.stringify(points.map((p) => [p.id, p.lat, p.lng])) + JSON.stringify(center);
  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    group.clearLayers();
    const valid = points.filter((p) => p.lat != null && p.lng != null);

    valid.forEach((p) => {
      const marker = L.marker([p.lat, p.lng], { icon: pinIcon(p.color) }).addTo(group);
      if (!p.label) return;
      const box = document.createElement('div');
      box.className = 'map-popup';
      const title = document.createElement('strong');
      title.textContent = p.label;
      box.appendChild(title);
      if (p.sub) {
        const sub = document.createElement('div');
        sub.textContent = p.sub;
        box.appendChild(sub);
      }
      if (callbacks.current.onSelect) {
        const btn = document.createElement('button');
        btn.textContent = 'View details →';
        btn.onclick = () => callbacks.current.onSelect(p.id);
        box.appendChild(btn);
      }
      marker.bindPopup(box);
    });

    if (valid.length > 1) m.fitBounds(L.latLngBounds(valid.map((p) => [p.lat, p.lng])), { padding: [30, 30], maxZoom: 15 });
    else if (valid.length === 1) m.setView([valid[0].lat, valid[0].lng], zoom);
    else if (center) m.setView(center, zoom);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className="map" style={{ height }} />;
}
