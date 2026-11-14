-- Minimal `Court` shape (mirrors shared/src/court.ts; change both together).
-- The full courts catalog (address, surfaces, photos, import source) is still
-- TBD per agent/skills/courts-catalog; extend this table, the view below and
-- the shared schema in the same PR when that lands.

create extension if not exists postgis with schema extensions;

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  -- CourtSchema requires a non-empty name.
  name text not null check (name <> ''),
  -- [lng, lat] in WGS 84. Geography so ST_DWithin radii are in metres.
  -- POINT EMPTY is valid geography but serializes as `coordinates: []`,
  -- which CourtSchema rejects. (ST_IsEmpty only takes geometry.)
  location extensions.geography(point, 4326) not null
    check (not extensions.st_isempty(location::extensions.geometry)),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.courts is
  'Pickleball courts. Active courts are readable signed out; written only by the service role. Clients read public.courts_geojson or call public.nearby_courts.';

-- Radius queries for the courts directory and matchmaking.
create index courts_location_idx on public.courts using gist (location);

alter table public.courts enable row level security;

-- Same reset-then-grant pattern as public.users: default privileges may have
-- granted anon/authenticated everything. Courts are public, non-user data:
-- signed-out users can browse courts near them (the one part of the app that
-- doesn't need sign-in). Writes go through the service role.
revoke all on public.courts from anon, authenticated;
grant select on public.courts to anon, authenticated;
grant select, insert, update, delete on public.courts to service_role;

-- Clients only ever see active courts; service_role bypasses RLS and sees all.
create policy "Active courts are publicly readable"
  on public.courts
  for select
  to anon, authenticated
  using (is_active);

-- PostgREST returns a raw geography column as WKB hex. This view hands
-- clients the GeoJSON shape shared/src/court.ts (CourtSchema) parses:
-- `location` = {"type":"Point","coordinates":[lng, lat]}.
-- security_invoker so the caller's grants and the RLS policy above apply.
create view public.courts_geojson
  with (security_invoker = true)
  as
  select
    id,
    name,
    extensions.st_asgeojson(location)::jsonb as location,
    is_active,
    created_at
  from public.courts;

comment on view public.courts_geojson is
  'public.courts with location as a GeoJSON Point. Rows match CourtSchema in shared/src/court.ts.';

-- Read-only for everyone: service_role writes go to public.courts, not the view.
revoke all on public.courts_geojson from anon, authenticated;
grant select on public.courts_geojson to anon, authenticated, service_role;

-- "Courts near me": active courts within radius_m metres of (lat, lng),
-- nearest first. Rows are a courts_geojson row plus distance_m, matching
-- NearbyCourtSchema in shared/src/court.ts. Clients call it through PostgREST:
-- supabase.rpc('nearby_courts', { lat, lng, radius_m }).
--
-- ST_DWithin on the geography column lets the planner use
-- courts_location_idx; distances are metres on the WGS 84 spheroid.
-- security invoker, so the caller's RLS applies too (anon/authenticated
-- already only see active courts; the is_active filter keeps service_role
-- callers consistent).
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
      extensions.st_distance(c.location, origin)
    from public.courts c
    where c.is_active
      and extensions.st_dwithin(c.location, origin, radius_m)
    order by 6, c.id
    limit max_results;
end;
$$;

comment on function public.nearby_courts(double precision, double precision, double precision, integer) is
  'Active courts within radius_m (max 100 km) of (lat, lng), nearest first, at most max_results (max 200). Rows match NearbyCourtSchema.';

revoke execute on function public.nearby_courts(double precision, double precision, double precision, integer) from public;
grant execute on function public.nearby_courts(double precision, double precision, double precision, integer)
  to anon, authenticated, service_role;
