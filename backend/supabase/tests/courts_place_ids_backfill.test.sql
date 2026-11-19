-- 20261117150000_courts_backfill_place_ids.sql: the catalog courts that
-- matched confidently have their Place ID, and each passes the column's
-- check (same rule as GooglePlaceIdSchema). Run against the local stack only:
--   cd backend && supabase test db --local
begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

select results_eq(
  $$select id, google_place_id from public.courts
      where id in ('b1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000002',
                   'b1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000006',
                   'b1000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000008')
      order by id$$,
  $$values ('b1000000-0000-4000-8000-000000000001'::uuid, 'ChIJ_0XKchXbt4kRN1XsMDJa25o'::text),
           ('b1000000-0000-4000-8000-000000000002'::uuid, 'ChIJ4cipz8fat4kR5rDr-wVJ-w4'::text),
           ('b1000000-0000-4000-8000-000000000003'::uuid, 'ChIJJY3v5pXat4kRpQgLq2Qj5LQ'::text),
           ('b1000000-0000-4000-8000-000000000006'::uuid, 'ChIJZZqXvsPEt4kRDXhlkSR9HUM'::text),
           ('b1000000-0000-4000-8000-000000000007'::uuid, 'ChIJ7Y8A5GbFt4kRLWyDdaMP3KA'::text),
           ('b1000000-0000-4000-8000-000000000008'::uuid, 'ChIJFfr9rsnRt4kRv-an6kufDz0'::text)$$,
  'the confidently matched catalog courts have their backfilled Place IDs'
);

select is(
  (select count(*)::int from public.courts
    where id::text like 'b1000000-%' and google_place_id is not null
      and google_place_id !~ '^\S(.*\S)?$'),
  0,
  'every backfilled Place ID passes the google_place_id check'
);

-- Signed out, the anon key court-photo uses sees them.
set local role anon;

select is(
  (select count(*)::int from public.courts_geojson
    where id::text like 'b1000000-%' and google_place_id is not null),
  6,
  'anon reads the six backfilled Place IDs'
);

reset role;

select * from finish();
rollback;
