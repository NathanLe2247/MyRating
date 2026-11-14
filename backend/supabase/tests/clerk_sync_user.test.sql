-- public.clerk_sync_user (20261113140000_users_clerk_updated_at.sql): the
-- stale-event guard behind the clerk-webhook edge function. Run against the
-- local stack only:
--   cd backend && supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

-- Runs as service_role, like clerk-webhook does.
set local role service_role;

-- insert path (user.created)
select is(
  public.clerk_sync_user('user_pgtap', 'Ada', 'Lovelace', 'ada@example.com', null, 'email', '2026-11-01 12:00:00+00', true),
  '{"outcome": "inserted"}'::jsonb,
  'user.created inserts a missing row'
);
select is(
  (select clerk_updated_at from public.users where clerk_user_id = 'user_pgtap'),
  '2026-11-01 12:00:00+00'::timestamptz,
  'the insert stores clerk_updated_at'
);

-- player-owned columns, written as player-profile would
update public.users set username = 'ada_l', dominant_hand = 'right', date_of_birth = '1990-12-10'
 where clerk_user_id = 'user_pgtap';

-- newer event applies
select is(
  public.clerk_sync_user('user_pgtap', 'Augusta', 'King', 'augusta@example.com', '+15555550100', 'both', '2026-11-01 12:01:00+00', false),
  '{"outcome": "updated"}'::jsonb,
  'a newer user.updated applies'
);
select results_eq(
  $$select first_name, last_name, email, phone_number, login_method::text, clerk_updated_at
      from public.users where clerk_user_id = 'user_pgtap'$$,
  $$values ('Augusta', 'King', 'augusta@example.com', '+15555550100', 'both', '2026-11-01 12:01:00+00'::timestamptz)$$,
  'the newer event wrote every Clerk-owned column'
);
select results_eq(
  $$select username, dominant_hand::text, date_of_birth from public.users where clerk_user_id = 'user_pgtap'$$,
  $$values ('ada_l', 'right', '1990-12-10'::date)$$,
  'player-owned columns are untouched'
);

-- older event is skipped and reports the stored values
select is(
  public.clerk_sync_user('user_pgtap', 'Ada', 'Lovelace', 'ada@example.com', null, 'email', '2026-11-01 12:00:30+00', false)
    ->> 'outcome',
  'stale',
  'an older user.updated is stale'
);
select is(
  public.clerk_sync_user('user_pgtap', 'Ada', 'Lovelace', 'ada@example.com', null, 'email', '2026-11-01 12:00:30+00', false)
    -> 'stored' ->> 'first_name',
  'Augusta',
  'a stale result carries the stored values'
);
select is(
  (select first_name from public.users where clerk_user_id = 'user_pgtap'),
  'Augusta',
  'the older event changed nothing'
);

-- equal timestamp (Svix retry) is skipped
select is(
  public.clerk_sync_user('user_pgtap', 'Retry', 'Retry', null, null, 'email', '2026-11-01 12:01:00+00', false) ->> 'outcome',
  'stale',
  'an equal timestamp is skipped'
);
select is(
  (select first_name from public.users where clerk_user_id = 'user_pgtap'),
  'Augusta',
  'the equal-timestamp event changed nothing'
);

-- an older user.created on an existing row is also guarded
select is(
  public.clerk_sync_user('user_pgtap', 'Ada', 'Lovelace', 'ada@example.com', null, 'email', '2026-11-01 11:00:00+00', true) ->> 'outcome',
  'stale',
  'a late user.created for an existing row is stale, not an overwrite'
);

-- null stored clerk_updated_at (row written by player-profile) accepts
update public.users set clerk_updated_at = null where clerk_user_id = 'user_pgtap';
select is(
  public.clerk_sync_user('user_pgtap', 'Ada', 'Lovelace', 'ada@example.com', null, 'email', '2020-01-01 00:00:00+00', false),
  '{"outcome": "updated"}'::jsonb,
  'a null stored clerk_updated_at accepts any event'
);
select is(
  (select first_name from public.users where clerk_user_id = 'user_pgtap'),
  'Ada',
  'the event applied over the null timestamp'
);

-- user.updated never inserts
select is(
  public.clerk_sync_user('user_pgtap_missing', 'Ghost', null, 'ghost@example.com', null, 'email', '2026-11-01 12:00:00+00', false),
  '{"outcome": "missing"}'::jsonb,
  'user.updated for an unknown user reports missing'
);
select is(
  (select count(*)::int from public.users where clerk_user_id = 'user_pgtap_missing'),
  0,
  'user.updated did not insert'
);

-- hard delete cascades to player_ratings
update public.users set id = 'a0000000-0000-4000-8000-0000000000aa' where clerk_user_id = 'user_pgtap';
insert into public.player_ratings (user_id) values ('a0000000-0000-4000-8000-0000000000aa');
delete from public.users where clerk_user_id = 'user_pgtap';
select is(
  (select count(*)::int from public.player_ratings where user_id = 'a0000000-0000-4000-8000-0000000000aa'),
  0,
  'deleting the user removed their player_ratings row'
);

reset role;

-- grants: only service_role may call it
select ok(
  has_function_privilege('service_role', 'public.clerk_sync_user(text, text, text, text, text, public.login_method, timestamptz, boolean)', 'execute'),
  'service_role can execute clerk_sync_user'
);
select ok(
  not has_function_privilege('authenticated', 'public.clerk_sync_user(text, text, text, text, text, public.login_method, timestamptz, boolean)', 'execute'),
  'authenticated cannot execute clerk_sync_user'
);
select ok(
  not has_function_privilege('anon', 'public.clerk_sync_user(text, text, text, text, text, public.login_method, timestamptz, boolean)', 'execute'),
  'anon cannot execute clerk_sync_user'
);
select has_column('public', 'users', 'clerk_updated_at', 'public.users.clerk_updated_at exists');

select * from finish();
rollback;
