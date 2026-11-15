import { z } from 'zod';

import { GeoJsonPointSchema, TimestampSchema, UuidSchema } from './common.ts';

// Shapes for the queue → match → result → rating-change flow. The queue and
// match tables are in backend/supabase/migrations/20261114130000_queue_and_matches.sql
// and must keep these names, enums, and nullability. Player ids are `public.users.id`
// (uuid), never `clerk_user_id`.

// ---------------------------------------------------------------------------
// Scoring rules
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

/** Largest search radius, in metres. Same limit as `public.nearby_courts`. */
export const MAX_QUEUE_RADIUS_M = 100_000;

/** Mirrors public.queue_entry_status (same values, same order). */
export const QUEUE_ENTRY_STATUSES = ['waiting', 'matched', 'left'] as const;
export const QueueEntryStatusSchema = z.enum(QUEUE_ENTRY_STATUSES);
export type QueueEntryStatus = z.infer<typeof QueueEntryStatusSchema>;

/**
 * A player looking for a match near `location`. `radius_m` is how far
 * (whole metres, 1 to `MAX_QUEUE_RADIUS_M`) they're willing to travel.
 * `waiting` until paired (`matched`) or the player gives up (`left`). Like
 * courts, `location` is GeoJSON, so read it through a view or RPC that
 * converts the PostGIS column. `id` is the row's own key, separate from
 * `player_id`.
 */
export const QueueEntrySchema = z.object({
  id: UuidSchema,
  player_id: UuidSchema,
  location: GeoJsonPointSchema,
  radius_m: z.number().int().positive().max(MAX_QUEUE_RADIUS_M),
  status: QueueEntryStatusSchema,
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
});
export type QueueEntry = z.infer<typeof QueueEntrySchema>;

// ---------------------------------------------------------------------------
// Match
// ---------------------------------------------------------------------------

/**
 * Mirrors public.match_status (same values, same order).
 *
 * Lifecycle:
 * - `proposed` → `accepted` once both players accepted (both
 *   `player_*_accepted_at` set), → `declined` if either turns it down, or →
 *   `cancelled` if it expires or a player leaves.
 * - `accepted` is also the "report the result" state: the match is on and
 *   nobody has reported a score yet. A player who leaves the queue before
 *   anyone reports moves it to `cancelled`.
 * - `accepted` → `awaiting_confirmation` when one player reports
 *   (`reported_by` set); the other player must confirm.
 * - `awaiting_confirmation` → `confirmed` (ratings update) or `disputed`.
 * `declined`, `cancelled`, `confirmed`, and `disputed` are terminal here.
 *
 * A player has at most one open match (`OPEN_MATCH_STATUSES`) at a time:
 * the matchmaking function refuses to queue them while one exists.
 */
export const MATCH_STATUSES = [
  'proposed',
  'accepted',
  'awaiting_confirmation',
  'confirmed',
  'disputed',
  'declined',
  'cancelled',
] as const;
export const MatchStatusSchema = z.enum(MATCH_STATUSES);
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

/** Statuses of a match that is still in progress (not terminal). */
export const OPEN_MATCH_STATUSES = ['proposed', 'accepted', 'awaiting_confirmation'] as const satisfies readonly MatchStatus[];

/**
 * A singles match between `player_a_id` and `player_b_id` (always two
 * different players). Game scores are ordered the same way: a, then b.
 * `court_id` is null until a court is picked. `player_*_accepted_at` is when
 * that player accepted the proposal (null until they do). `reported_by` is
 * the player who reported the result (null until someone does) and must be
 * one of the two players.
 */
export const MatchSchema = z
  .object({
    id: UuidSchema,
    player_a_id: UuidSchema,
    player_b_id: UuidSchema,
    court_id: UuidSchema.nullable(),
    status: MatchStatusSchema,
    player_a_accepted_at: TimestampSchema.nullable(),
    player_b_accepted_at: TimestampSchema.nullable(),
    reported_by: UuidSchema.nullable(),
    created_at: TimestampSchema,
    updated_at: TimestampSchema,
  })
  .superRefine((m, ctx) => {
    if (m.player_a_id === m.player_b_id) {
      ctx.addIssue({ code: 'custom', message: 'A match needs two different players.', path: ['player_b_id'] });
    }
    if (m.reported_by !== null && m.reported_by !== m.player_a_id && m.reported_by !== m.player_b_id) {
      ctx.addIssue({
        code: 'custom',
        message: 'Only a player in the match can report its result.',
        path: ['reported_by'],
      });
    }
  });
export type Match = z.infer<typeof MatchSchema>;

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

const PointsSchema = z.number().int().nonnegative();

const gameScoreShape = {
  player_a_points: PointsSchema,
  player_b_points: PointsSchema,
};

/** Why a final score breaks the scoring rules, or undefined if it's valid. */
function gameScoreProblem(a: number, b: number): string | undefined {
  const winner = Math.max(a, b);
  const loser = Math.min(a, b);
  if (a === b) return `A game can't end tied (${a}–${b}); one player has to win it.`;
  if (winner < POINTS_TO_WIN) return `Games go to ${POINTS_TO_WIN}; ${winner}–${loser} isn't finished.`;
  if (winner - loser < WIN_BY) return `Games are won by ${WIN_BY}; ${winner}–${loser} isn't finished.`;
  if (winner > POINTS_TO_WIN && winner - loser !== WIN_BY) {
    return `${winner}–${loser} isn't possible: past ${POINTS_TO_WIN}, the game ends as soon as someone leads by ${WIN_BY}.`;
  }
  return undefined;
}

function checkGameScore(
  { player_a_points, player_b_points }: { player_a_points: number; player_b_points: number },
  ctx: z.RefinementCtx,
): void {
  const message = gameScoreProblem(player_a_points, player_b_points);
  if (message) ctx.addIssue({ code: 'custom', message });
}

/**
 * One game's final score, from `player_a`'s and `player_b`'s side of the
 * match. Valid when exactly one player won: they reached `POINTS_TO_WIN`
 * with a lead of at least `WIN_BY`, and if the game went past
 * `POINTS_TO_WIN` it stopped the moment the lead hit `WIN_BY` (11–9, 12–10,
 * 13–11, 15–13 are valid; 11–10, 10–8, 12–9, 15–11 are not).
 */
export const MatchGameSchema = z.object(gameScoreShape).superRefine(checkGameScore);
export type MatchGame = z.infer<typeof MatchGameSchema>;

/**
 * A stored game (the match games table): a `MatchGame` plus its match and
 * its 1-based position in the match (`game_number`, 1 to `MAX_GAMES`).
 */
export const MatchGameRowSchema = z
  .object({
    match_id: UuidSchema,
    game_number: z.number().int().min(1).max(MAX_GAMES),
    ...gameScoreShape,
  })
  .superRefine(checkGameScore);
export type MatchGameRow = z.infer<typeof MatchGameRowSchema>;

/**
 * The score one player reports for a match, games in the order played.
 * 1 to `MAX_GAMES` games; a single game is a valid result. The match winner
 * must win more games than the opponent, and no game may follow the one that
 * decided it (after 2–0 there's no 3rd game). Each input problem produces one
 * issue: if a game's score is invalid, only that game is reported.
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
    // Game-level issues are already reported; match-level checks on top of
    // them would only be misleading (e.g. a tied game counted as a loss).
    if (games.some((g) => !MatchGameSchema.safeParse(g).success)) return;

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
 * How far `delta` may be from `after - before`. Ratings are stored as
 * `numeric(7,2)`, so compute `delta` from the rounded `before`/`after`.
 */
export const RATING_DELTA_TOLERANCE = 0.005;

const ratingChangeShape = {
  match_id: UuidSchema,
  player_id: UuidSchema,
  before: z.number(),
  after: z.number(),
  delta: z.number(),
};

function checkDelta(c: { before: number; after: number; delta: number }, ctx: z.RefinementCtx): void {
  // The small epsilon absorbs float error in after - before (e.g. 1523.45 - 1500).
  if (Math.abs(c.after - c.before - c.delta) > RATING_DELTA_TOLERANCE + 1e-9) {
    ctx.addIssue({ code: 'custom', message: 'delta must equal after - before.', path: ['delta'] });
  }
}

/**
 * How a confirmed match moved one player's visible rating
 * (`player_ratings.rating`), for the result screen. Computed only by the
 * backend `ratings` code, run by the `match-results` edge function
 * (agent/skills/ratings-engine); clients just display it (`rating_change` in
 * `MatchResultsState`). `match_id` is the confirmed match that caused it; `delta` is
 * `after - before`.
 */
export const RatingChangeSchema = z.object(ratingChangeShape).superRefine(checkDelta);
export type RatingChange = z.infer<typeof RatingChangeSchema>;

/**
 * A stored rating change (the rating history table): a `RatingChange` plus
 * when it was written. One row per player per confirmed match.
 */
export const RatingHistoryRowSchema = z
  .object({ ...ratingChangeShape, created_at: TimestampSchema })
  .superRefine(checkDelta);
export type RatingHistoryRow = z.infer<typeof RatingHistoryRowSchema>;
