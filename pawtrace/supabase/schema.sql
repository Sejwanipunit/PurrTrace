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
  age_years        numeric,
  status           text not null check (status in ('lost','found','searching','reunited')),
  photo_url        text,
  description      text,
  microchip_id     text,
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
alter table public.profiles  enable row level security;
alter table public.pets      enable row level security;
alter table public.sightings enable row level security;

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
  update public.profiles set reunited_count = reunited_count + 1 where id = uid;
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
