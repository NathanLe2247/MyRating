-- Minimal `Court` shape (mirrors shared/src/court.ts — change both together).
-- The full courts catalog (address, surfaces, photos, import source) is still
-- TBD per agent/skills/courts-catalog; extend this table and the shared
-- schema in the same PR when that lands.

create extension if not exists postgis with schema extensions;

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location extensions.geography(point, 4326) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

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
