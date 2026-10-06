-- Troot Window: Supabase schema, RLS and abuse controls.
-- Already applied to project wftjesokdmjzixshjcwf. Safe to re-run.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  employer_name text not null check (char_length(employer_name) between 2 and 160),
  location text not null check (char_length(location) between 2 and 120),
  category text not null check (category in ('Construction','Technology','Trades','Hospitality','Transport','Other')),
  mode text not null check (mode in ('OnSite','Hybrid','Remote')),
  pay text not null check (char_length(pay) between 1 and 120),
  description text not null check (char_length(description) between 20 and 5000),
  requirements text not null check (char_length(requirements) between 2 and 1000),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+?[0-9 ()-]{7,20}$'),
  email text check (email is null or (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  employer_verified boolean not null default false,
  status text not null default 'pending_review' check (status in ('pending_review','published','rejected','closed')),
  submitter_hash text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint jobs_has_contact check (phone is not null or whatsapp is not null or email is not null)
);

create table if not exists public.job_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 60),
  details text check (details is null or char_length(details) <= 1000),
  reporter_hash text not null default 'unknown',
  created_at timestamptz not null default now(),
  unique (job_id, reporter_hash)
);

create index if not exists jobs_feed_idx on public.jobs (status, employer_verified desc, created_at desc);
create index if not exists jobs_category_idx on public.jobs (status, category, created_at desc);
create index if not exists jobs_submitter_idx on public.jobs (submitter_hash, created_at desc);
create index if not exists reports_job_idx on public.job_reports (job_id, created_at desc);

-- Caller fingerprint: hashed client IP from the API gateway. Raw IPs are never stored.
create or replace function public.caller_hash() returns text
language sql stable set search_path = public as $$
  select encode(sha256(convert_to(coalesce(
    nullif(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ''), ',', 1), ''),
    'unknown'), 'utf8')), 'hex')
$$;

create or replace function public.jobs_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.submitter_hash := public.caller_hash();
  new.status := 'pending_review';
  new.employer_verified := false;
  new.published_at := null;
  new.title := btrim(new.title);
  if (select count(*) from public.jobs
        where submitter_hash = new.submitter_hash
          and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.jobs_before_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = 'published' and old.status <> 'published' then
    new.published_at := now();
  end if;
  return new;
end $$;

create or replace function public.reports_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.reporter_hash := public.caller_hash();
  if (select count(*) from public.job_reports
        where reporter_hash = new.reporter_hash
          and created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists jobs_before_insert on public.jobs;
create trigger jobs_before_insert before insert on public.jobs
  for each row execute function public.jobs_before_insert();
drop trigger if exists jobs_before_update on public.jobs;
create trigger jobs_before_update before update on public.jobs
  for each row execute function public.jobs_before_update();
drop trigger if exists reports_before_insert on public.job_reports;
create trigger reports_before_insert before insert on public.job_reports
  for each row execute function public.reports_before_insert();

-- Row Level Security: default deny.
alter table public.jobs enable row level security;
alter table public.job_reports enable row level security;

drop policy if exists "public reads published jobs" on public.jobs;
create policy "public reads published jobs" on public.jobs
  for select to anon, authenticated using (status = 'published');

drop policy if exists "public submits jobs for review" on public.jobs;
create policy "public submits jobs for review" on public.jobs
  for insert to anon, authenticated
  with check (status = 'pending_review' and employer_verified = false and published_at is null);

drop policy if exists "public reports published jobs" on public.job_reports;
create policy "public reports published jobs" on public.job_reports
  for insert to anon, authenticated
  with check (exists (select 1 from public.jobs j where j.id = job_id and j.status = 'published'));

-- Column-level grants: the app key can never read submitter_hash or report data,
-- and can never write status, verification or publish fields.
revoke all on public.jobs from anon, authenticated;
revoke all on public.job_reports from anon, authenticated;
grant select (id, title, employer_name, location, category, mode, pay, description, requirements,
              phone, whatsapp, email, employer_verified, status, created_at, published_at)
  on public.jobs to anon, authenticated;
grant insert (title, employer_name, location, category, mode, pay, description, requirements,
              phone, whatsapp, email)
  on public.jobs to anon, authenticated;
grant insert (job_id, reason, details) on public.job_reports to anon, authenticated;
-- Lets the job_reports RLS check confirm the job is published without exposing other columns.
grant select (id, status) on public.jobs to anon, authenticated;

-- Moderation happens in the Supabase dashboard (service role bypasses RLS):
--   update public.jobs set status = 'published', employer_verified = false where id = '...';
--   update public.jobs set employer_verified = true where id = '...';  -- only after a real check
