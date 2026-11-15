-- Ratings/results hardening (20261115120000_ratings_hardening.sql, issue #95):
-- the match_games primary key, match_results_submit's p_games check,
-- ratings_apply's server-side `before`, its player_id lock order, and
-- match_changed. Run against the local stack only:
--   cd backend && supabase test db --local
begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

-- p, q: rated (p's id sorts first). r: unrated. s: an outsider.
insert into public.users (id, clerk_user_id, username, login_method)
values
  ('f2000000-0000-4000-8000-0000000000a1', 'user_pgtap_hard_p', 'pgtap_hard_p', 'email'),
  ('f2000000-0000-4000-8000-0000000000b2', 'user_pgtap_hard_q', 'pgtap_hard_q', 'email'),
  ('f2000000-0000-4000-8000-0000000000c3', 'user_pgtap_hard_r', 'pgtap_hard_r', 'email');

insert into public.player_ratings (user_id, rating, mmr, rating_deviation, volatility)
values
  ('f2000000-0000-4000-8000-0000000000a1', 1500, 1500, 200, 0.06),
  ('f2000000-0000-4000-8000-0000000000b2', 1400, 1400, 30, 0.06);

-- pq: p vs q. rq: r vs q (r unrated). pq2: p vs q, still accepted.
insert into public.matches (id, player_a_id, player_b_id, status, player_a_accepted_at, player_b_accepted_at)
values
  ('f3000000-0000-4000-8000-0000000000ab', 'f2000000-0000-4000-8000-0000000000a1',
   'f2000000-0000-4000-8000-0000000000b2', 'accepted', now(), now()),
  ('f3000000-0000-4000-8000-0000000000cb', 'f2000000-0000-4000-8000-0000000000c3',
   'f2000000-0000-4000-8000-0000000000b2', 'accepted', now(), now()),
  ('f3000000-0000-4000-8000-0000000000ba', 'f2000000-0000-4000-8000-0000000000b2',
   'f2000000-0000-4000-8000-0000000000a1', 'accepted', now(), now());

-- ---------------------------------------------------------------------------
-- match_games primary key (item 3)
-- ---------------------------------------------------------------------------

select col_is_pk('public', 'match_games', array['match_id', 'game_number'],
  'match_games is keyed by (match_id, game_number)');
select is(
  (select relreplident::text from pg_class where oid = 'public.match_games'::regclass),
  'd',
  'match_games has the default (primary key) replica identity'
);
select hasnt_index('public', 'match_games', 'match_games_match_game_unique',
  'the old unique constraint is gone');

-- ---------------------------------------------------------------------------
-- match_results_submit's p_games check (item 5)
-- ---------------------------------------------------------------------------
set local role service_role;

select throws_ok(
  $$select public.match_results_submit('f2000000-0000-4000-8000-0000000000a1', 'f3000000-0000-4000-8000-0000000000ab',
      '{"player_a_points": 11, "player_b_points": 7}')$$,
  '22023', 'invalid_result', 'an object is not a list of games'
);
select throws_ok(
  $$select public.match_results_submit('f2000000-0000-4000-8000-0000000000a1', 'f3000000-0000-4000-8000-0000000000ab',
      '"11-7"')$$,
  '22023', 'invalid_result', 'a scalar is not a list of games'
);
select throws_ok(
  $$select public.match_results_submit('f2000000-0000-4000-8000-0000000000a1', 'f3000000-0000-4000-8000-0000000000ab', null)$$,
  '22023', 'invalid_result', 'null is not a list of games'
);
select throws_ok(
  $$select public.match_results_submit('f2000000-0000-4000-8000-0000000000a1', 'f3000000-0000-4000-8000-0000000000ab',
      '[{"player_a_points": 11, "player_b_points": 1}, {"player_a_points": 11, "player_b_points": 2},
        {"player_a_points": 11, "player_b_points": 3}, {"player_a_points": 11, "player_b_points": 4}]')$$,
  '22023', 'invalid_result', 'more than 3 games is refused'
);

-- ---------------------------------------------------------------------------
-- match_changed: a confirm computed before the score was reported
-- ---------------------------------------------------------------------------

select public.match_results_submit('f2000000-0000-4000-8000-0000000000a1', 'f3000000-0000-4000-8000-0000000000ab',
  '[{"player_a_points": 11, "player_b_points": 7}]');
select throws_ok(
  $$select public.ratings_apply('f3000000-0000-4000-8000-0000000000ab', 'f2000000-0000-4000-8000-0000000000b2', '[]')$$,
  'P0001', 'match_changed', 'no updates for a match awaiting confirmation is match_changed'
);
select throws_ok(
  $$select public.ratings_apply('f3000000-0000-4000-8000-0000000000ab', 'f2000000-0000-4000-8000-0000000000b2', null)$$,
  'P0001', 'match_changed', 'null updates for a match awaiting confirmation is match_changed'
);

-- ---------------------------------------------------------------------------
-- `before` comes from the database (item 1)
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.ratings_apply('f3000000-0000-4000-8000-0000000000ab', 'f2000000-0000-4000-8000-0000000000b2',
      '[{"player_id": "f2000000-0000-4000-8000-0000000000a1", "expected_rating": 1500, "expected_mmr": 1500,
         "expected_rating_deviation": 200, "expected_volatility": 0.06, "before": 1000, "rating": 1563.46,
         "rating_deviation": 175.12, "volatility": 0.059998},
        {"player_id": "f2000000-0000-4000-8000-0000000000b2", "expected_rating": 1400, "expected_mmr": 1400,
         "expected_rating_deviation": 30, "expected_volatility": 0.06, "before": 1400, "rating": 1398.10,
         "rating_deviation": 29.95, "volatility": 0.059999}]')$$,
  '22023', 'invalid_update', 'a `before` that isn''t the current rating is refused'
);
select results_eq(
  $$select (select status::text from public.matches where id = 'f3000000-0000-4000-8000-0000000000ab'),
           (select count(*)::int from public.rating_history where match_id = 'f3000000-0000-4000-8000-0000000000ab'),
           (select rating from public.player_ratings where user_id = 'f2000000-0000-4000-8000-0000000000a1')$$,
  $$values ('awaiting_confirmation'::text, 0, 1500.00::numeric)$$,
  'a refused `before` writes nothing'
);

select public.match_results_submit('f2000000-0000-4000-8000-0000000000c3', 'f3000000-0000-4000-8000-0000000000cb',
  '[{"player_a_points": 11, "player_b_points": 7}]');
select throws_ok(
  $$select public.ratings_apply('f3000000-0000-4000-8000-0000000000cb', 'f2000000-0000-4000-8000-0000000000b2',
      '[{"player_id": "f2000000-0000-4000-8000-0000000000c3", "expected_rating": null, "expected_mmr": null,
         "expected_rating_deviation": null, "expected_volatility": null, "before": 1400, "rating": 1650,
         "rating_deviation": 290, "volatility": 0.06},
        {"player_id": "f2000000-0000-4000-8000-0000000000b2", "expected_rating": 1400, "expected_mmr": 1400,
         "expected_rating_deviation": 30, "expected_volatility": 0.06, "before": 1400, "rating": 1395,
         "rating_deviation": 30, "volatility": 0.06}]')$$,
  '22023', 'invalid_update', 'an unrated player''s `before` must be 1500'
);

-- ---------------------------------------------------------------------------
-- Lock and write order (item 2)
-- ---------------------------------------------------------------------------
-- A logging trigger records the order ratings_apply touches player_ratings
-- rows in (each row is locked with select ... for update just before). The
-- updates are passed in descending player_id order; they must be applied in
-- ascending order. Run as the owner so the log table needs no grants.
reset role;

create temp table rating_write_log (seq serial, user_id uuid);
create function pg_temp.log_rating_write() returns trigger language plpgsql as $$
begin
  insert into rating_write_log (user_id) values (new.user_id);
  return new;
end;
$$;
create trigger zz_log_rating_write before insert or update on public.player_ratings
  for each row execute function pg_temp.log_rating_write();

select is(
  public.ratings_apply('f3000000-0000-4000-8000-0000000000ab', 'f2000000-0000-4000-8000-0000000000b2',
    '[{"player_id": "f2000000-0000-4000-8000-0000000000b2", "expected_rating": 1400, "expected_mmr": 1400,
       "expected_rating_deviation": 30, "expected_volatility": 0.06, "before": 1400, "rating": 1398.10,
       "rating_deviation": 29.95, "volatility": 0.059999},
      {"player_id": "f2000000-0000-4000-8000-0000000000a1", "expected_rating": 1500, "expected_mmr": 1500,
       "expected_rating_deviation": 200, "expected_volatility": 0.06, "before": 1500, "rating": 1563.46,
       "rating_deviation": 175.12, "volatility": 0.059998}]'),
  true,
  'updates given in any order are applied'
);
select is(
  (select array_agg(user_id order by seq) from rating_write_log),
  array['f2000000-0000-4000-8000-0000000000a1', 'f2000000-0000-4000-8000-0000000000b2']::uuid[],
  'player rows are locked and written in player_id order'
);
select results_eq(
  $$select player_id, before, after from public.rating_history
     where match_id = 'f3000000-0000-4000-8000-0000000000ab' order by player_id$$,
  $$values ('f2000000-0000-4000-8000-0000000000a1'::uuid, 1500.00::numeric, 1563.46::numeric),
           ('f2000000-0000-4000-8000-0000000000b2'::uuid, 1400.00::numeric, 1398.10::numeric)$$,
  'rating_history records the database''s `before`'
);

-- The same players the other way round (q is player a): same order.
delete from rating_write_log;
select public.match_results_submit('f2000000-0000-4000-8000-0000000000b2', 'f3000000-0000-4000-8000-0000000000ba',
  '[{"player_a_points": 11, "player_b_points": 7}]');
select is(
  public.ratings_apply('f3000000-0000-4000-8000-0000000000ba', 'f2000000-0000-4000-8000-0000000000a1',
    '[{"player_id": "f2000000-0000-4000-8000-0000000000b2", "expected_rating": 1398.10, "expected_mmr": 1398.10,
       "expected_rating_deviation": 29.95, "expected_volatility": 0.059999, "before": 1398.10, "rating": 1400,
       "rating_deviation": 29.9, "volatility": 0.059999},
      {"player_id": "f2000000-0000-4000-8000-0000000000a1", "expected_rating": 1563.46, "expected_mmr": 1563.46,
       "expected_rating_deviation": 175.12, "expected_volatility": 0.059998, "before": 1563.46, "rating": 1540,
       "rating_deviation": 160, "volatility": 0.059998}]'),
  true,
  'a match with the players swapped is applied'
);
select is(
  (select array_agg(user_id order by seq) from rating_write_log),
  array['f2000000-0000-4000-8000-0000000000a1', 'f2000000-0000-4000-8000-0000000000b2']::uuid[],
  'the lock order does not depend on which side a player is on'
);

drop trigger zz_log_rating_write on public.player_ratings;

select * from finish();
rollback;
