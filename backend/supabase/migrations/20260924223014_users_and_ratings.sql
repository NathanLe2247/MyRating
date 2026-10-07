-- App-side user record plus the rating each player is matched on.
--
-- Clerk is the identity provider: `clerk_user_id` is the Clerk user id, which
-- is also the `sub` claim of the Clerk session JWT that Supabase verifies for
-- RLS. `id` is our own id — every other app table (matches, queue entries,
-- tournament registrations) references it, so nothing is coupled to Clerk ids.

create type public.login_method as enum ('phone', 'email', 'both');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  -- Nullable: phone/Google sign-ups don't have to pick one in Clerk.
  username text unique,
  first_name text,
  last_name text,
  login_method public.login_method not null,
  -- Bumped by the `ratings` edge function when a match is recorded.
  games_played integer not null default 0 check (games_played >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is
  'One row per Clerk user, written by the clerk-webhook edge function. id is ours; clerk_user_id = Clerk user id = JWT sub.';
comment on column public.users.login_method is
  'Which verified identifiers the Clerk user has. Google sign-in counts as email.';

alter table public.users enable row level security;

-- Supabase's default privileges may grant anon/authenticated everything on
-- new public tables (older projects and local dev do), so reset to nothing
-- and grant explicitly. Clients only read their own row; writes go through
-- the service role (clerk-webhook).
revoke all on public.users from anon, authenticated;
grant select on public.users to authenticated;
grant select, insert, update, delete on public.users to service_role;

create policy "Users can read their own row"
  on public.users
  for select
  to authenticated
  using ((select auth.jwt() ->> 'sub') = clerk_user_id);

-- Glicko-2 state per player. Written only by the `ratings` edge function
-- (see agent/skills/ratings-engine). `mmr` is the hidden skill estimate that
-- matchmaking uses for the ± window; `rating` is what players see.
create table public.player_ratings (
  user_id uuid primary key references public.users (id) on delete cascade,
  rating numeric(7, 2) not null default 1500,
  mmr numeric(7, 2) not null default 1500,
  rating_deviation numeric(6, 2) not null default 350,
  volatility numeric(8, 6) not null default 0.06,
  updated_at timestamptz not null default now()
);

comment on column public.player_ratings.mmr is
  'Hidden Glicko-2 rating used for matchmaking. Not granted to clients.';

-- Matchmaking queries search by mmr within a window.
create index player_ratings_mmr_idx on public.player_ratings (mmr);

alter table public.player_ratings enable row level security;

-- Column-level grant: clients can read ratings for leaderboards, but never
-- mmr or volatility. The revoke matters — a table-level grant from default
-- privileges would override the column list.
revoke all on public.player_ratings from anon, authenticated;
grant select (user_id, rating, rating_deviation, updated_at)
  on public.player_ratings to authenticated;
grant select, insert, update, delete on public.player_ratings to service_role;

create policy "Ratings are readable by signed-in users"
  on public.player_ratings
  for select
  to authenticated
  using (true);
