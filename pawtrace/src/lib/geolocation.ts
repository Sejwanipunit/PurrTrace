export interface Coords {
  lat: number;
  lng: number;
}

/** Request the device's current location. Triggers the browser permission prompt. */
export function getCurrentLocation(timeout = 10000): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Location isn’t supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error('Location permission denied.'));
        else reject(new Error('We couldn’t get your location — try again or enter it manually.'));
      },
      { enableHighAccuracy: true, timeout, maximumAge: 60000 }
    );
  });
}

/**
 * Turn a free-text place label into coordinates using the free OpenStreetMap
 * Nominatim service (no API key). Returns null on any failure.
 */
export async function geocodeLabel(label: string): Promise<Coords | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(label)}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data[0]?.lat && data[0]?.lon) {
      return { lat: Number(data[0].lat), lng: Number(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Turn coordinates into a friendly place label using the free OpenStreetMap
 * Nominatim service (no API key). Returns null on any failure.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const parts = [
      a.neighbourhood || a.suburb || a.road || a.hamlet,
      a.city || a.town || a.village || a.county,
    ].filter(Boolean);
    if (parts.length) return parts.join(', ');
    return data.display_name ? data.display_name.split(',').slice(0, 2).join(', ') : null;
  } catch {
    return null;
  }
}
