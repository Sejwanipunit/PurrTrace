import { supabase, isSupabaseConfigured } from './supabase';

/**
 * Web Push subscription management. Notifications are sent by the
 * `push-notify` Supabase Edge Function (see supabase/functions/push-notify),
 * triggered by database webhooks on pets/sightings inserts — so alerts arrive
 * even when the app is closed.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

let pushActive = false;

/** True when this session holds a live push subscription (server sends alerts). */
export const isPushActive = () => pushActive;

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * Subscribe this device to push and register it with the backend.
 * No-ops (returns false) in mock mode, without a VAPID key, without
 * notification permission, or in browsers lacking push support.
 */
export async function ensurePushSubscription(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase || !VAPID_PUBLIC_KEY) return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return false; // SW not active (e.g. dev server)

    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    const keys = sub.toJSON().keys;
    if (!keys?.p256dh || !keys?.auth) return false;

    const { error } = await supabase.from('push_subscriptions').upsert(
      { endpoint: sub.endpoint, user_id: userId, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'endpoint' }
    );
    if (error) return false;
    pushActive = true;
    return true;
  } catch {
    return false;
  }
}

/** Unsubscribe this device and forget it on the backend (sign-out / alerts off). */
export async function removePushSubscription(): Promise<void> {
  pushActive = false;
  try {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const sub = await registration?.pushManager.getSubscription();
    if (!sub) return;
    if (supabase) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    }
    await sub.unsubscribe();
  } catch {
    /* best effort */
  }
}
