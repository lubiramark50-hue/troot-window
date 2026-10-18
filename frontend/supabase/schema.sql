-- Troot Window: Supabase schema, RLS and abuse controls.
-- Already applied to project wftjesokdmjzixshjcwf. Safe to re-run.
-- Jobs publish immediately. Guards: per-network rate limits, duplicate
-- blocking, server-controlled status/verification and a 30-day expiry.

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 160),
  employer_name text not null check (char_length(employer_name) between 2 and 160),
  location text not null check (char_length(location) between 2 and 120),
  category text not null check (category in ('Construction','Technology','Trades','Hospitality','Transport','Other')),
  mode text not null check (mode in ('OnSite','Hybrid','Remote')),
  pay text not null check (char_length(pay) between 1 and 120),
  salary_min numeric(14,2),
  salary_max numeric(14,2),
  salary_currency text not null default 'UGX',
  pay_period text,
  experience_level text,
  application_deadline date,
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
  constraint jobs_has_contact check (phone is not null or whatsapp is not null or email is not null),
  constraint jobs_salary_range_pair_valid check ((salary_min is null and salary_max is null) or (salary_min is not null and salary_max is not null)),
  constraint jobs_salary_range_valid check (salary_min is null or salary_max is null or salary_max >= salary_min),
  constraint jobs_salary_nonnegative check ((salary_min is null or salary_min >= 0) and (salary_max is null or salary_max >= 0)),
  constraint jobs_pay_period_valid check (pay_period is null or pay_period in ('Hourly','Daily','Weekly','Monthly','Yearly','Contract')),
  constraint jobs_experience_level_valid check (experience_level is null or experience_level in ('Entry level','Junior','Mid-level','Senior','Lead / Manager')),
  constraint jobs_salary_currency_valid check (salary_currency in ('UGX','USD','KES','TZS','RWF','ZAR','GBP','EUR'))
);

-- Additive, idempotent upgrade for an already-created jobs table.
alter table public.jobs add column if not exists salary_min numeric(14,2);
alter table public.jobs add column if not exists salary_max numeric(14,2);
alter table public.jobs add column if not exists salary_currency text not null default 'UGX';
alter table public.jobs add column if not exists pay_period text;
alter table public.jobs add column if not exists experience_level text;
alter table public.jobs add column if not exists application_deadline date;
do $constraints$
begin
  if not exists (select 1 from pg_constraint where conname = 'jobs_salary_range_pair_valid') then alter table public.jobs add constraint jobs_salary_range_pair_valid check ((salary_min is null and salary_max is null) or (salary_min is not null and salary_max is not null)); end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_salary_range_valid') then alter table public.jobs add constraint jobs_salary_range_valid check (salary_min is null or salary_max is null or salary_max >= salary_min); end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_salary_nonnegative') then alter table public.jobs add constraint jobs_salary_nonnegative check ((salary_min is null or salary_min >= 0) and (salary_max is null or salary_max >= 0)); end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_pay_period_valid') then alter table public.jobs add constraint jobs_pay_period_valid check (pay_period is null or pay_period in ('Hourly','Daily','Weekly','Monthly','Yearly','Contract')); end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_experience_level_valid') then alter table public.jobs add constraint jobs_experience_level_valid check (experience_level is null or experience_level in ('Entry level','Junior','Mid-level','Senior','Lead / Manager')); end if;
  if not exists (select 1 from pg_constraint where conname = 'jobs_salary_currency_valid') then alter table public.jobs add constraint jobs_salary_currency_valid check (salary_currency in ('UGX','USD','KES','TZS','RWF','ZAR','GBP','EUR')); end if;
end $constraints$;

create table if not exists public.job_reports (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 60),
  details text check (details is null or char_length(details) <= 1000),
  reporter_hash text not null default 'unknown',
  created_at timestamptz not null default now(),
  unique (job_id, reporter_hash)
);

alter table public.jobs
  add column if not exists expires_at timestamptz not null default (now() + interval '30 days');

-- Provenance for listings synced from an employer's own careers feed or a
-- public job feed. Rows submitted through the app leave all of these null, and
-- the insert trigger clears them so provenance can never be claimed by a client.
alter table public.jobs
  add column if not exists source text,
  add column if not exists source_url text,
  add column if not exists external_id text,
  add column if not exists company_domain text,
  add column if not exists last_seen_at timestamptz;

-- Idempotent re-syncs: one row per listing per source.
create unique index if not exists jobs_source_external_idx
  on public.jobs (source, external_id)
  where source is not null and external_id is not null;

-- A synced listing's contact path is its original posting, so it does not need
-- a phone number or email to be valid.
alter table public.jobs drop constraint if exists jobs_has_contact;
alter table public.jobs add constraint jobs_has_contact
  check (phone is not null or whatsapp is not null or email is not null or source_url is not null);

create index if not exists jobs_feed_idx on public.jobs (status, employer_verified desc, created_at desc);
create index if not exists jobs_category_idx on public.jobs (status, category, created_at desc);
create index if not exists jobs_submitter_idx on public.jobs (submitter_hash, created_at desc);
create index if not exists jobs_expiry_idx on public.jobs (status, expires_at);
create index if not exists jobs_external_idx on public.jobs (source, last_seen_at) where source is not null;
create index if not exists reports_job_idx on public.job_reports (job_id, created_at desc);

-- Sources whose listings come straight from the employer's own applicant
-- tracking system. Only these may be marked as verified employers.
create or replace function public.is_trusted_source(p_source text) returns boolean
language sql immutable set search_path = public as $$
  select p_source in ('greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters');
$$;

-- Caller fingerprint: hashed client IP from the API gateway. Raw IPs are never stored.
create or replace function public.caller_hash() returns text
language sql stable set search_path = public as $$
  select encode(sha256(convert_to(coalesce(
    nullif(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for', ''), ',', 1), ''),
    'unknown'), 'utf8')), 'hex')
$$;

create or replace function public.jobs_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ingest boolean := coalesce(current_setting('troot.ingest', true), '') = 'on';
begin
  if v_ingest then
    -- Rows written by the scheduled sync (see ingest_external_jobs). They come
    -- from an employer's own feed, so provenance is trusted and the per-network
    -- limits meant for anonymous visitors do not apply. Verification is only
    -- ever granted for a trusted source, whatever the payload claims.
    new.submitter_hash := 'source:' || coalesce(new.source, 'unknown');
    new.status := 'published';
    new.employer_verified := coalesce(new.employer_verified, false)
      and public.is_trusted_source(new.source);
    new.published_at := coalesce(new.published_at, now());
    new.expires_at := now() + interval '30 days';
    new.last_seen_at := now();
    new.title := btrim(new.title);
    return new;
  end if;

  -- A public submission can never claim provenance or verification.
  new.source := null;
  new.source_url := null;
  new.external_id := null;
  new.company_domain := null;
  new.last_seen_at := null;
  new.submitter_hash := public.caller_hash();
  new.status := 'published';
  new.employer_verified := false;
  new.published_at := now();
  new.expires_at := now() + interval '30 days';
  new.title := btrim(new.title);
  -- Burst limit: 5 posts per 10 minutes per network.
  if (select count(*) from public.jobs
        where submitter_hash = new.submitter_hash
          and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  -- Daily limit: 20 posts per 24 hours per network.
  if (select count(*) from public.jobs
        where submitter_hash = new.submitter_hash
          and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  -- Duplicate guard: the same job cannot be posted twice within 24 hours.
  if exists (select 1 from public.jobs j
             where lower(j.title) = lower(new.title)
               and lower(j.employer_name) = lower(new.employer_name)
               and lower(j.location) = lower(new.location)
               and j.created_at > now() - interval '24 hours') then
    raise exception 'duplicate_job' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.close_expired_jobs() returns void
language sql security definer set search_path = public as $$
  update public.jobs set status = 'closed'
  where status = 'published'
    and (expires_at < now() or (application_deadline is not null and application_deadline < current_date));
$$;

-- Synced listings that have disappeared from their source feed are closed, so
-- the board never shows a vacancy that the employer has already filled.
create or replace function public.close_stale_external_jobs(p_stale_after interval default '7 days')
returns integer
language sql security definer set search_path = public as $$
  with closed as (
    update public.jobs set status = 'closed'
    where source is not null
      and status = 'published'
      and last_seen_at < now() - p_stale_after
    returning 1
  )
  select count(*)::integer from closed;
$$;

-- Called only by the scheduled sync over the database connection. Inserts a
-- listing the first time it is seen and refreshes it on every later sync, so a
-- re-run is idempotent. Rows that fail the table's own validation are skipped
-- rather than aborting the whole batch.
create or replace function public.ingest_external_jobs(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  v_id uuid;
  v_total integer := 0;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_skipped integer := 0;
begin
  perform set_config('troot.ingest', 'on', true);

  for item in select value from jsonb_array_elements(coalesce(payload, '[]'::jsonb)) loop
    v_total := v_total + 1;
    begin
      if coalesce(item->>'source', '') = '' or coalesce(item->>'external_id', '') = '' then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      select id into v_id from public.jobs
        where source = item->>'source'
          and external_id = item->>'external_id';

      if v_id is null then
        insert into public.jobs (
          title, employer_name, location, category, mode, pay, description,
          requirements, email, source, source_url, external_id, company_domain,
          employer_verified)
        values (
          left(item->>'title', 160),
          left(item->>'employer_name', 160),
          left(item->>'location', 120),
          item->>'category',
          item->>'mode',
          left(coalesce(nullif(item->>'pay', ''), 'Not disclosed'), 120),
          left(item->>'description', 5000),
          left(coalesce(nullif(item->>'requirements', ''), 'See the full listing for requirements.'), 1000),
          nullif(item->>'email', ''),
          item->>'source',
          item->>'source_url',
          item->>'external_id',
          nullif(item->>'company_domain', ''),
          coalesce((item->>'employer_verified')::boolean, false));
        v_inserted := v_inserted + 1;
      else
        update public.jobs set
          title = left(item->>'title', 160),
          employer_name = left(item->>'employer_name', 160),
          location = left(item->>'location', 120),
          category = item->>'category',
          mode = item->>'mode',
          pay = left(coalesce(nullif(item->>'pay', ''), 'Not disclosed'), 120),
          description = left(item->>'description', 5000),
          requirements = left(coalesce(nullif(item->>'requirements', ''), 'See the full listing for requirements.'), 1000),
          email = nullif(item->>'email', ''),
          source_url = item->>'source_url',
          company_domain = nullif(item->>'company_domain', ''),
          employer_verified = coalesce((item->>'employer_verified')::boolean, false)
            and public.is_trusted_source(item->>'source'),
          last_seen_at = now(),
          expires_at = now() + interval '30 days'
        where id = v_id;
        v_updated := v_updated + 1;
      end if;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  return jsonb_build_object('total', v_total, 'inserted', v_inserted,
                            'updated', v_updated, 'skipped', v_skipped);
end $$;

-- Only the database owner (the sync connection) may ingest or close listings.
revoke all on function public.ingest_external_jobs(jsonb) from public;
revoke all on function public.ingest_external_jobs(jsonb) from anon, authenticated;
revoke all on function public.close_stale_external_jobs(interval) from public;
revoke all on function public.close_stale_external_jobs(interval) from anon, authenticated;

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
  with check (employer_verified = false);

drop policy if exists "public reports published jobs" on public.job_reports;
create policy "public reports published jobs" on public.job_reports
  for insert to anon, authenticated
  with check (exists (select 1 from public.jobs j where j.id = job_id and j.status = 'published'));

-- Column-level grants: the app key can never read submitter_hash or report data,
-- and can never write status, verification or publish fields.
revoke all on public.jobs from anon, authenticated;
revoke all on public.job_reports from anon, authenticated;
grant select (id, title, employer_name, location, category, mode, pay, description, requirements,
              phone, whatsapp, email, employer_verified, status, created_at, published_at, expires_at,
              source, source_url, company_domain, salary_min, salary_max, salary_currency, pay_period,
              experience_level, application_deadline)
  on public.jobs to anon, authenticated;
grant insert (title, employer_name, location, category, mode, pay, description, requirements,
              phone, whatsapp, email, salary_min, salary_max, salary_currency, pay_period,
              experience_level, application_deadline)
  on public.jobs to anon, authenticated;
grant insert (job_id, reason, details) on public.job_reports to anon, authenticated;
-- Lets the job_reports RLS check confirm the job is published without exposing other columns.
grant select (id, status) on public.jobs to anon, authenticated;

-- Safeguarding happens in the Supabase dashboard (service role bypasses RLS):
--   update public.jobs set status = 'closed' where id = '...';         -- take a bad listing down
--   update public.jobs set employer_verified = true where id = '...';  -- only after a real check

-- Auto-close expired listings every hour once pg_cron is enabled
-- (Supabase dashboard > Database > Extensions > enable "pg_cron", then re-run this block).
do $do$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'Could not enable pg_cron automatically: %', SQLERRM;
end $do$;

do $do$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('close-expired-jobs', '15 * * * *', 'select public.close_expired_jobs()');
  else
    raise notice 'pg_cron not enabled yet - enable it in Database > Extensions and re-run this file.';
  end if;
end $do$;

-- Trigger functions are invoked by table triggers, not directly through PostgREST RPC.
-- Remove default PUBLIC execute grants so untrusted callers cannot invoke the SECURITY DEFINER bodies.
revoke all on function public.jobs_before_insert() from public, anon, authenticated;
revoke all on function public.reports_before_insert() from public, anon, authenticated;
