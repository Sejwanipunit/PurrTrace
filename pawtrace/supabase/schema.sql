-- ============================================================================
-- PawTrace — Supabase schema
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query → Run).
-- Safe to re-run: uses "if not exists" / "drop policy if exists" guards.
-- ============================================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------- profiles ----------
-- One row per authenticated user, auto-created on signup via trigger below.
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  name           text not null default 'PawTrace member',
  avatar_url     text,
  reunited_count int  not null default 0,
  created_at     timestamptz not null default now()
);

-- ---------- pets ----------
create table if not exists public.pets (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  species          text not null check (species in ('dog','cat','other')),
  breed            text,
  color            text,
  age_years        numeric,
  status           text not null check (status in ('lost','found','searching','reunited')),
  photo_url        text,
  description      text,
  microchip_id     text,
  reward           text,
  last_seen_lat    double precision not null,
  last_seen_lng    double precision not null,
  last_seen_label  text not null,
  last_seen_at     timestamptz not null default now(),
  reported_by      uuid references public.profiles (id) on delete set null,
  reported_by_name text not null default 'PawTrace member',
  created_at       timestamptz not null default now()
);
create index if not exists pets_created_at_idx on public.pets (created_at desc);
create index if not exists pets_status_idx     on public.pets (status);

-- ---------- sightings ----------
create table if not exists public.sightings (
  id               uuid primary key default gen_random_uuid(),
  pet_id           uuid not null references public.pets (id) on delete cascade,
  lat              double precision not null,
  lng              double precision not null,
  note             text,
  photo_url        text,
  at               timestamptz not null default now(),
  reported_by      uuid references public.profiles (id) on delete set null,
  reported_by_name text not null default 'PawTrace member'
);
create index if not exists sightings_pet_id_idx on public.sightings (pet_id);

-- ---------- push_subscriptions ----------
-- One row per device that opted into Web Push. Read by the push-notify
-- Edge Function (service role); users manage only their own rows.
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on public.push_subscriptions (user_id);

-- ---------- notifications ----------
-- In-app notifications (e.g. "a found dog was reported near your lost pet").
-- Inserted by the push-notify Edge Function (service role); users read/update their own.
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

-- ============================================================================
-- Auto-create a profile row when a new auth user signs up (Google OAuth, etc.)
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'PawTrace member'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Row Level Security
-- Reads are public (a community board); writes require auth + ownership.
-- ============================================================================
alter table public.profiles           enable row level security;
alter table public.pets               enable row level security;
alter table public.sightings          enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications      enable row level security;

-- notifications — each user reads/updates only their own; inserts come from the
-- Edge Function using the service role (which bypasses RLS).
drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_select" on public.notifications for select using (auth.uid() = recipient_id);
create policy "notifications_update" on public.notifications for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
create policy "notifications_delete" on public.notifications for delete using (auth.uid() = recipient_id);

-- push_subscriptions — each user manages only their own devices
drop policy if exists "push_subs_select" on public.push_subscriptions;
drop policy if exists "push_subs_insert" on public.push_subscriptions;
drop policy if exists "push_subs_update" on public.push_subscriptions;
drop policy if exists "push_subs_delete" on public.push_subscriptions;
create policy "push_subs_select" on public.push_subscriptions for select using (auth.uid() = user_id);
create policy "push_subs_insert" on public.push_subscriptions for insert with check (auth.uid() = user_id);
create policy "push_subs_update" on public.push_subscriptions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "push_subs_delete" on public.push_subscriptions for delete using (auth.uid() = user_id);

-- profiles
drop policy if exists "profiles_read"   on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_read"   on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- pets
drop policy if exists "pets_read"   on public.pets;
drop policy if exists "pets_insert" on public.pets;
drop policy if exists "pets_update" on public.pets;
drop policy if exists "pets_delete" on public.pets;
create policy "pets_read"   on public.pets for select using (true);
create policy "pets_insert" on public.pets for insert with check (auth.uid() = reported_by);
create policy "pets_update" on public.pets for update using (auth.uid() = reported_by) with check (auth.uid() = reported_by);
create policy "pets_delete" on public.pets for delete using (auth.uid() = reported_by);

-- sightings — anyone signed in can add a sighting to any pet
drop policy if exists "sightings_read"   on public.sightings;
drop policy if exists "sightings_insert" on public.sightings;
drop policy if exists "sightings_delete" on public.sightings;
create policy "sightings_read"   on public.sightings for select using (true);
create policy "sightings_insert" on public.sightings for insert with check (auth.uid() = reported_by);
create policy "sightings_delete" on public.sightings for delete using (auth.uid() = reported_by);

-- ============================================================================
-- Storage bucket for pet photos (public read, authenticated write)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('pet-photos', 'pet-photos', true)
on conflict (id) do nothing;

drop policy if exists "pet_photos_read"   on storage.objects;
drop policy if exists "pet_photos_insert" on storage.objects;
create policy "pet_photos_read"
  on storage.objects for select
  using (bucket_id = 'pet-photos');
create policy "pet_photos_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'pet-photos');

-- ============================================================================
-- Helper: increment a profile's reunited_count by 1 (called from the app).
-- ============================================================================
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

-- ============================================================================
-- OPTIONAL: seed a few demo pets so the map/feed isn't empty on first run.
-- These have no owner (reported_by is null) and cannot be edited from the app.
-- Comment out if you'd rather start clean.
-- ============================================================================
insert into public.pets (name, species, breed, age_years, status, photo_url, description, last_seen_lat, last_seen_lng, last_seen_label, last_seen_at, reported_by_name)
values
  ('Bruno','dog','Labrador Retriever',3,'lost','https://picsum.photos/seed/bruno/400/300','Ran away during fireworks. Red collar with our number.',12.9716,77.5946,'Koramangala 5th Block', now() - interval '2 hours','Rahul Sharma'),
  ('Whiskers','cat','Persian mix',5,'found','https://picsum.photos/seed/whiskers/400/300','Found near the HSR Layout bus stop. Calm and well-fed.',12.9141,77.6411,'HSR Layout Bus Stop', now() - interval '5 hours','Meena Iyer'),
  ('Max','dog','Golden Retriever',2,'searching','https://picsum.photos/seed/maxdog/400/300','Missing three days. Yellow bandana, responds to his name.',12.9352,77.6245,'Indiranagar 100 Feet Road', now() - interval '3 days','Sunita Rao'),
  ('Luna','cat','Siamese',4,'reunited','https://picsum.photos/seed/lunacat/400/300','Found by a kind neighbour 2 streets away. Home safe!',12.9800,77.5900,'Sadashivanagar Market', now() - interval '4 days','Deepa Krishnan'),
  ('Unknown tabby','cat',null,null,'found','https://picsum.photos/seed/tabby/400/300','Ginger tabby, no collar, near JP Nagar. Looking for owner.',12.9063,77.5857,'JP Nagar 6th Phase', now() - interval '8 hours','Community PawTrace')
on conflict do nothing;

-- ============================================================================
-- Realtime — broadcast inserts/updates/deletes on pets & sightings so the
-- map and notifications update live. (Idempotent.)
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pets'
  ) then
    alter publication supabase_realtime add table public.pets;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sightings'
  ) then
    alter publication supabase_realtime add table public.sightings;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
