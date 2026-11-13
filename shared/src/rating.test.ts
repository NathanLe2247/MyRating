import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PlayerRatingSchema,
  PlayerRatingSummarySchema,
  RatingSourceSchema,
  SupportedRatingSourceSchema,
} from './rating.ts';
import { readEnumFromMigrations } from './test-helpers.ts';

describe('RatingSourceSchema', () => {
  it('matches public.rating_source in the migrations', () => {
    assert.deepEqual(RatingSourceSchema.options, readEnumFromMigrations('rating_source'));
  });

  it('parses every enum value', () => {
    for (const source of ['calibration', 'dupr', 'usa_pickleball']) {
      assert.equal(RatingSourceSchema.parse(source), source);
    }
  });

  it('rejects an unknown source', () => {
    assert.equal(RatingSourceSchema.safeParse('utr').success, false);
    assert.equal(RatingSourceSchema.safeParse(undefined).success, false);
  });

  it('supported sources are a subset and only allow calibration today', () => {
    for (const source of SupportedRatingSourceSchema.options) {
      assert.equal(RatingSourceSchema.safeParse(source).success, true);
    }
    assert.equal(SupportedRatingSourceSchema.safeParse('calibration').success, true);
    assert.equal(SupportedRatingSourceSchema.safeParse('dupr').success, false);
  });
});

const validRating = {
  user_id: '6f1c2b8e-3d4a-4c5b-9e7f-0a1b2c3d4e5f',
  rating: 1523.45,
  rating_deviation: 87.2,
  updated_at: '2026-10-07T08:30:00+00:00',
};

describe('PlayerRatingSchema', () => {
  it('parses a client-visible player_ratings row', () => {
    assert.deepEqual(PlayerRatingSchema.parse(validRating), validRating);
  });

  it('strips columns clients are not granted', () => {
    const parsed = PlayerRatingSchema.parse({ ...validRating, mmr: 1600, volatility: 0.06 });
    assert.deepEqual(parsed, validRating);
  });

  it('rejects a missing required column', () => {
    const { rating: _, ...row } = validRating;
    assert.equal(PlayerRatingSchema.safeParse(row).success, false);
  });

  it('rejects null where the column is not null', () => {
    assert.equal(PlayerRatingSchema.safeParse({ ...validRating, rating_deviation: null }).success, false);
  });

  it('rejects a numeric sent as a string', () => {
    assert.equal(PlayerRatingSchema.safeParse({ ...validRating, rating: '1523.45' }).success, false);
  });
});

describe('PlayerRatingSummarySchema', () => {
  it('parses the rating Home shows', () => {
    assert.deepEqual(PlayerRatingSummarySchema.parse({ rating: 1500 }), { rating: 1500 });
  });

  it('parses a player with no player_ratings row yet (rating null)', () => {
    assert.deepEqual(PlayerRatingSummarySchema.parse({ rating: null }), { rating: null });
  });

  it('rejects a missing rating', () => {
    assert.equal(PlayerRatingSummarySchema.safeParse({}).success, false);
  });
});
