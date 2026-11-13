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
  'Pickleball courts. Public data: readable signed out, written only by the service role. Clients read public.courts_geojson.';

-- Radius queries for the courts directory and matchmaking.
create index courts_location_idx on public.courts using gist (location);

alter table public.courts enable row level security;

-- Same reset-then-grant pattern as public.users: default privileges may have
-- granted anon/authenticated everything. Courts are public, non-user data,
-- readable while signed out; writes go through the service role.
revoke all on public.courts from anon, authenticated;
grant select on public.courts to anon, authenticated;
grant select, insert, update, delete on public.courts to service_role;

create policy "Courts are publicly readable"
  on public.courts
  for select
  to anon, authenticated
  using (true);

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
