import { z } from 'zod';

import { GeoJsonPointSchema, TimestampSchema, UuidSchema } from './common.ts';

// Shapes for the queue → match → result → rating-change flow. The tables
// behind them don't exist yet; the backend migration that adds them must use
// these names, enums, and nullability. Player ids are `public.users.id`
// (uuid), never `clerk_user_id`.

// ---------------------------------------------------------------------------
// Scoring rules (singles, rally or side-out doesn't matter here)
// ---------------------------------------------------------------------------

/** A game is won by the first player to reach this many points... */
export const POINTS_TO_WIN = 11;
/** ...with at least this lead. Past 11 the game ends as soon as the lead is 2. */
export const WIN_BY = 2;
/** Matches are best of this many games. */
export const MAX_GAMES = 3;
/** Games needed to win a full best-of-`MAX_GAMES` match (2). */
export const GAMES_TO_WIN_MATCH = Math.floor(MAX_GAMES / 2) + 1;

// ---------------------------------------------------------------------------
// Queue
// ---------------------------------------------------------------------------

export const QUEUE_ENTRY_STATUSES = ['waiting', 'matched', 'left'] as const;
export const QueueEntryStatusSchema = z.enum(QUEUE_ENTRY_STATUSES);
export type QueueEntryStatus = z.infer<typeof QueueEntryStatusSchema>;

/**
 * A player looking for a match near `location`. `radius_m` is how far
 * (metres) they're willing to travel. `waiting` until paired (`matched`) or
 * the player gives up (`left`). Like courts, `location` is GeoJSON, so read
 * it through a view or RPC that converts the PostGIS column.
 */
export const QueueEntrySchema = z.object({
  id: UuidSchema,
  player_id: UuidSchema,
  location: GeoJsonPointSchema,
  radius_m: z.number().positive(),
  status: QueueEntryStatusSchema,
  created_at: TimestampSchema,
});
export type QueueEntry = z.infer<typeof QueueEntrySchema>;

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------

/**
 * Lifecycle, in order:
 * - `proposed`: the matchmaker paired two players; waiting for both to accept.
 * - `accepted` / `declined`: the pairing was taken or turned down (terminal
 *   if declined).
 * - `awaiting_result`: being played; nobody has reported a score yet.
 * - `awaiting_confirmation`: one player reported; the other must confirm.
 * - `confirmed`: both agree; ratings are updated from this result.
 * - `disputed`: the opponent rejected the reported score.
 */
export const MATCH_STATUSES = [
  'proposed',
  'accepted',
  'declined',
  'awaiting_result',
  'awaiting_confirmation',
  'confirmed',
  'disputed',
] as const;
export const MatchStatusSchema = z.enum(MATCH_STATUSES);
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

/**
 * A singles match between `player_a_id` and `player_b_id` (always two
 * different players). Scores in `MatchGame` are ordered the same way: a, then
 * b. `court_id` is null until a court is picked.
 */
export const MatchSchema = z
  .object({
    id: UuidSchema,
    player_a_id: UuidSchema,
    player_b_id: UuidSchema,
    court_id: UuidSchema.nullable(),
    status: MatchStatusSchema,
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  })
  .refine((m) => m.player_a_id !== m.player_b_id, {
    message: 'A match needs two different players.',
    path: ['player_b_id'],
  });
export type Match = z.infer<typeof MatchSchema>;

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

const PointsSchema = z.number().int().nonnegative();

/**
 * One game's final score, from `player_a`'s and `player_b`'s side of the
 * match. Valid when exactly one player won: they reached `POINTS_TO_WIN`
 * with a lead of at least `WIN_BY`, and if the game went past
 * `POINTS_TO_WIN` it stopped the moment the lead hit `WIN_BY` (12–10 and
 * 15–13 are valid; 11–10, 10–8, and 15–11 are not).
 */
export const MatchGameSchema = z
  .object({
    player_a_points: PointsSchema,
    player_b_points: PointsSchema,
  })
  .superRefine(({ player_a_points: a, player_b_points: b }, ctx) => {
    const winner = Math.max(a, b);
    const loser = Math.min(a, b);
    let message: string | undefined;
    if (a === b) {
      message = `A game can't end tied (${a}–${b}); one player has to win it.`;
    } else if (winner < POINTS_TO_WIN) {
      message = `Games go to ${POINTS_TO_WIN}; ${winner}–${loser} isn't finished.`;
    } else if (winner - loser < WIN_BY) {
      message = `Games are won by ${WIN_BY}; ${winner}–${loser} isn't finished.`;
    } else if (winner > POINTS_TO_WIN && winner - loser !== WIN_BY) {
      message = `${winner}–${loser} isn't possible: past ${POINTS_TO_WIN}, the game ends as soon as someone leads by ${WIN_BY}.`;
    }
    if (message) ctx.addIssue({ code: 'custom', message });
  });
export type MatchGame = z.infer<typeof MatchGameSchema>;

/**
 * The score one player reports for a match, games in the order played.
 * 1 to `MAX_GAMES` games. The match winner must win more games than the
 * opponent, and no game may follow the one that decided it (after 2–0 there's
 * no 3rd game).
 */
export const MatchResultSubmissionSchema = z
  .object({
    match_id: UuidSchema,
    games: z
      .array(MatchGameSchema)
      .min(1, 'Enter the score of at least one game.')
      .max(MAX_GAMES, `A match is best of ${MAX_GAMES}; enter at most ${MAX_GAMES} games.`),
  })
  .superRefine(({ games }, ctx) => {
    let aWins = 0;
    let bWins = 0;
    for (const [i, game] of games.entries()) {
      if (aWins >= GAMES_TO_WIN_MATCH || bWins >= GAMES_TO_WIN_MATCH) {
        ctx.addIssue({
          code: 'custom',
          message: `The match was already won ${Math.max(aWins, bWins)}–${Math.min(aWins, bWins)}; game ${i + 1} shouldn't have been played.`,
          path: ['games', i],
        });
        return;
      }
      if (game.player_a_points > game.player_b_points) aWins++;
      else bWins++;
    }
    if (aWins === bWins) {
      ctx.addIssue({
        code: 'custom',
        message: `Games are split ${aWins}–${bWins}; the match winner has to win more games.`,
        path: ['games'],
      });
    }
  });
export type MatchResultSubmission = z.infer<typeof MatchResultSubmissionSchema>;

/** Which side of a match: `player_a_id` or `player_b_id`. */
export type MatchSide = 'a' | 'b';

/**
 * The winner of a result that already passed `MatchResultSubmissionSchema`:
 * the side that won more games. Throws if the games are split, which a parsed
 * submission never is, so call it only on parsed data.
 */
export function matchWinner({ games }: Pick<MatchResultSubmission, 'games'>): MatchSide {
  const aWins = games.filter((g) => g.player_a_points > g.player_b_points).length;
  const bWins = games.length - aWins;
  if (aWins === bWins) {
    throw new Error(`matchWinner: games are split ${aWins}–${bWins}; parse with MatchResultSubmissionSchema first.`);
  }
  return aWins > bWins ? 'a' : 'b';
}

// ---------------------------------------------------------------------------
// Rating change
// ---------------------------------------------------------------------------

/**
 * How a confirmed match moved one player's visible rating
 * (`player_ratings.rating`), for the result screen. Computed only by the
 * `ratings` edge function (agent/skills/ratings-engine); clients just display
 * it. `match_id` is the confirmed match that caused it; `delta` is
 * `after - before`.
 */
export const RatingChangeSchema = z
  .object({
    match_id: UuidSchema,
    player_id: UuidSchema,
    before: z.number(),
    after: z.number(),
    delta: z.number(),
  })
  .refine((c) => Math.abs(c.after - c.before - c.delta) < 1e-6, {
    message: 'delta must equal after - before.',
    path: ['delta'],
  });
export type RatingChange = z.infer<typeof RatingChangeSchema>;
