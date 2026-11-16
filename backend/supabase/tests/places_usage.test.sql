-- public.places_usage and public.places_reserve_call
-- (20261116130000_places_usage.sql): court-photo's free-tier cap on Google
-- Places calls. Run against the local stack only:
--   cd backend && supabase test db --local
begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

-- Access: service role only.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.places_usage'::regclass),
  'places_usage has RLS on'
);
select ok(not has_table_privilege('anon', 'public.places_usage', 'select'), 'anon cannot read places_usage');
select ok(not has_table_privilege('authenticated', 'public.places_usage', 'select'), 'authenticated cannot read places_usage');
select ok(not has_table_privilege('anon', 'public.places_usage', 'insert'), 'anon cannot write places_usage');
select ok(
  not has_function_privilege('anon', 'public.places_reserve_call(text, integer, timestamptz)', 'execute'),
  'anon cannot execute places_reserve_call'
);
select ok(
  not has_function_privilege('authenticated', 'public.places_reserve_call(text, integer, timestamptz)', 'execute'),
  'authenticated cannot execute places_reserve_call'
);
select ok(
  has_function_privilege('service_role', 'public.places_reserve_call(text, integer, timestamptz)', 'execute'),
  'service_role can execute places_reserve_call'
);

set local role anon;
select throws_ok(
  $$select public.places_reserve_call('place_photo', 900)$$,
  '42501', null, 'calling places_reserve_call as anon is refused'
);
reset role;

-- Counting, as service_role (court-photo). A fixed month far from now() so
-- real rows can't interfere: cap 2.
set local role service_role;

select is(public.places_reserve_call('place_photo', 2, '2030-01-15 12:00+00'), true, '1st call under the cap is allowed');
select is(public.places_reserve_call('place_photo', 2, '2030-01-31 23:59+00'), true, '2nd call (same UTC month) is allowed');
select is(public.places_reserve_call('place_photo', 2, '2030-01-20 00:00+00'), false, '3rd call is refused at the cap');
select is(
  (select calls from public.places_usage where month = '2030-01-01' and sku = 'place_photo'),
  2,
  'a refused call is not counted'
);

select is(public.places_reserve_call('place_details', 2, '2030-01-20 00:00+00'), true, 'the counter is per SKU');

-- 2030-02-01 00:30 in UTC is still January in America/New_York: months are UTC.
select is(public.places_reserve_call('place_photo', 2, '2030-02-01 00:30+00'), true, 'a new UTC month starts a new count');
select is(
  (select calls from public.places_usage where month = '2030-02-01' and sku = 'place_photo'),
  1,
  'the new month row counts from 1'
);
select is(public.places_reserve_call('place_photo', 2, '2030-01-31 20:00-05'), true,
  '2030-01-31 20:00 EST is 2030-02-01 UTC, so it counts in February');
select is(public.places_reserve_call('place_photo', 2, '2030-02-10 00:00+00'), false, 'February is now at the cap too');

select is(public.places_reserve_call('place_photo', 0, '2030-03-01 00:00+00'), false, 'cap 0 refuses every call');
select is(public.places_reserve_call('place_photo', null, '2030-03-01 00:00+00'), false, 'a null cap refuses every call');

select throws_ok(
  $$select public.places_reserve_call('place_text_search', 900, '2030-01-01 00:00+00')$$,
  '23514', null, 'an unknown SKU is rejected'
);

reset role;

-- The real cap: 1,000 attempts in one month allow exactly 900. The increment
-- is a single upsert (calls = calls + 1 under the row lock, guarded by
-- calls < cap), never read-then-write, so concurrent calls can't overshoot.
select is(
  (select count(*)::int from generate_series(1, 1000)
    where public.places_reserve_call('place_details', 900, '2030-04-01 00:00+00')),
  900,
  '1,000 attempts against a cap of 900 allow exactly 900'
);
select is(
  (select calls from public.places_usage where month = '2030-04-01' and sku = 'place_details'),
  900,
  'the counter stops at the cap'
);

select * from finish();
rollback;
