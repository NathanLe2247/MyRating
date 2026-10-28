import { MatchFormats, type MatchFormat } from '@/constants/match';
import type { MatchFound, MatchFoundPlayer } from '@/types/match-found';

// The Match Found route takes the match as a JSON string in its `match` param
// (route params are strings). Anything missing or malformed reads as "no
// match", so the screen shows its empty state instead of half a match.

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isPlayer = (value: unknown): value is MatchFoundPlayer =>
  isObject(value) &&
  typeof value.name === 'string' &&
  value.name.length > 0 &&
  (value.rating === null || isNumber(value.rating));

const isFormat = (value: unknown): value is MatchFormat =>
  MatchFormats.includes(value as MatchFormat);

export function serializeMatchFound(match: MatchFound): string {
  return JSON.stringify(match);
}

export function parseMatchFound(raw: string | string[] | undefined): MatchFound | null {
  if (typeof raw !== 'string') return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !isObject(value) ||
    typeof value.id !== 'string' ||
    !isFormat(value.format) ||
    typeof value.official !== 'boolean' ||
    !isPlayer(value.player) ||
    !isPlayer(value.opponent) ||
    !isNumber(value.searchRadiusMiles) ||
    !isNumber(value.elapsedSeconds)
  ) {
    return null;
  }
  return value as MatchFound;
}
