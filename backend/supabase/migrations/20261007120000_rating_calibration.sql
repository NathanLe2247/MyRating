-- Onboarding step 2 ("What's your pickleball rating?"): how the player's
-- starting rating is established, and when they finished onboarding. Written
-- only by the `player-profile` edge function (service role), like step 1.
--
-- Only 'calibration' is accepted today: the player starts unrated and gets a
-- provisional rating from their first placement matches (the `ratings` edge
-- function creates their player_ratings row then). DUPR / USA Pickleball
-- imports are planned but not wired up yet.

create type public.rating_source as enum ('calibration', 'dupr', 'usa_pickleball');

alter table public.users
  add column rating_source public.rating_source,
  -- Set when the player finishes step 2. Null = still onboarding.
  add column onboarding_completed_at timestamptz;

comment on column public.users.rating_source is
  'How the starting rating is established. calibration = provisional placement matches.';
