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
