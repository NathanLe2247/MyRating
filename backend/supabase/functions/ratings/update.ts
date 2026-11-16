// How a confirmed match becomes Glicko-2 updates (agent/skills/ratings-engine):
// one match = one rating period with one game, scored 1/0 for the match
// winner from shared's matchWinner, no matter how many games were played or
// by how much. Bots (users.is_bot) are skipped: their row never changes, but
// a human still rates against the bot's current rating and RD.
import { matchWinner, MatchResultSubmissionSchema, type MatchSide, UuidSchema } from '@myrating/shared';
import { z } from 'zod';

import { glicko2Update } from './glicko2.ts';

/** A player with no player_ratings row yet starts here (the column defaults). */
export const DEFAULT_RATING = 1500;
export const DEFAULT_DEVIATION = 350;
export const DEFAULT_VOLATILITY = 0.06;
/** RD never grows past the new-player value. */
export const MAX_DEVIATION = DEFAULT_DEVIATION;

/** Column scales: rating/mmr numeric(7,2), rating_deviation numeric(6,2), volatility numeric(8,6). */
const round = (x: number, places: number) => Math.round(x * 10 ** places) / 10 ** places;

const nullableNumber = z.number().nullable();

/** One player's current state, from public.ratings_match_inputs. Nulls: no player_ratings row. */
export const RatingPlayerInputSchema = z.object({
  id: UuidSchema,
  is_bot: z.boolean(),
  rating: nullableNumber,
  mmr: nullableNumber,
  rating_deviation: nullableNumber,
  volatility: nullableNumber,
});
export type RatingPlayerInput = z.infer<typeof RatingPlayerInputSchema>;

/** What public.ratings_match_inputs returns for a match. */
export const RatingMatchInputsSchema = z.object({
  match_id: UuidSchema,
  status: z.string(),
  games: z.array(z.object({ player_a_points: z.number(), player_b_points: z.number() })),
  player_a: RatingPlayerInputSchema,
  player_b: RatingPlayerInputSchema,
});
export type RatingMatchInputs = z.infer<typeof RatingMatchInputsSchema>;

/**
 * One row for public.ratings_apply. `expected_*` is the state the update was
 * computed from (all null when the player had no row); the SQL refuses with
 * `rating_stale` if the row changed since. `before` is the visible rating
 * shown as "before" (DEFAULT_RATING for a first match); the SQL refuses with
 * `invalid_update` unless it equals the stored rating (or 1500 with no row)
 * and records its own value, not this one. The new values are
 * already rounded to the column scales, so `after - before` is the stored delta.
 */
export type RatingUpdate = {
  player_id: string;
  expected_rating: number | null;
  expected_mmr: number | null;
  expected_rating_deviation: number | null;
  expected_volatility: number | null;
  before: number;
  rating: number;
  rating_deviation: number;
  volatility: number;
};

/** The Glicko-2 state a player is rated from: mmr (the hidden Glicko-2 rating), RD, σ. */
function glickoState(p: RatingPlayerInput) {
  return {
    rating: p.mmr ?? DEFAULT_RATING,
    deviation: p.rating_deviation ?? DEFAULT_DEVIATION,
    volatility: p.volatility ?? DEFAULT_VOLATILITY,
  };
}

/**
 * The updates for a match's reported games: one per non-bot player, both
 * computed from the pre-match states. Throws (via the shared schema) if the
 * stored games aren't a valid result.
 */
export function computeMatchUpdates(inputs: RatingMatchInputs): RatingUpdate[] {
  const result = MatchResultSubmissionSchema.parse({ match_id: inputs.match_id, games: inputs.games });
  const winner = matchWinner(result);
  const sides: [MatchSide, RatingPlayerInput, RatingPlayerInput][] = [
    ['a', inputs.player_a, inputs.player_b],
    ['b', inputs.player_b, inputs.player_a],
  ];

  return sides
    .filter(([, player]) => !player.is_bot)
    .map(([side, player, opponent]) => {
      const opp = glickoState(opponent);
      const next = glicko2Update(glickoState(player), [
        { opponentRating: opp.rating, opponentDeviation: opp.deviation, score: side === winner ? 1 : 0 },
      ]);
      return {
        player_id: player.id,
        expected_rating: player.rating,
        expected_mmr: player.mmr,
        expected_rating_deviation: player.rating_deviation,
        expected_volatility: player.volatility,
        before: round(player.rating ?? DEFAULT_RATING, 2),
        rating: round(next.rating, 2),
        rating_deviation: round(Math.min(next.deviation, MAX_DEVIATION), 2),
        volatility: round(next.volatility, 6),
      };
    });
}
