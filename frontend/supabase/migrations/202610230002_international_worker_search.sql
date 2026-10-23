-- International worker directory search, server-side matching and pagination.
-- Works for every ISO country code already accepted by worker_profiles.
-- Explicitly public columns only: inherits worker_directory's active-profile filter.
create or replace function public.search_public_workers(
  p_country text, p_service text, p_town text default '',
  p_offset integer default 0, p_limit integer default 25
)
returns setof public.worker_directory
language sql stable security invoker
set search_path = ''
as $$
  with requested as (
    select btrim(lower(regexp_replace(coalesce(p_town, ''), '\s+(capital city|city|district|municipality|county)$', '', 'i'))) as town
  )
  select w.*
  from public.worker_directory as w
  cross join requested as r
  where w.country_code = p_country
    and (p_service = '' or p_service = any(w.services))
    and (
      r.town = ''
      or btrim(lower(regexp_replace(w.town, '\s+(capital city|city|district|municipality|county)$', '', 'i'))) = r.town
      or (w.travel_mode <> 'fixed'
          and exists (
            select 1 from unnest(w.service_areas) as served(area)
            where btrim(lower(regexp_replace(served.area, '\s+(capital city|city|district|municipality|county)$', '', 'i'))) = r.town
          ))
    )
  order by
    case when r.town <> '' and
      btrim(lower(regexp_replace(w.town, '\s+(capital city|city|district|municipality|county)$', '', 'i'))) = r.town
      then 0 else 1 end,
    lower(w.display_name), w.id
  limit least(greatest(coalesce(p_limit, 25), 1), 50)
  offset least(greatest(coalesce(p_offset, 0), 0), 100000);
$$;
revoke all on function public.search_public_workers(text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.search_public_workers(text, text, text, integer, integer)
  to anon, authenticated;
comment on function public.search_public_workers(text, text, text, integer, integer)
  is 'Public, server-paginated country/service/area search using only published worker_directory rows. Never returns worker user IDs or auth emails.';
