import type { AppNotification } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToNotification(r: any): AppNotification {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body ?? undefined,
    petId: r.pet_id ?? undefined,
    read: r.read,
    createdAt: r.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listNotifications(): Promise<AppNotification[]> {
  if (!isSupabaseConfigured || !supabase) return [];
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map(rowToNotification);
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('notifications').update({ read: true }).eq('read', false);
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}
