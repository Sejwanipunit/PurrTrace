// PawTrace push-notify Edge Function.
//
// Triggered by Database Webhooks on INSERTs into `pets` and `sightings`
// (see SUPABASE_SETUP.md → Web Push). Sends Web Push notifications to
// subscribed devices so alerts arrive even when the app is closed.
//
// Deploy:   supabase functions deploy push-notify --no-verify-jwt
// Secrets:  supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... PUSH_WEBHOOK_SECRET=...
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.)

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';

webpush.setVapidDetails('mailto:admin@pawtrace.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Keep in sync with NEARBY_RADIUS_KM / REPORT_TTL_DAYS in the app.
const NEARBY_RADIUS_KM = 3;
const REPORT_TTL_DAYS = 30;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
}

async function sendToUsers(userIds: string[], payload: PushPayload): Promise<number> {
  if (userIds.length === 0) return 0;
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth, user_id')
    .in('user_id', userIds);
  if (!subs?.length) return 0;

  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        );
        sent++;
      } catch (err) {
        // Subscription expired or revoked — clean it up.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        }
      }
    })
  );
  return sent;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Shared-secret check so only our database webhook can invoke this.
  if (WEBHOOK_SECRET && req.headers.get('x-push-secret') !== WEBHOOK_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }

  const payload = await req.json();
  const { type, table, record } = payload;
  if (type !== 'INSERT' || !record) return Response.json({ sent: 0 });

  let sent = 0;

  if (table === 'sightings') {
    // Someone reported a sighting → notify the pet's owner.
    const { data: pet } = await supabase
      .from('pets')
      .select('id, name, reported_by')
      .eq('id', record.pet_id)
      .single();
    if (pet?.reported_by && pet.reported_by !== record.reported_by) {
      sent = await sendToUsers([pet.reported_by], {
        title: `New sighting of ${pet.name}`,
        body: record.note || `${pet.name} was just spotted — tap to see where.`,
        url: `/pet/${pet.id}`,
      });
    }
  } else if (table === 'pets' && record.status === 'found') {
    // Someone reported a FOUND pet → notify owners of nearby active lost pets.
    const cutoff = new Date(Date.now() - REPORT_TTL_DAYS * 86400000).toISOString();
    const { data: lostPets } = await supabase
      .from('pets')
      .select('id, name, reported_by, last_seen_lat, last_seen_lng')
      .in('status', ['lost', 'searching'])
      .gte('created_at', cutoff)
      .not('reported_by', 'is', null);

    const owners = new Map<string, string>(); // owner id → their pet's name
    for (const lost of lostPets ?? []) {
      if (lost.reported_by === record.reported_by) continue;
      const dist = haversine(record.last_seen_lat, record.last_seen_lng, lost.last_seen_lat, lost.last_seen_lng);
      if (dist <= NEARBY_RADIUS_KM && !owners.has(lost.reported_by)) {
        owners.set(lost.reported_by, lost.name);
      }
    }
    for (const [ownerId, petName] of owners) {
      sent += await sendToUsers([ownerId], {
        title: `A found pet was reported near ${petName}`,
        body: `A ${record.breed || record.species} was found close to where you lost ${petName}. Tap to check.`,
        url: `/pet/${record.id}`,
      });
    }
  }

  return Response.json({ sent });
});
