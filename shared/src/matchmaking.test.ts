import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DEMO_TESTER_USER_ID,
  MATCHMAKING_ACTIONS,
  MAX_QUEUE_RADIUS_M,
  MatchmakingRequestSchema,
  MatchmakingStateSchema,
  UuidSchema,
} from './index.ts';

const MATCH_ID = '8b3e4d0a-5f6c-4e7d-9a91-2c3d4e5f6071';
const PLAYER = '6f1c2b8e-3d4a-4c5b-9e7f-0a1b2c3d4e5f';
const TS = '2026-11-14T10:00:00.123456+00:00';

describe('DEMO_TESTER_USER_ID', () => {
  it('is a uuid z.uuid() accepts', () => {
    assert.equal(UuidSchema.safeParse(DEMO_TESTER_USER_ID).success, true);
  });

  it('is the id the migrations insert into public.users', () => {
    const dir = fileURLToPath(new URL('../../backend/supabase/migrations/', import.meta.url));
    const sql = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(dir + f, 'utf8'))
      .join('\n');
    assert.match(sql, new RegExp(`insert into public\\.users[^;]*'${DEMO_TESTER_USER_ID}'`));
  });
});

describe('MatchmakingRequestSchema', () => {
  it('parses every action', () => {
    const requests = [
      { action: 'join', lat: 39.1022, lng: -76.9441, radius_m: 5000 },
      { action: 'leave' },
      { action: 'poll' },
      { action: 'accept', match_id: MATCH_ID },
      { action: 'decline', match_id: MATCH_ID },
    ];
    assert.deepEqual(
      requests.map((r) => MatchmakingRequestSchema.parse(r).action),
      [...MATCHMAKING_ACTIONS],
    );
  });

  it('rejects a bad join', () => {
    const join = { action: 'join', lat: 39.1022, lng: -76.9441, radius_m: 5000 };
    assert.equal(MatchmakingRequestSchema.safeParse({ ...join, lat: 91 }).success, false);
    assert.equal(MatchmakingRequestSchema.safeParse({ ...join, lng: -181 }).success, false);
    assert.equal(MatchmakingRequestSchema.safeParse({ ...join, radius_m: 0 }).success, false);
    assert.equal(MatchmakingRequestSchema.safeParse({ ...join, radius_m: MAX_QUEUE_RADIUS_M + 1 }).success, false);
    assert.equal(MatchmakingRequestSchema.safeParse({ action: 'join' }).success, false);
  });

  it('rejects an unknown action and a bad match id', () => {
    assert.equal(MatchmakingRequestSchema.safeParse({ action: 'tick' }).success, false);
    assert.equal(MatchmakingRequestSchema.safeParse({ action: 'accept', match_id: 'm1' }).success, false);
  });
});

describe('MatchmakingStateSchema', () => {
  it('parses an empty state', () => {
    const empty = { queue_entry: null, match: null, opponent: null, court: null };
    assert.deepEqual(MatchmakingStateSchema.parse(empty), empty);
  });

  it('parses a proposed match against the Demo Tester', () => {
    const state = {
      queue_entry: null,
      match: {
        id: MATCH_ID,
        player_a_id: PLAYER,
        player_b_id: DEMO_TESTER_USER_ID,
        court_id: null,
        status: 'proposed',
        player_a_accepted_at: null,
        player_b_accepted_at: TS,
        reported_by: null,
        created_at: TS,
        updated_at: TS,
      },
      opponent: { id: DEMO_TESTER_USER_ID, username: null, first_name: 'Demo', rating: 1500, is_bot: true },
      court: null,
    };
    assert.deepEqual(MatchmakingStateSchema.parse(state), state);
  });
});
