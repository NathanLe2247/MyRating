-- Court photos, part 1 (#106 / #105): a Google Place ID per court.
--
-- Google's Places terms allow storing a Place ID indefinitely, and nothing
-- else: photo names and photo URLs expire and must not be cached. So this is
-- the only Places data in the database. The `court-photo` edge function
-- resolves a fresh photo URL from it on each request (never persisted).
--
-- Nullable: a court with no confident Places match has no photo. The seeded
-- catalog courts (20261114120000_courts_silver_spring.sql) are backfilled by
-- a later data migration; until then they're null and court-photo 404s.
--
-- Mirrors shared/src/court.ts (CourtSchema.google_place_id); change both
-- together.

alter table public.courts
  add column google_place_id text
    -- Place IDs are opaque, but never empty or padded with any whitespace
    -- (spaces, tabs, newlines): a bad value would make court-photo call
    -- Places with a broken id. Same pattern as GooglePlaceIdSchema in
    -- shared/src/court.ts. (null passes a check, so no `is null` needed.)
    check (google_place_id ~ '^\S(.*\S)?$');

comment on column public.courts.google_place_id is
  'Google Places (New) place id for this venue, or null. The only Places data stored (photo names/URLs must not be). Read by the court-photo edge function.';

-- The view gains the column at the end (create or replace can only append).
-- Same options and grants as 20261113120000_courts.sql; create or replace
-- keeps the existing grants.
create or replace view public.courts_geojson
  with (security_invoker = true)
  as
  select
    id,
    name,
    extensions.st_asgeojson(location)::jsonb as location,
    is_active,
    created_at,
    google_place_id
  from public.courts;

-- nearby_courts returns the new column, so its row type changes: drop and
-- recreate (create or replace can't change a function's return type). The
-- body is unchanged apart from the extra column. matchmaking_nearest_court
-- calls it by name at run time (language sql bodies are not bound to the
-- old signature's return type), so it keeps working.
drop function public.nearby_courts(double precision, double precision, double precision, integer);

create function public.nearby_courts(
  lat double precision,
  lng double precision,
  radius_m double precision default 25000,
  max_results integer default 50
)
returns table (
  id uuid,
  name text,
  location jsonb,
  is_active boolean,
  created_at timestamptz,
  google_place_id text,
  distance_m double precision
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  origin extensions.geography;
begin
  -- `not (x between ...)` also rejects NaN; nulls are checked explicitly.
  if lat is null or not (lat between -90 and 90) then
    raise exception 'lat must be between -90 and 90' using errcode = '22023';
  end if;
  if lng is null or not (lng between -180 and 180) then
    raise exception 'lng must be between -180 and 180' using errcode = '22023';
  end if;
  if radius_m is null or not (radius_m > 0 and radius_m <= 100000) then
    raise exception 'radius_m must be > 0 and <= 100000 (100 km)' using errcode = '22023';
  end if;
  if max_results is null or not (max_results between 1 and 200) then
    raise exception 'max_results must be between 1 and 200' using errcode = '22023';
  end if;

  origin := extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography;

  return query
    select
      c.id,
      c.name,
      extensions.st_asgeojson(c.location)::jsonb,
      c.is_active,
      c.created_at,
      c.google_place_id,
      extensions.st_distance(c.location, origin)
    from public.courts c
    where c.is_active
      and extensions.st_dwithin(c.location, origin, radius_m)
    order by 7, c.id
    limit max_results;
end;
$$;

comment on function public.nearby_courts(double precision, double precision, double precision, integer) is
  'Active courts within radius_m (max 100 km) of (lat, lng), nearest first, at most max_results (max 200). Rows match NearbyCourtSchema.';

-- A dropped function loses its grants: restore them (anon must keep it, the
-- signed-out courts screen calls it).
revoke execute on function public.nearby_courts(double precision, double precision, double precision, integer) from public;
grant execute on function public.nearby_courts(double precision, double precision, double precision, integer)
  to anon, authenticated, service_role;
