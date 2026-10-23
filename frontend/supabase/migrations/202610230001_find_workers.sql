-- Additive migration: public worker directory, private authenticated editing.
-- No credentials or precise coordinates are stored in the directory.
create table if not exists public.worker_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100),
  services text[] not null check (coalesce(array_length(services, 1),0) between 1 and 12),
  skills text not null default '' check (char_length(skills) <= 600),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  town text not null check (char_length(btrim(town)) between 2 and 100),
  service_areas text[] not null default '{}',
  travel_mode text not null default 'mobile' check (travel_mode in ('mobile','fixed','both')),
  availability text not null default 'Ask for availability'
    check (availability in ('Available','Limited availability','Unavailable','Ask for availability')),
  phone text not null check (phone ~ '^\+[1-9][0-9]{6,14}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  description text not null default '' check (char_length(description) <= 1200),
  work_examples text not null default '' check (char_length(work_examples) <= 1200),
  photo_url text check (photo_url is null or (char_length(photo_url) <= 500 and photo_url ~ '^https://[^[:space:]]+$')),
  experience_years integer check (experience_years is null or experience_years between 0 and 70),
  starting_price text check (starting_price is null or char_length(starting_price) <= 100),
  is_active boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint worker_service_areas_limit check (coalesce(array_length(service_areas,1),0) <= 25 and char_length(array_to_string(service_areas, ',')) <= 1200),
  constraint worker_services_known check (services <@ array['Plumbing','Electrical','Mechanic','Cleaning','Building','Carpentry','Painting','Welding','Gardening','Appliance repair','Tailoring','Moving','Other']::text[])
);
create index if not exists worker_country_town_idx on public.worker_profiles (country_code, lower(town)) where is_active;
create index if not exists worker_services_idx on public.worker_profiles using gin (services) where is_active;
create or replace function public.worker_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.worker_touch_updated_at() from public, anon, authenticated;
drop trigger if exists worker_touch_updated_at on public.worker_profiles;
create trigger worker_touch_updated_at before update on public.worker_profiles
  for each row execute function public.worker_touch_updated_at();
alter table public.worker_profiles enable row level security;
alter table public.worker_profiles force row level security;
drop policy if exists worker_owner_select on public.worker_profiles;
drop policy if exists worker_owner_insert on public.worker_profiles;
drop policy if exists worker_owner_update on public.worker_profiles;
drop policy if exists worker_owner_delete on public.worker_profiles;
create policy worker_owner_select on public.worker_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy worker_owner_insert on public.worker_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy worker_owner_update on public.worker_profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy worker_owner_delete on public.worker_profiles for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.worker_profiles from public, anon, authenticated;
grant select, insert, update, delete on public.worker_profiles to authenticated;

-- This owner-defined, narrowly projected view intentionally exposes only active
-- profiles, not auth identifiers, emails, exact coordinates or hidden profiles.
-- The base table remains owner-readable only through RLS.
create or replace view public.worker_directory with (security_barrier=true) as
select id, display_name, services, skills, country_code, town, service_areas,
       travel_mode, availability, phone, whatsapp, description, work_examples,
       photo_url, experience_years, starting_price, updated_at
from public.worker_profiles where is_active = true;
revoke all on public.worker_directory from public, anon, authenticated;
grant select on public.worker_directory to anon, authenticated;
comment on view public.worker_directory is 'Only explicitly public active worker data; auth email and owner id never exposed.';

