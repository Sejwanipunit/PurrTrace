import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Pet } from '../types';
import './PetMap.css';

interface PetMapProps {
  pets: Pet[];
  center?: [number, number];
  zoom?: number;
  onPinClick?: (pet: Pet) => void;
  height?: string;
  highlightId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  lost: '#F2603C',
  found: '#6FB833',
  searching: '#F5D827',
  reunited: '#3EA094',
};

function createDivIcon(status: string, isHighlighted = false): L.DivIcon {
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

  const pawSvg = `<svg viewBox="0 0 24 24" fill="${color}" width="16" height="16" style="transform:rotate(-45deg)">
    <ellipse cx="12" cy="16" rx="6" ry="5"/>
    <circle cx="5" cy="9" r="2.4"/>
    <circle cx="19" cy="9" r="2.4"/>
    <circle cx="9" cy="5" r="2.2"/>
    <circle cx="15" cy="5" r="2.2"/>
  </svg>`;

  const size = isHighlighted ? 44 : 38;
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
        <div style="transform:rotate(45deg);display:flex;align-items:center;justify-content:center;">
          ${pawSvg}
        </div>
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

export function PetMap({ pets, center, zoom = 14, onPinClick, height = '100%', highlightId }: PetMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylinesRef = useRef<L.Polyline[]>([]);

  const defaultCenter: [number, number] = center || [12.9716, 77.5946];

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: defaultCenter,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });
    // Soft, warm-toned basemap (CartoDB Voyager — free, no API key, pastel palette
    // with green parks that harmonizes with the PawTrace brand). Falls back gracefully.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    polylinesRef.current.forEach(p => p.remove());
    markersRef.current = [];
    polylinesRef.current = [];

    pets.forEach(pet => {
      const isHighlighted = pet.id === highlightId;
      const marker = L.marker([pet.lastSeen.lat, pet.lastSeen.lng], {
        icon: createDivIcon(pet.status, isHighlighted),
        title: pet.name,
        alt: `${pet.name} - ${pet.status}`,
      });

      marker.on('click', () => onPinClick?.(pet));
      marker.addTo(map);
      markersRef.current.push(marker);

      // Draw paw-path trail for lost pets with sightings
      if (pet.status === 'lost' && pet.sightings.length > 0) {
        const points: [number, number][] = pet.sightings.map(s => [s.lat, s.lng]);
        points.push([pet.lastSeen.lat, pet.lastSeen.lng]);
        const polyline = L.polyline(points, {
          color: '#F2603C',
          weight: 2.5,
          dashArray: '6, 8',
          opacity: 0.65,
        });
        polyline.addTo(map);
        polylinesRef.current.push(polyline);
      }
    });
  }, [pets, onPinClick, highlightId]);

  return <div ref={containerRef} className="pet-map" style={{ height }} />;
}
