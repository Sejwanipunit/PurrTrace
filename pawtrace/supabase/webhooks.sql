-- ============================================================================
-- PawTrace — Web Push webhooks (SQL alternative to the dashboard "Database
-- Webhooks" UI). Run once in the Supabase SQL editor AFTER deploying the
-- push-notify Edge Function and setting its secrets.
--
-- Before running, replace the two placeholders below:
--   YOUR_PROJECT_REF          → the xxxx in https://xxxx.supabase.co
--   YOUR_PUSH_WEBHOOK_SECRET   → the same value you passed to
--                                `supabase secrets set PUSH_WEBHOOK_SECRET=...`
-- ============================================================================

-- pg_net lets Postgres make outbound HTTP calls (this is what Database
-- Webhooks use under the hood). It installs into the `net` schema.
create extension if not exists pg_net;

-- Trigger function: POST the inserted row to the push-notify Edge Function
-- in the exact shape the function expects ({ type, table, schema, record }).
create or replace function public.notify_push()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  fn_url text := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/push-notify';
  secret text := 'YOUR_PUSH_WEBHOOK_SECRET';
begin
  perform net.http_post(
    url     := fn_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-push-secret', secret
               ),
    body    := jsonb_build_object(
                 'type',   'INSERT',
                 'table',  tg_table_name,
                 'schema', tg_table_schema,
                 'record', to_jsonb(new)
               )
  );
  return new;
end;
$$;

drop trigger if exists push_on_pet_insert on public.pets;
create trigger push_on_pet_insert
  after insert on public.pets
  for each row execute function public.notify_push();

drop trigger if exists push_on_sighting_insert on public.sightings;
create trigger push_on_sighting_insert
  after insert on public.sightings
  for each row execute function public.notify_push();
