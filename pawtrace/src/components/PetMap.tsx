import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Pet } from '../types';
import { timeAgo } from '../lib/time';
import './PetMap.css';

interface PetMapProps {
  pets: Pet[];
  center?: [number, number];
  zoom?: number;
  onPinClick?: (pet: Pet) => void;
  height?: string;
  highlightId?: string;
  /** Plot each sighting as a small dot with a trail to the last-seen pin. */
  showSightings?: boolean;
  /** When set/changed, pan+zoom the map to this point (e.g. a tapped sighting). */
  focusCoord?: [number, number] | null;
}

const STATUS_COLORS: Record<string, string> = {
  lost: '#F2603C',
  found: '#6FB833',
  searching: '#F5D827',
  reunited: '#3EA094',
};

const SPECIES_GLYPH: Record<string, string> = { dog: '🐶', cat: '🐱', other: '🐾' };

function createDivIcon(species: string, status: string, isHighlighted = false): L.DivIcon {
  const color = STATUS_COLORS[status] || '#6FB833';
  const pulse = status === 'lost' ? `
    <style>
      @keyframes ptPulse {
        0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
        100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
      }
    </style>
    <div style="
      position:absolute; top:50%; left:50%;
      width:38px; height:38px; border-radius:50%;
      background:${color}; opacity:0.3;
      animation:ptPulse 1.8s ease-out infinite;
      pointer-events:none;
    "></div>
  ` : '';

  const glyph = SPECIES_GLYPH[species] || '🐾';
  const size = isHighlighted ? 44 : 38;
  const fontSize = isHighlighted ? 21 : 18;
  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;">
      ${pulse}
      <div style="
        width:${size}px;height:${size}px;
        background:${color};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2.5px solid white;
        box-shadow:0 4px 12px rgba(42,39,31,0.18);
        display:flex;align-items:center;justify-content:center;
        position:relative;z-index:1;
      ">
        <div style="transform:rotate(45deg);font-size:${fontSize}px;line-height:1;">${glyph}</div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

// Offset a coordinate by a distance in metres (north/east).
function offsetLatLng(lat: number, lng: number, dNorthM: number, dEastM: number): [number, number] {
  const dLat = dNorthM / 111320;
  const dLng = dEastM / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lat + dLat, lng + dLng];
}

// A single animated paw print (rotated to face the walking direction, staggered fade).
function pawPrintIcon(rotationDeg: number, delay: number): L.DivIcon {
  const html = `<div style="transform:rotate(${rotationDeg}deg);">
    <div class="pt-walk-paw" style="animation-delay:${delay}s;">
      <svg viewBox="0 0 24 24" fill="#F2603C" width="15" height="15">
        <ellipse cx="12" cy="16" rx="6" ry="5"/><circle cx="5" cy="9" r="2.4"/><circle cx="19" cy="9" r="2.4"/><circle cx="9" cy="5" r="2.2"/><circle cx="15" cy="5" r="2.2"/>
      </svg>
    </div></div>`;
  return L.divIcon({ html, className: '', iconSize: [15, 15], iconAnchor: [7, 7] });
}

export function PetMap({ pets, center, zoom = 14, onPinClick, height = '100%', highlightId, showSightings = false, focusCoord }: PetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const overlaysRef = useRef<L.Layer[]>([]);

  const defaultCenter: [number, number] = center || [12.9716, 77.5946];

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: defaultCenter,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });
    // Standard OpenStreetMap tiles — free, no API key (CARTO's demo tiles now
    // require one). A warm CSS filter in PetMap.css keeps them on-brand.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: 'abc',
      maxZoom: 19,
    }).addTo(map);
    // Without an explicit center, frame the actual reports instead of a fixed city.
    if (!center && pets.length > 0) {
      const points = pets.map(p => [p.lastSeen.lat, p.lastSeen.lng] as [number, number]);
      if (showSightings) {
        pets.forEach(p => p.sightings.forEach(s => points.push([s.lat, s.lng])));
      }
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
    }
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    overlaysRef.current.forEach(o => o.remove());
    markersRef.current = [];
    overlaysRef.current = [];

    pets.forEach(pet => {
      const isHighlighted = pet.id === highlightId;
      const marker = L.marker([pet.lastSeen.lat, pet.lastSeen.lng], {
        icon: createDivIcon(pet.species, pet.status, isHighlighted),
        title: pet.name,
        alt: `${pet.name} - ${pet.status}`,
      });

      marker.on('click', () => onPinClick?.(pet));
      marker.addTo(map);
      markersRef.current.push(marker);

      // Draw the sighting trail: always in sighting mode, else only for lost pets.
      if ((showSightings || pet.status === 'lost') && pet.sightings.length > 0) {
        const points: [number, number][] = pet.sightings.map(s => [s.lat, s.lng]);
        points.push([pet.lastSeen.lat, pet.lastSeen.lng]);
        const polyline = L.polyline(points, {
          color: '#F2603C',
          weight: 2.5,
          dashArray: '6, 8',
          opacity: 0.65,
        });
        polyline.addTo(map);
        overlaysRef.current.push(polyline);
      }

      // Plot each sighting as a small dot where it actually happened.
      if (showSightings) {
        pet.sightings.forEach(s => {
          // Translucent "probable area" circle — a pet can wander from where it was
          // last spotted, so the uncertainty grows the longer ago the sighting was.
          const hours = Math.max(0, (Date.now() - new Date(s.at).getTime()) / 3_600_000);
          const radiusM = Math.min(1500, Math.max(200, 200 + hours * 120));
          const area = L.circle([s.lat, s.lng], {
            radius: radiusM,
            color: '#F2603C',
            weight: 1,
            opacity: 0.4,
            fillColor: '#F2603C',
            fillOpacity: 0.08,
            interactive: false,
          });
          area.addTo(map);
          overlaysRef.current.push(area);

          // A cute little trail of paw prints "walking" inside the possible area.
          const walk = Math.min(radiusM * 0.5, 220);
          const headingDeg = 35; // up-and-to-the-right
          const rad = (headingDeg * Math.PI) / 180;
          [0.35, 0.62, 0.9].forEach((frac, i) => {
            const pos = offsetLatLng(s.lat, s.lng, Math.cos(rad) * walk * frac, Math.sin(rad) * walk * frac);
            const paw = L.marker(pos, { icon: pawPrintIcon(headingDeg, i * 0.5), interactive: false, keyboard: false });
            paw.addTo(map);
            overlaysRef.current.push(paw);
          });

          const dot = L.circleMarker([s.lat, s.lng], {
            radius: 7,
            color: '#FFFFFF',
            weight: 2,
            fillColor: '#F2603C',
            fillOpacity: 0.9,
          });
          dot.bindTooltip(
            `${s.note ? s.note + ' · ' : ''}${timeAgo(s.at)}`,
            { direction: 'top', offset: [0, -6] }
          );
          dot.addTo(map);
          overlaysRef.current.push(dot);
        });
      }
    });
  }, [pets, onPinClick, highlightId, showSightings]);

  // Pan+zoom to a requested point (e.g. when a sighting row is tapped).
  useEffect(() => {
    const map = mapRef.current;
    if (map && focusCoord) map.setView(focusCoord, 17, { animate: true });
  }, [focusCoord]);

  return <div ref={containerRef} className="pet-map" style={{ height }} />;
}
