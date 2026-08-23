import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Coords } from '../lib/geolocation';
import './LocationPicker.css';

interface LocationPickerProps {
  /** Currently picked spot, or null when nothing is pinned yet. */
  value: Coords | null;
  onChange: (coords: Coords) => void;
  /** Where to look before anything is pinned (e.g. the pet's last-seen spot). */
  defaultCenter?: Coords;
  height?: string;
}

const FALLBACK_CENTER: Coords = { lat: 12.9716, lng: 77.5946 };

function createPinIcon(): L.DivIcon {
  const color = '#F2603C';
  const size = 38;
  const html = `
    <div style="
      width:${size}px;height:${size}px;
      background:${color};
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      border:2.5px solid white;
      box-shadow:0 4px 12px rgba(42,39,31,0.18);
      display:flex;align-items:center;justify-content:center;
    ">
      <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
        <ellipse cx="12" cy="16" rx="6" ry="5"/>
        <circle cx="5" cy="9" r="2.4"/>
        <circle cx="19" cy="9" r="2.4"/>
        <circle cx="9" cy="5" r="2.2"/>
        <circle cx="15" cy="5" r="2.2"/>
      </svg>
    </div>
  `;
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
}

/** A small map where the user taps to drop (or drags to adjust) a location pin. */
export function LocationPicker({ value, onChange, defaultCenter, height = '240px' }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;
    const start = value ?? defaultCenter ?? FALLBACK_CENTER;
    const map = L.map(containerRef.current, {
      center: [start.lat, start.lng],
      zoom: value || defaultCenter ? 15 : 12,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);
    map.on('click', e => onChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng }));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const pos: [number, number] = [value.lat, value.lng];
    if (!markerRef.current) {
      const marker = L.marker(pos, { icon: createPinIcon(), draggable: true });
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        onChangeRef.current({ lat: ll.lat, lng: ll.lng });
      });
      marker.addTo(map);
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(pos);
    }
    map.setView(pos, Math.max(map.getZoom(), 15));
  }, [value]);

  return (
    <div className="location-picker" style={{ height }}>
      <div ref={containerRef} className="pet-map location-picker-map" />
      <div className="location-picker-hint t-body-s" aria-hidden="true">
        {value ? 'Drag the pin to adjust' : 'Tap the map to drop a pin'}
      </div>
    </div>
  );
}
