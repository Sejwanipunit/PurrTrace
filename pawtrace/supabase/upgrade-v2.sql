-- ============================================================================
-- PawTrace v2 upgrade — run this ONCE in the Supabase SQL editor of your
-- EXISTING (live) project. New projects can just run schema.sql instead.
--
-- Adds:  push_subscriptions table (Web Push) + RLS
-- Fixes: increment_reunited privilege escalation (anyone could inflate
--        anyone's reunited counter)
-- ============================================================================

-- ---------- push_subscriptions ----------
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subs_select" on public.push_subscriptions;
drop policy if exists "push_subs_insert" on public.push_subscriptions;
drop policy if exists "push_subs_update" on public.push_subscriptions;
drop policy if exists "push_subs_delete" on public.push_subscriptions;
create policy "push_subs_select" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "push_subs_insert" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_subs_update" on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push_subs_delete" on public.push_subscriptions for delete using (auth.uid() = user_id);

-- ---------- SECURITY FIX: increment_reunited ----------
create or replace function public.increment_reunited(uid uuid)
returns void
language sql
security definer set search_path = public
as $$
  -- security definer bypasses RLS, so enforce that callers can only bump
  -- their own counter — otherwise any signed-in user could inflate anyone's.
  update public.profiles set reunited_count = reunited_count + 1
  where id = uid and id = auth.uid();
$$;

-- ---------- v3: reward field on reports ----------
-- Optional reward offer shown on the pet page and the shareable poster.
alter table public.pets add column if not exists reward text;

-- ---------- v4: colour field on reports (from AI auto-tagging) ----------
alter table public.pets add column if not exists color text;

-- ---------- v5: in-app notifications ----------
create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type         text not null,
  title        text not null,
  body         text,
  pet_id       uuid references public.pets (id) on delete cascade,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_select" on public.notifications for select using (auth.uid() = recipient_id);
create policy "notifications_update" on public.notifications for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
create policy "notifications_delete" on public.notifications for delete using (auth.uid() = recipient_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
