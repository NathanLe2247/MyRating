-- Onboarding step 1 ("Create your profile"): the fields the player fills in,
-- plus the Clerk identifiers we copy over at the same time so the row is
-- complete without a round-trip to Clerk. Written only by the
-- `player-profile` edge function (service role); clients still only read
-- their own row.

create type public.dominant_hand as enum ('left', 'ambi', 'right');

alter table public.users
  add column email text,
  add column phone_number text,
  add column date_of_birth date,
  add column dominant_hand public.dominant_hand,
  -- Object key in the R2 bucket; the public URL is R2_PUBLIC_URL + '/' + key.
  add column avatar_key text,
  -- Set when the player submits step 1. Null = hasn't finished it yet.
  add column profile_completed_at timestamptz;

-- Handles are lowercase so uniqueness is effectively case-insensitive; keep in
-- sync with UsernamePattern in mobile/src/constants/profile.ts.
alter table public.users
  add constraint users_username_format
    check (username ~ '^[a-z0-9_]{3,20}$'),
  -- "Not in the future" can't be a CHECK (current_date isn't immutable); the
  -- edge function enforces it.
  add constraint users_date_of_birth_range
    check (date_of_birth >= date '1900-01-01');

comment on column public.users.date_of_birth is
  'Used for age-bracketed tournaments and division seeding. Only readable by the player themselves (RLS).';
comment on column public.users.avatar_key is
  'R2 object key for the profile photo, under avatars/<clerk_user_id>/.';
