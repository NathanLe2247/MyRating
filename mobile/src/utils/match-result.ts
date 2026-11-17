import {
  type Match,
  type MatchGame,
  type MatchGameRow,
  MatchResultSubmissionSchema,
  matchWinner,
  type MatchResultsState,
  MAX_GAMES,
} from '@myrating/shared';

import { MatchResultsPollMs, MaxStepperPoints } from '@/constants/match-results';
import { en } from '@/i18n/en';
import type { MatchResultsErrorCode, PlayerGame, ReportResultStage, ScoreDraft } from '@/types/match-results';

// Pure helpers over the `match-results` function's state
// (shared/src/match-results.ts): the player's side of the score, the score
// being entered and why it can't be submitted yet, which stage the report
// card is in, and when to poll. Scoring rules come from the shared schemas;
// rating changes come from the backend and are only displayed.

/** Whether the player is `player_a` of the match (the state names the opponent). */
export function playerIsA(match: Pick<Match, 'player_a_id'>, opponentId: string): boolean {
  return match.player_a_id !== opponentId;
}

/** Stored games (a/b order) from the player's side. */
export function toPlayerGames(games: readonly MatchGameRow[], isA: boolean): PlayerGame[] {
  return [...games]
    .sort((x, y) => x.game_number - y.game_number)
    .map((g) =>
      isA
        ? { you: g.player_a_points, opponent: g.player_b_points }
        : { you: g.player_b_points, opponent: g.player_a_points },
    );
}

/** The player's games in the match's a/b order, for a `submit`. */
export function toMatchGames(games: readonly PlayerGame[], isA: boolean): MatchGame[] {
  return games.map(({ you, opponent }) =>
    isA ? { player_a_points: you, player_b_points: opponent } : { player_a_points: opponent, player_b_points: you },
  );
}

export const emptyDraft = (): ScoreDraft => ({ games: [{ you: 0, opponent: 0 }], active: 0 });

/** Moves one side of the selected game by `delta` points, within 0…`MaxStepperPoints`. */
export function stepPoints(draft: ScoreDraft, side: keyof PlayerGame, delta: number): ScoreDraft {
  const games = draft.games.map((g, i) =>
    i === draft.active ? { ...g, [side]: Math.min(MaxStepperPoints, Math.max(0, g[side] + delta)) } : g,
  );
  return { ...draft, games };
}

/** Adds a game (up to `MAX_GAMES`) and selects it. */
export function addGame(draft: ScoreDraft): ScoreDraft {
  if (draft.games.length >= MAX_GAMES) return draft;
  const games = [...draft.games, { you: 0, opponent: 0 }];
  return { games, active: games.length - 1 };
}

/** Removes the last game (never the first) and selects the one before it. */
export function removeLastGame(draft: ScoreDraft): ScoreDraft {
  if (draft.games.length <= 1) return draft;
  const games = draft.games.slice(0, -1);
  return { games, active: Math.min(draft.active, games.length - 1) };
}

export function selectGame(draft: ScoreDraft, index: number): ScoreDraft {
  return index >= 0 && index < draft.games.length ? { ...draft, active: index } : draft;
}

/**
 * Why the entered score can't be submitted, or undefined when it's a valid
 * result. The rules (and their messages) are `MatchResultSubmissionSchema`'s;
 * a game-level message is prefixed with its game number once there are
 * several games. A blank form gets a prompt instead of an error.
 */
export function draftProblem(matchId: string, games: readonly PlayerGame[]): string | undefined {
  if (games.every((g) => g.you === 0 && g.opponent === 0)) return en.reportResult.problems.blank;
  // Which side is which doesn't change validity; the messages are symmetric.
  const parsed = MatchResultSubmissionSchema.safeParse({ match_id: matchId, games: toMatchGames(games, true) });
  if (parsed.success) return undefined;
  const [issue] = parsed.error.issues;
  const gameIndex = issue.path[0] === 'games' && typeof issue.path[1] === 'number' ? issue.path[1] : undefined;
  return gameIndex !== undefined && games.length > 1
    ? en.reportResult.problems.inGame(gameIndex + 1, issue.message)
    : issue.message;
}

/** Whether the player won the stored (already validated) games, by the shared rule. */
const playerWon = (games: MatchResultsState['games'], isA: boolean) =>
  matchWinner({ games }) === (isA ? 'a' : 'b');

/**
 * The report card's stage for a match's result state, or null when there's
 * nothing to report (the match isn't on, or it was declined or cancelled).
 */
export function resultStage(state: MatchResultsState): ReportResultStage | null {
  const { match, opponent } = state;
  const isA = playerIsA(match, opponent.id);
  const games = toPlayerGames(state.games, isA);
  switch (match.status) {
    case 'accepted':
      return { kind: 'enter' };
    case 'awaiting_confirmation':
      return match.reported_by === opponent.id ? { kind: 'answer', games } : { kind: 'waiting', games };
    case 'confirmed':
      return { kind: 'confirmed', games, won: playerWon(state.games, isA), ratingChange: state.rating_change };
    case 'disputed':
      return { kind: 'disputed', games };
    default:
      return null;
  }
}

/**
 * How often to re-read the result, or false to stay idle: only while the
 * player waits on the opponent's confirmation (which is also what lets the
 * Demo Tester confirm). The opponent's report reaches an `accepted` match
 * through the matchmaking poll.
 */
export function resultPollMs(state: MatchResultsState | undefined): number | false {
  return state && resultStage(state)?.kind === 'waiting' ? MatchResultsPollMs : false;
}

/** "11–7, 11–9" from the player's side. */
export function formatGames(games: readonly PlayerGame[]): string {
  return games.map((g) => en.reportResult.gameScore(g.you, g.opponent)).join(en.reportResult.gamesJoin);
}

/** User-facing copy for a failed match-results call. */
export function matchResultsErrorMessage(code: MatchResultsErrorCode): string {
  return en.reportResult.errors[code];
}
