import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DominantHandSchema, LoginMethodSchema, PlayerProfileSchema } from './profile.ts';
import { readEnumFromMigrations } from './test-helpers.ts';

const validRow = {
  id: '6f1c2b8e-3d4a-4c5b-9e7f-0a1b2c3d4e5f',
  clerk_user_id: 'user_2abcDEF',
  username: 'dink_master',
  first_name: 'Ada',
  last_name: null,
  email: 'ada@example.com',
  phone_number: null,
  login_method: 'email',
  date_of_birth: '1990-04-12',
  dominant_hand: 'right',
  avatar_key: 'avatars/user_2abcDEF/1.jpg',
  profile_completed_at: '2026-10-06T12:00:00.123456+00:00',
};

describe('PlayerProfileSchema', () => {
  it('parses a completed profile row', () => {
    assert.deepEqual(PlayerProfileSchema.parse(validRow), validRow);
  });

  it('parses a row before step 1 (player fields null)', () => {
    const row = {
      ...validRow,
      username: null,
      date_of_birth: null,
      dominant_hand: null,
      avatar_key: null,
      profile_completed_at: null,
    };
    assert.equal(PlayerProfileSchema.safeParse(row).success, true);
  });

  it('rejects an unknown dominant_hand', () => {
    assert.equal(PlayerProfileSchema.safeParse({ ...validRow, dominant_hand: 'both' }).success, false);
  });

  it('rejects an unknown login_method', () => {
    assert.equal(PlayerProfileSchema.safeParse({ ...validRow, login_method: 'google' }).success, false);
  });

  it('rejects a missing required column', () => {
    const { login_method: _, ...row } = validRow;
    assert.equal(PlayerProfileSchema.safeParse(row).success, false);
    const { clerk_user_id: __, ...row2 } = validRow;
    assert.equal(PlayerProfileSchema.safeParse(row2).success, false);
  });

  it('rejects a missing nullable column (must be present, even if null)', () => {
    const { dominant_hand: _, ...row } = validRow;
    assert.equal(PlayerProfileSchema.safeParse(row).success, false);
  });

  it('enforces users_username_format', () => {
    for (const username of ['ab', 'Dink', 'dink-master', 'a'.repeat(21)]) {
      assert.equal(PlayerProfileSchema.safeParse({ ...validRow, username }).success, false, username);
    }
  });

  it('enforces users_date_of_birth_range and real dates', () => {
    for (const date_of_birth of ['1899-12-31', '1990-02-30', '12/04/1990']) {
      assert.equal(PlayerProfileSchema.safeParse({ ...validRow, date_of_birth }).success, false, date_of_birth);
    }
  });
});

describe('profile enums match the migrations', () => {
  it('dominant_hand', () => {
    assert.deepEqual(DominantHandSchema.options, readEnumFromMigrations('dominant_hand'));
  });

  it('login_method', () => {
    assert.deepEqual(LoginMethodSchema.options, readEnumFromMigrations('login_method'));
  });
});
