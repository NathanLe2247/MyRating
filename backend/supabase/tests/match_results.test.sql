-- match_games / rating_history: constraints, RLS, the bot guard, and the
-- match_results_* / ratings_* functions
-- (20261114140000_match_results_ratings.sql). Run against the local stack only:
--   cd backend && supabase test db --local
--
-- The rating numbers passed to ratings_apply are arbitrary: the Glicko-2
-- math is tested in functions/ratings/ratings.test.ts. These tests cover
-- the state rules and the single-transaction write.
begin;

create extension if not exists pgtap with schema extensions;

select plan(56);

-- Players and matches, inserted as the migration owner (bypasses RLS).
-- a, b: rated. c: an outsider. d, e: unrated (no player_ratings row).
insert into public.users (id, clerk_user_id, username, login_method)
values
  ('f0000000-0000-4000-8000-0000000000a1', 'user_pgtap_res_a', 'pgtap_res_a', 'email'),
  ('f0000000-0000-4000-8000-0000000000b2', 'user_pgtap_res_b', 'pgtap_res_b', 'email'),
  ('f0000000-0000-4000-8000-0000000000c3', 'user_pgtap_res_c', 'pgtap_res_c', 'email'),
  ('f0000000-0000-4000-8000-0000000000d4', 'user_pgtap_res_d', 'pgtap_res_d', 'email'),
  ('f0000000-0000-4000-8000-0000000000e5', 'user_pgtap_res_e', 'pgtap_res_e', 'email');

insert into public.player_ratings (user_id, rating, mmr, rating_deviation, volatility)
values
  ('f0000000-0000-4000-8000-0000000000a1', 1500, 1500, 200, 0.06),
  ('f0000000-0000-4000-8000-0000000000b2', 1400, 1400, 30, 0.06);

-- ab: a vs b, accepted. ad: a vs d, accepted. ebot: e vs the Demo Tester,
-- accepted. pending: a vs c, still proposed.
insert into public.matches (id, player_a_id, player_b_id, status, player_a_accepted_at, player_b_accepted_at)
values
  ('f1000000-0000-4000-8000-0000000000ab', 'f0000000-0000-4000-8000-0000000000a1',
   'f0000000-0000-4000-8000-0000000000b2', 'accepted', now(), now()),
  ('f1000000-0000-4000-8000-0000000000ad', 'f0000000-0000-4000-8000-0000000000a1',
   'f0000000-0000-4000-8000-0000000000d4', 'accepted', now(), now()),
  ('f1000000-0000-4000-8000-0000000000e0', 'f0000000-0000-4000-8000-0000000000e5',
   '00000000-0000-4000-8000-0000000000d1', 'accepted', now(), now()),
  ('f1000000-0000-4000-8000-0000000000ac', 'f0000000-0000-4000-8000-0000000000a1',
   'f0000000-0000-4000-8000-0000000000c3', 'proposed', null, null);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select results_eq(
  $$select attgenerated::text, format_type(atttypid, atttypmod) from pg_attribute
     where attrelid = 'public.rating_history'::regclass and attname = 'delta'$$,
  $$values ('s'::text, 'numeric(7,2)'::text)$$,
  'rating_history.delta is a stored generated numeric(7,2)'
);

select is(
  (select format_type(atttypid, atttypmod) from pg_attribute
    where attrelid = 'public.rating_history'::regclass and attname = 'after'),
  (select format_type(atttypid, atttypmod) from pg_attribute
    where attrelid = 'public.player_ratings'::regclass and attname = 'rating'),
  'rating_history.after has the type of player_ratings.rating'
);

select col_is_pk('public', 'rating_history', array['match_id', 'player_id'], 'rating_history is keyed by (match_id, player_id)');

select ok(
  not has_function_privilege('authenticated', 'public.match_results_submit(uuid, uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.match_results_submit(uuid, uuid, jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.match_results_dispute(uuid, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.match_results_bot_confirm_due(uuid, interval)', 'execute')
    and not has_function_privilege('authenticated', 'public.match_results_state(uuid, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.ratings_match_inputs(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.ratings_apply(uuid, uuid, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.ratings_apply(uuid, uuid, jsonb)', 'execute'),
  'clients cannot call the match results or ratings functions'
);

select throws_ok(
  $$insert into public.match_games values ('f1000000-0000-4000-8000-0000000000ac', 4, 11, 5)$$,
  '23514', null, 'game_number is 1-3'
);
select throws_ok(
  $$insert into public.match_games values ('f1000000-0000-4000-8000-0000000000ac', 1, -1, 11)$$,
  '23514', null, 'points are non-negative'
);
insert into public.match_games values ('f1000000-0000-4000-8000-0000000000ac', 1, 11, 5);
select throws_ok(
  $$insert into public.match_games values ('f1000000-0000-4000-8000-0000000000ac', 1, 11, 7)$$,
  '23505', null, 'one row per (match_id, game_number)'
);
delete from public.match_games where match_id = 'f1000000-0000-4000-8000-0000000000ac';

-- The bot guard holds even for the owner.
select throws_ok(
  $$update public.player_ratings set rating = rating + 1 where user_id = '00000000-0000-4000-8000-0000000000d1'$$,
  'P0001', 'bot_rating_frozen', 'the Demo Tester''s rating row cannot change'
);
select throws_ok(
  $$insert into public.rating_history (match_id, player_id, before, after)
    values ('f1000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-8000-0000000000d1', 1500, 1510)$$,
  'P0001', 'bot_rating_frozen', 'the Demo Tester gets no rating history'
);
select lives_ok(
  $$update public.player_ratings set updated_at = updated_at where user_id = 'f0000000-0000-4000-8000-0000000000b2'$$,
  'human rating rows are not blocked'
);

-- ---------------------------------------------------------------------------
-- Submit / confirm / dispute (as service_role, like the edge function)
-- ---------------------------------------------------------------------------
set local role service_role;

select throws_ok(
  $$select public.match_results_submit('f0000000-0000-4000-8000-0000000000c3', 'f1000000-0000-4000-8000-0000000000ab',
      '[{"player_a_points": 11, "player_b_points": 7}]')$$,
  'P0001', 'match_not_found', 'an outsider cannot report a result'
);
select throws_ok(
  $$select public.match_results_submit('f0000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-0000000000ac',
      '[{"player_a_points": 11, "player_b_points": 7}]')$$,
  'P0001', 'match_not_accepted', 'a proposed match cannot take a result'
);
select throws_ok(
  $$select public.match_results_submit('f0000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-0000000000ab', '[]')$$,
  '22023', 'invalid_result', 'a result has at least one game'
);

select lives_ok(
  $$select public.match_results_submit('f0000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-0000000000ab',
      '[{"player_a_points": 9, "player_b_points": 11}, {"player_a_points": 11, "player_b_points": 4},
        {"player_a_points": 12, "player_b_points": 10}]')$$,
  'a reports a 3-game result'
);
select results_eq(
  $$select status::text, reported_by from public.matches where id = 'f1000000-0000-4000-8000-0000000000ab'$$,
  $$values ('awaiting_confirmation'::text, 'f0000000-0000-4000-8000-0000000000a1'::uuid)$$,
  'the match awaits confirmation, reported by a'
);
select results_eq(
  $$select game_number, player_a_points, player_b_points from public.match_games
     where match_id = 'f1000000-0000-4000-8000-0000000000ab' order by game_number$$,
  $$values (1, 9, 11), (2, 11, 4), (3, 12, 10)$$,
  'games are stored in order, in a/b order'
);
select throws_ok(
  $$select public.match_results_submit('f0000000-0000-4000-8000-0000000000b2', 'f1000000-0000-4000-8000-0000000000ab',
      '[{"player_a_points": 11, "player_b_points": 7}]')$$,
  'P0001', 'match_not_accepted', 'a second report is refused'
);

select is(
  public.ratings_match_inputs('f1000000-0000-4000-8000-0000000000ab') -> 'player_a',
  jsonb_build_object('id', 'f0000000-0000-4000-8000-0000000000a1', 'is_bot', false, 'rating', 1500.00,
    'mmr', 1500.00, 'rating_deviation', 200.00, 'volatility', 0.060000),
  'ratings_match_inputs carries the current rating row'
);
select is(
  jsonb_array_length(public.ratings_match_inputs('f1000000-0000-4000-8000-0000000000ab') -> 'games'),
  3,
  'ratings_match_inputs carries the games'
);

-- Leaving the queue doesn't touch a reported match.
select public.matchmaking_leave('f0000000-0000-4000-8000-0000000000b2');
select is(
  (select status::text from public.matches where id = 'f1000000-0000-4000-8000-0000000000ab'),
  'awaiting_confirmation',
  'matchmaking_leave leaves a reported match alone'
);

select throws_ok(
  $$select public.match_results_dispute('f0000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-0000000000ab')$$,
  'P0001', 'own_report', 'the reporter cannot dispute their own score'
);
select throws_ok(
  $$select public.ratings_apply('f1000000-0000-4000-8000-0000000000ab', 'f0000000-0000-4000-8000-0000000000a1', '[]')$$,
  'P0001', 'own_report', 'the reporter cannot confirm their own score'
);
select throws_ok(
  $$select public.ratings_apply('f1000000-0000-4000-8000-0000000000ab', 'f0000000-0000-4000-8000-0000000000c3', '[]')$$,
  'P0001', 'match_not_found', 'an outsider cannot confirm'
);
select throws_ok(
  $$select public.ratings_apply('f1000000-0000-4000-8000-0000000000ab', 'f0000000-0000-4000-8000-0000000000b2',
      '[{"player_id": "f0000000-0000-4000-8000-0000000000a1", "expected_rating": 1500, "expected_mmr": 1500,
         "expected_rating_deviation": 200, "expected_volatility": 0.06, "before": 1500, "rating": 1563.46,
         "rating_deviation": 175.12, "volatility": 0.059998}]')$$,
  '22023', 'invalid_update', 'updates must cover every non-bot player'
);
select throws_ok(
  $$select public.ratings_apply('f1000000-0000-4000-8000-0000000000ab', 'f0000000-0000-4000-8000-0000000000b2',
      '[{"player_id": "f0000000-0000-4000-8000-0000000000a1", "expected_rating": 1500, "expected_mmr": 1500,
         "expected_rating_deviation": 200, "expected_volatility": 0.06, "before": 1500, "rating": 1563.46,
         "rating_deviation": 175.12, "volatility": 0.059998},
        {"player_id": "f0000000-0000-4000-8000-0000000000b2", "expected_rating": 1399, "expected_mmr": 1400,
         "expected_rating_deviation": 30, "expected_volatility": 0.06, "before": 1399, "rating": 1398.10,
         "rating_deviation": 29.95, "volatility": 0.059999}]')$$,
  'P0001', 'rating_stale', 'a stale expected rating is refused'
);
select results_eq(
  $$select (select status::text from public.matches where id = 'f1000000-0000-4000-8000-0000000000ab'),
           (select rating from public.player_ratings where user_id = 'f0000000-0000-4000-8000-0000000000a1'),
           (select count(*)::int from public.rating_history where match_id = 'f1000000-0000-4000-8000-0000000000ab')$$,
  $$values ('awaiting_confirmation'::text, 1500.00::numeric, 0)$$,
  'a refused apply writes nothing'
);

select is(
  public.ratings_apply('f1000000-0000-4000-8000-0000000000ab', 'f0000000-0000-4000-8000-0000000000b2',
    '[{"player_id": "f0000000-0000-4000-8000-0000000000a1", "expected_rating": 1500, "expected_mmr": 1500,
       "expected_rating_deviation": 200, "expected_volatility": 0.06, "before": 1500, "rating": 1563.46,
       "rating_deviation": 175.12, "volatility": 0.059998},
      {"player_id": "f0000000-0000-4000-8000-0000000000b2", "expected_rating": 1400, "expected_mmr": 1400,
       "expected_rating_deviation": 30, "expected_volatility": 0.06, "before": 1400, "rating": 1398.10,
       "rating_deviation": 29.95, "volatility": 0.059999}]'),
  true,
  'b confirms: the updates are applied'
);
select is(
  (select status::text from public.matches where id = 'f1000000-0000-4000-8000-0000000000ab'),
  'confirmed',
  'the match is confirmed'
);
select results_eq(
  $$select rating, mmr, rating_deviation, volatility from public.player_ratings
     where user_id = 'f0000000-0000-4000-8000-0000000000a1'$$,
  $$values (1563.46::numeric, 1563.46::numeric, 175.12::numeric, 0.059998::numeric)$$,
  'a''s rating row is updated (rating = mmr)'
);
select results_eq(
  $$select player_id, before, after, delta from public.rating_history
     where match_id = 'f1000000-0000-4000-8000-0000000000ab' order by after desc$$,
  $$values ('f0000000-0000-4000-8000-0000000000a1'::uuid, 1500.00::numeric, 1563.46::numeric, 63.46::numeric),
           ('f0000000-0000-4000-8000-0000000000b2'::uuid, 1400.00::numeric, 1398.10::numeric, -1.90::numeric)$$,
  'rating_history has both players with delta = after - before'
);
select is(
  (select array_agg(games_played order by id) from public.users
    where id in ('f0000000-0000-4000-8000-0000000000a1', 'f0000000-0000-4000-8000-0000000000b2')),
  array[1, 1],
  'games_played goes up for both players'
);

select is(
  public.ratings_apply('f1000000-0000-4000-8000-0000000000ab', 'f0000000-0000-4000-8000-0000000000b2', '[]'),
  false,
  'confirming again is a no-op'
);
select results_eq(
  $$select (select count(*)::int from public.rating_history where match_id = 'f1000000-0000-4000-8000-0000000000ab'),
           (select rating from public.player_ratings where user_id = 'f0000000-0000-4000-8000-0000000000a1'),
           (select games_played from public.users where id = 'f0000000-0000-4000-8000-0000000000a1')$$,
  $$values (2, 1563.46::numeric, 1)$$,
  'confirming twice does not double-apply'
);
select throws_ok(
  $$select public.match_results_dispute('f0000000-0000-4000-8000-0000000000b2', 'f1000000-0000-4000-8000-0000000000ab')$$,
  'P0001', 'match_not_awaiting_confirmation', 'a confirmed match cannot be disputed'
);

select is(
  public.match_results_state('f0000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-0000000000ab') -> 'rating_change',
  jsonb_build_object('match_id', 'f1000000-0000-4000-8000-0000000000ab', 'player_id', 'f0000000-0000-4000-8000-0000000000a1',
    'before', 1500.00, 'after', 1563.46, 'delta', 63.46),
  'the state carries the caller''s rating change'
);
select results_eq(
  $$select s -> 'opponent' ->> 'id', jsonb_array_length(s -> 'games'), s -> 'games' -> 0 ->> 'player_b_points',
           s -> 'match' ->> 'reported_by'
      from public.match_results_state('f0000000-0000-4000-8000-0000000000b2', 'f1000000-0000-4000-8000-0000000000ab') s$$,
  $$values ('f0000000-0000-4000-8000-0000000000a1'::text, 3, '11'::text, 'f0000000-0000-4000-8000-0000000000a1'::text)$$,
  'the state carries the opponent, the games in order and the reporter'
);
select throws_ok(
  $$select public.match_results_state('f0000000-0000-4000-8000-0000000000c3', 'f1000000-0000-4000-8000-0000000000ab')$$,
  'P0001', 'match_not_found', 'an outsider cannot read the state'
);

-- Dispute: d reports, a disputes.
select public.match_results_submit('f0000000-0000-4000-8000-0000000000d4', 'f1000000-0000-4000-8000-0000000000ad',
  '[{"player_a_points": 4, "player_b_points": 11}]');
select is(
  public.match_results_state('f0000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-0000000000ad') -> 'rating_change',
  'null'::jsonb,
  'no rating change before confirmation'
);
select lives_ok(
  $$select public.match_results_dispute('f0000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-0000000000ad')$$,
  'a disputes d''s score'
);
select lives_ok(
  $$select public.match_results_dispute('f0000000-0000-4000-8000-0000000000a1', 'f1000000-0000-4000-8000-0000000000ad')$$,
  'disputing again is a no-op'
);
select throws_ok(
  $$select public.ratings_apply('f1000000-0000-4000-8000-0000000000ad', 'f0000000-0000-4000-8000-0000000000a1', '[]')$$,
  'P0001', 'match_not_awaiting_confirmation', 'a disputed match cannot be confirmed'
);
select results_eq(
  $$select (select status::text from public.matches where id = 'f1000000-0000-4000-8000-0000000000ad'),
           (select count(*)::int from public.rating_history where match_id = 'f1000000-0000-4000-8000-0000000000ad'),
           (select count(*)::int from public.player_ratings where user_id = 'f0000000-0000-4000-8000-0000000000d4')$$,
  $$values ('disputed'::text, 0, 0)$$,
  'a dispute changes no rating'
);

-- The Demo Tester: e (unrated) reports a win; the bot confirms after the delay.
select public.match_results_submit('f0000000-0000-4000-8000-0000000000e5', 'f1000000-0000-4000-8000-0000000000e0',
  '[{"player_a_points": 11, "player_b_points": 6}]');
select is(
  public.match_results_bot_confirm_due('f1000000-0000-4000-8000-0000000000e0', interval '3 seconds'),
  false,
  'the bot does not confirm before the delay'
);
reset role;
update public.matches set updated_at = now() - interval '4 seconds' where id = 'f1000000-0000-4000-8000-0000000000e0';
set local role service_role;
select is(
  public.match_results_bot_confirm_due('f1000000-0000-4000-8000-0000000000e0', interval '3 seconds'),
  true,
  'the bot confirms after the delay'
);
select is(
  public.match_results_bot_confirm_due('f1000000-0000-4000-8000-0000000000ad', interval '0 seconds'),
  false,
  'only matches against a bot are auto-confirmed'
);
select throws_ok(
  $$select public.ratings_apply('f1000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-8000-0000000000d1',
      '[{"player_id": "00000000-0000-4000-8000-0000000000d1", "before": 1500, "rating": 1450,
         "rating_deviation": 60, "volatility": 0.06},
        {"player_id": "f0000000-0000-4000-8000-0000000000e5", "before": 1500, "rating": 1650,
         "rating_deviation": 290, "volatility": 0.06}]')$$,
  '22023', 'invalid_update', 'an update for the bot is refused'
);
select is(
  public.ratings_apply('f1000000-0000-4000-8000-0000000000e0', '00000000-0000-4000-8000-0000000000d1',
    '[{"player_id": "f0000000-0000-4000-8000-0000000000e5", "expected_rating": null, "expected_mmr": null,
       "expected_rating_deviation": null, "expected_volatility": null, "before": 1500, "rating": 1662.31,
       "rating_deviation": 290.32, "volatility": 0.059999}]'),
  true,
  'the bot confirms with only the human''s update'
);
select results_eq(
  $$select rating, mmr, rating_deviation from public.player_ratings where user_id = 'f0000000-0000-4000-8000-0000000000e5'$$,
  $$values (1662.31::numeric, 1662.31::numeric, 290.32::numeric)$$,
  'a first match creates the player''s rating row'
);
select is(
  (select count(*)::int from public.rating_history where player_id = '00000000-0000-4000-8000-0000000000d1'),
  0,
  'the bot has no rating history'
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
reset role;
set local role anon;

select throws_ok($$select * from public.match_games$$, '42501', null, 'anon cannot read match_games');
select throws_ok($$select * from public.rating_history$$, '42501', null, 'anon cannot read rating_history');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "user_pgtap_res_a", "role": "authenticated"}';

select is(
  (select count(*)::int from public.match_games),
  4,
  'a player reads the games of their own matches (ab: 3, ad: 1)'
);
select is(
  (select array_agg(player_id) from public.rating_history),
  array['f0000000-0000-4000-8000-0000000000a1'::uuid],
  'a player reads only their own rating history'
);
select throws_ok(
  $$insert into public.match_games values ('f1000000-0000-4000-8000-0000000000ac', 1, 11, 5)$$,
  '42501', null, 'players cannot write match_games'
);
select throws_ok(
  $$update public.rating_history set after = 2000$$,
  '42501', null, 'players cannot write rating_history'
);

set local request.jwt.claims = '{"sub": "user_pgtap_res_c", "role": "authenticated"}';
select is(
  (select count(*)::int from public.match_games) + (select count(*)::int from public.rating_history),
  0,
  'an outsider sees no games and no history'
);

reset role;

select * from finish();
rollback;
