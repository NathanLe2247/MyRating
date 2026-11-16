---
name: ratings-engine
description: Glicko-2 rating conventions for myRating — rating/RD/volatility updates, match result encoding, and where rating math is allowed to live.
---

# ratings-engine

Conventions for computing and updating player skill ratings with Glicko-2.

Scope: the math and update rules only — shared by `backend/supabase/functions/ratings/`
(the only writer) and any read-side display logic in `frontend/` or `mobile/`
that needs to explain a rating (e.g. "provisional", "RD too high to rank").

## Where the code lives

- `backend/supabase/functions/ratings/glicko2.ts` — the only Glicko-2
  implementation (Glickman, "Example of the Glicko-2 system"). Pure, no
  rounding. Tested against the paper's worked example (1500/200 vs 1400/30 W,
  1550/100 L, 1700/300 L → 1464.06, RD 151.52, σ 0.05999) in `ratings.test.ts`.
- `ratings/update.ts` — turns a confirmed match into updates (encoding,
  defaults, bots, rounding below).
- `ratings/confirm.ts` — `confirmMatch`, the one code path that writes
  ratings. It reads `public.ratings_match_inputs`, computes, and calls
  `public.ratings_apply`, which writes `player_ratings`, `rating_history` and
  `users.games_played` and marks the match `confirmed` in one transaction.
- `ratings/` is a module folder (no `index.ts`, so it isn't deployed). The
  `match-results` edge function imports it for player confirmations and the
  Demo Tester's auto-confirm. Never re-implement any of this in another
  function, SQL, or a client: clients display `RatingChange` values, they
  don't compute them.

## Defaults for new players

A player without a `player_ratings` row (calibration players start unrated)
is rated from the column defaults: rating **1500**, RD **350**, volatility
**0.06**. Their first confirmed match creates the row. Their "before" in
`rating_history` is 1500. RD is capped at 350 after every update.

System constant τ = **0.5**; volatility convergence ε = 0.000001.

## Rating period

**One confirmed match = one rating period** with a single game. The update
runs when the match is confirmed (by the other player, or the Demo Tester).
Both players are computed from their pre-match state, so the order doesn't
matter. There is no idle-time RD growth yet (Glicko-2's "no games this
period" step); add it with a scheduled job if inactivity should raise RD.

**Batch jobs over `player_ratings` (RD decay, recalibration, backfills)
must exclude bots** (`join users ... where not users.is_bot`): the
`refuse_bot_rating_change` trigger rejects any write to a bot's row, so one
bot row in the batch fails the whole statement. Such a job is still a
ratings write: put it next to `ratings/`, keep `rating = mmr`, and leave
`rating_history` to confirmed matches.

## Encoding a match result

Matches are best of 3 games, and 1, 2 or 3 games are all valid results
(`MatchResultSubmissionSchema` in `shared/src/match.ts`). The stored games
are parsed with that schema and the winner comes from shared `matchWinner`;
never count games yourself. The winner scores **1** and the loser **0**
against the opponent's rating and RD. Game count and point margins don't
change the update: a 1-game 11–0 counts the same as a 3-game win. A single
game is simply a result whose winner won that game.

## Which columns

`player_ratings` (numeric columns): `mmr numeric(7,2)` holds the Glicko-2
rating and is what the update reads; `rating numeric(7,2)` is the visible
rating. **For now `mmr = rating`**: both are set to the same new value on
every update, so matchmaking (which searches by `mmr`) sees exactly the
visible rating. If they are ever split (e.g. a visible rating that lags or
is floored), only `ratings_apply` changes; the Glicko-2 update keeps reading
`mmr`. `rating_deviation numeric(6,2)`, `volatility numeric(8,6)`.
Clients can read `rating` and `rating_deviation`, never `mmr` or
`volatility`.

## Rounding and delta

Values are rounded to the column scales in TypeScript before writing
(rating 2 places, RD 2 places, volatility 6 places), so the database stores
exactly what was computed. `rating_history.delta` is a generated column,
`after - before`, `numeric(7,2)`: the rounded after minus the rounded before.
`RatingChangeSchema` accepts `delta` within `RATING_DELTA_TOLERANCE` (0.005)
of `after - before`.

## Idempotency and concurrency

- Confirming a `confirmed` match is a no-op (`ratings_apply` returns false;
  `rating_history`'s primary key `(match_id, player_id)` is the backstop).
- `ratings_apply` refuses with `rating_stale` if a player's row changed
  since it was read; `confirmMatch` re-reads and recomputes (up to 3 tries),
  and `match-results` answers 409 `rating_stale` if it still moves.
- `ratings_apply` doesn't trust the caller's `before`: it must equal the
  stored `rating` (1500 with no row) or the call fails with
  `invalid_update`, and the stored value is what `rating_history` records.
- `ratings_apply` locks and writes player rows in `player_id` order, so two
  confirmations sharing players can't deadlock. Any other code that locks
  several `player_ratings` rows must use the same order.
- An empty update list for a match awaiting confirmation is
  `match_changed`: the confirmer read the match before the score was
  reported (a confirm racing a submit). It is a 409, not a retry, so a
  player never confirms a score they haven't seen.
- Disputed matches never change ratings.

## Bots

The Demo Tester (`users.is_bot`) never gets a rating change: the update
skips `is_bot` players, `ratings_apply` refuses an update for one, and the
`refuse_bot_rating_change` triggers block any insert or update of a bot's
`player_ratings` row or `rating_history`. A human's match against the bot
**does** update the human, rated against the bot's current rating and RD.
Bots must never appear on leaderboards: filter `users.is_bot` out of any
player list.
