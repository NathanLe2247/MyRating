import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COURT_PHOTO_ERRORS,
  CourtPhotoErrorResponseSchema,
  CourtPhotoRequestSchema,
  CourtPhotoResponseSchema,
  PLACES_MONTHLY_CAPS,
  PLACES_SKUS,
} from './index.ts';

describe('PLACES_MONTHLY_CAPS', () => {
  it('caps every SKU safely under the 1,000 free calls a month', () => {
    assert.deepEqual(Object.keys(PLACES_MONTHLY_CAPS).sort(), [...PLACES_SKUS].sort());
    for (const sku of PLACES_SKUS) {
      const cap = PLACES_MONTHLY_CAPS[sku];
      assert.ok(Number.isInteger(cap) && cap > 0 && cap <= 900, `${sku}: ${cap}`);
    }
  });
});

describe('COURT_PHOTO_ERRORS', () => {
  it('includes unavailable (no Places key configured)', () => {
    assert.ok(COURT_PHOTO_ERRORS.includes('unavailable'));
  });
});

const COURT_ID = 'b1000000-0000-4000-8000-000000000001';

const photo = {
  photoUri: 'https://lh3.googleusercontent.com/places/abc=s1200',
  attributions: [{ displayName: 'A Contributor', uri: 'https://maps.google.com/maps/contrib/123' }],
};

describe('CourtPhotoRequestSchema', () => {
  it('takes a court uuid', () => {
    assert.deepEqual(CourtPhotoRequestSchema.parse({ court_id: COURT_ID }), { court_id: COURT_ID });
  });

  it('rejects a missing or non-uuid court_id', () => {
    for (const query of [{}, { court_id: 'court-1' }, { court_id: '' }, { court_id: null }]) {
      assert.equal(CourtPhotoRequestSchema.safeParse(query).success, false, JSON.stringify(query));
    }
  });
});

describe('CourtPhotoResponseSchema', () => {
  it('parses a photo with attributions', () => {
    assert.deepEqual(CourtPhotoResponseSchema.parse(photo), photo);
  });

  it('accepts an attribution without a link, and no attributions', () => {
    const noLink = { ...photo, attributions: [{ displayName: 'A Contributor', uri: null }] };
    assert.deepEqual(CourtPhotoResponseSchema.parse(noLink), noLink);
    assert.equal(CourtPhotoResponseSchema.safeParse({ ...photo, attributions: [] }).success, true);
  });

  it('rejects a missing or non-URL photoUri', () => {
    assert.equal(CourtPhotoResponseSchema.safeParse({ attributions: [] }).success, false);
    assert.equal(CourtPhotoResponseSchema.safeParse({ ...photo, photoUri: 'not a url' }).success, false);
  });

  it('rejects an attribution with no name or a bad link', () => {
    for (const a of [{ displayName: '', uri: null }, { uri: null }, { displayName: 'X', uri: 'nope' }]) {
      assert.equal(
        CourtPhotoResponseSchema.safeParse({ ...photo, attributions: [a] }).success,
        false,
        JSON.stringify(a),
      );
    }
  });
});

describe('CourtPhotoErrorResponseSchema', () => {
  it('accepts every documented code and nothing else', () => {
    for (const error of COURT_PHOTO_ERRORS) {
      assert.equal(CourtPhotoErrorResponseSchema.safeParse({ error }).success, true, error);
    }
    assert.equal(CourtPhotoErrorResponseSchema.safeParse({ error: 'nope' }).success, false);
  });
});
