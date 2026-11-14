-- public.clerk_sync_user / public.clerk_delete_user and the
-- deleted_clerk_users tombstone (20261113140000_users_clerk_updated_at.sql):
-- the ordering and deletion guarantees behind clerk-webhook and
-- player-profile. Run against the local stack only:
--   cd backend && supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(31);

-- Runs as service_role, like the edge functions do.
set local role service_role;

-- insert
select is(
  public.clerk_sync_user('user_pgtap', 'Ada', 'Lovelace', 'ada@example.com', null, 'email', '2026-11-01 12:00:00+00'),
  '{"outcome": "inserted"}'::jsonb,
  'a missing row is inserted'
);
select is(
  (select clerk_updated_at from public.users where clerk_user_id = 'user_pgtap'),
  '2026-11-01 12:00:00+00'::timestamptz,
  'the insert stores clerk_updated_at'
);

-- player-owned columns, written as player-profile would
update public.users set username = 'ada_l', dominant_hand = 'right', date_of_birth = '1990-12-10'
 where clerk_user_id = 'user_pgtap';

-- newer applies
select is(
  public.clerk_sync_user('user_pgtap', 'Augusta', 'King', 'augusta@example.com', '+15555550100', 'both', '2026-11-01 12:01:00+00'),
  '{"outcome": "updated"}'::jsonb,
  'a newer write applies'
);
select results_eq(
  $$select first_name, last_name, email, phone_number, login_method::text, clerk_updated_at
      from public.users where clerk_user_id = 'user_pgtap'$$,
  $$values ('Augusta', 'King', 'augusta@example.com', '+15555550100', 'both', '2026-11-01 12:01:00+00'::timestamptz)$$,
  'the newer write set every Clerk-owned column'
);
select results_eq(
  $$select username, dominant_hand::text, date_of_birth from public.users where clerk_user_id = 'user_pgtap'$$,
  $$values ('ada_l', 'right', '1990-12-10'::date)$$,
  'player-owned columns are untouched'
);

-- older is skipped and reports the stored values
select is(
  public.clerk_sync_user('user_pgtap', 'Ada', 'Lovelace', 'ada@example.com', null, 'email', '2026-11-01 12:00:30+00') ->> 'outcome',
  'stale',
  'an older write is stale'
);
select is(
  public.clerk_sync_user('user_pgtap', 'Ada', 'Lovelace', 'ada@example.com', null, 'email', '2026-11-01 12:00:30+00')
    -> 'stored' ->> 'first_name',
  'Augusta',
  'a stale result carries the stored values'
);
select is(
  (select first_name from public.users where clerk_user_id = 'user_pgtap'),
  'Augusta',
  'the older write changed nothing'
);

-- equal timestamp (Svix retry) is skipped
select is(
  public.clerk_sync_user('user_pgtap', 'Retry', 'Retry', null, null, 'email', '2026-11-01 12:01:00+00') ->> 'outcome',
  'stale',
  'an equal timestamp is skipped'
);
select is(
  (select first_name from public.users where clerk_user_id = 'user_pgtap'),
  'Augusta',
  'the equal-timestamp write changed nothing'
);

-- null stored clerk_updated_at (row from before the migration) accepts
update public.users set clerk_updated_at = null where clerk_user_id = 'user_pgtap';
select is(
  public.clerk_sync_user('user_pgtap', 'Ada', 'Lovelace', 'ada@example.com', null, 'email', '2020-01-01 00:00:00+00'),
  '{"outcome": "updated"}'::jsonb,
  'a null stored clerk_updated_at accepts any write'
);
select is(
  (select first_name from public.users where clerk_user_id = 'user_pgtap'),
  'Ada',
  'the write applied over the null timestamp'
);

-- update before create: updated(t2) inserts, then created(t1) is stale
select is(
  public.clerk_sync_user('user_pgtap_order', 'Newer', 'Name', null, '+15555550101', 'phone', '2026-11-02 10:00:00+00'),
  '{"outcome": "inserted"}'::jsonb,
  'user.updated arriving first inserts the row'
);
select is(
  public.clerk_sync_user('user_pgtap_order', 'Older', 'Name', null, '+15555550101', 'phone', '2026-11-02 09:00:00+00') ->> 'outcome',
  'stale',
  'the older user.created arriving second is stale'
);
select results_eq(
  $$select first_name, clerk_updated_at from public.users where clerk_user_id = 'user_pgtap_order'$$,
  $$values ('Newer', '2026-11-02 10:00:00+00'::timestamptz)$$,
  'the row keeps the newer (t2) values'
);

-- hard delete: tombstone + row delete in one call, cascading to player_ratings
update public.users set id = 'a0000000-0000-4000-8000-0000000000aa' where clerk_user_id = 'user_pgtap';
insert into public.player_ratings (user_id) values ('a0000000-0000-4000-8000-0000000000aa');
select is(
  public.clerk_delete_user('user_pgtap'),
  '{"deleted_rows": 1}'::jsonb,
  'clerk_delete_user deletes the row'
);
select is(
  (select count(*)::int from public.users where clerk_user_id = 'user_pgtap'),
  0,
  'the users row is gone'
);
select is(
  (select count(*)::int from public.player_ratings where user_id = 'a0000000-0000-4000-8000-0000000000aa'),
  0,
  'the delete cascaded to player_ratings'
);
select is(
  (select count(*)::int from public.deleted_clerk_users where clerk_user_id = 'user_pgtap'),
  1,
  'a tombstone was recorded'
);
select is(
  public.clerk_delete_user('user_pgtap'),
  '{"deleted_rows": 0}'::jsonb,
  'clerk_delete_user is idempotent'
);

-- nothing recreates a tombstoned user
select is(
  public.clerk_sync_user('user_pgtap', 'Ada', 'Lovelace', 'ada@example.com', null, 'email', '2026-11-01 11:00:00+00'),
  '{"outcome": "deleted"}'::jsonb,
  'a late user.created (older) after the delete is refused'
);
select is(
  public.clerk_sync_user('user_pgtap', 'Ada', 'Lovelace', 'ada@example.com', null, 'email', '2026-12-01 00:00:00+00'),
  '{"outcome": "deleted"}'::jsonb,
  'a user.updated (newer) after the delete is refused'
);
select is(
  (select count(*)::int from public.users where clerk_user_id = 'user_pgtap'),
  0,
  'the deleted user was not recreated'
);

-- deleting a user that never had a row still tombstones them
select is(
  public.clerk_delete_user('user_pgtap_never'),
  '{"deleted_rows": 0}'::jsonb,
  'deleting an unknown user succeeds'
);
select is(
  public.clerk_sync_user('user_pgtap_never', 'Ghost', null, null, null, 'email', '2026-11-01 12:00:00+00') ->> 'outcome',
  'deleted',
  'an event that arrives after its delete cannot create the row'
);

reset role;

-- grants: only service_role may call the functions or read tombstones
select ok(
  has_function_privilege('service_role', 'public.clerk_sync_user(text, text, text, text, text, public.login_method, timestamptz)', 'execute')
    and has_function_privilege('service_role', 'public.clerk_delete_user(text)', 'execute'),
  'service_role can execute clerk_sync_user and clerk_delete_user'
);
select ok(
  not has_function_privilege('authenticated', 'public.clerk_sync_user(text, text, text, text, text, public.login_method, timestamptz)', 'execute')
    and not has_function_privilege('anon', 'public.clerk_sync_user(text, text, text, text, text, public.login_method, timestamptz)', 'execute'),
  'anon and authenticated cannot execute clerk_sync_user'
);
select ok(
  not has_function_privilege('authenticated', 'public.clerk_delete_user(text)', 'execute')
    and not has_function_privilege('anon', 'public.clerk_delete_user(text)', 'execute'),
  'anon and authenticated cannot execute clerk_delete_user'
);
select ok(
  not has_table_privilege('authenticated', 'public.deleted_clerk_users', 'select')
    and not has_table_privilege('anon', 'public.deleted_clerk_users', 'select'),
  'anon and authenticated cannot read deleted_clerk_users'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.deleted_clerk_users'::regclass),
  'deleted_clerk_users has RLS enabled'
);
select has_column('public', 'users', 'clerk_updated_at', 'public.users.clerk_updated_at exists');

select * from finish();
rollback;
