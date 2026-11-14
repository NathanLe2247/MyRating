import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GeoJsonPointSchema } from './common.ts';
import { CourtSchema, NearbyCourtSchema } from './court.ts';

// Shaped like a public.courts_geojson row from PostgREST.
const validCourt = {
  id: '0b6e3c1a-2f4d-4e8a-9c7b-5d1e2f3a4b5c',
  name: 'Golden Gate Park Pickleball',
  location: { type: 'Point', coordinates: [-122.4862, 37.7694] },
  is_active: true,
  created_at: '2026-11-13T12:00:00.123456+00:00',
};

const withCoordinates = (coordinates: unknown) => ({
  ...validCourt,
  location: { type: 'Point', coordinates },
});

describe('CourtSchema', () => {
  it('parses a courts_geojson row', () => {
    assert.deepEqual(CourtSchema.parse(validCourt), validCourt);
  });

  it('accepts the edges of the coordinate ranges', () => {
    for (const coordinates of [[-180, -90], [180, 90], [0, 0]]) {
      assert.equal(CourtSchema.safeParse(withCoordinates(coordinates)).success, true, String(coordinates));
    }
  });

  it('rejects out-of-range coordinates', () => {
    for (const coordinates of [[-180.0001, 0], [180.5, 0], [0, -90.1], [0, 91]]) {
      assert.equal(CourtSchema.safeParse(withCoordinates(coordinates)).success, false, String(coordinates));
    }
  });

  it('rejects [lat, lng] order when the longitude is not a valid latitude', () => {
    assert.equal(CourtSchema.safeParse(withCoordinates([37.7694, -122.4862])).success, false);
  });

  it('rejects a location that is not a GeoJSON point', () => {
    const bad = [
      '0101000020E6100000', // WKB hex: what PostgREST returns for the raw table
      { type: 'LineString', coordinates: [-122.4862, 37.7694] },
      { type: 'Point', coordinates: [-122.4862] },
      { type: 'Point', coordinates: [-122.4862, 37.7694, 12] },
      { type: 'Point', coordinates: ['-122.4862', '37.7694'] },
      { coordinates: [-122.4862, 37.7694] },
      null,
    ];
    for (const location of bad) {
      assert.equal(CourtSchema.safeParse({ ...validCourt, location }).success, false, JSON.stringify(location));
    }
  });

  it('rejects wrong column types', () => {
    assert.equal(CourtSchema.safeParse({ ...validCourt, id: 'court-1' }).success, false);
    assert.equal(CourtSchema.safeParse({ ...validCourt, name: '' }).success, false);
    assert.equal(CourtSchema.safeParse({ ...validCourt, name: null }).success, false);
    assert.equal(CourtSchema.safeParse({ ...validCourt, is_active: 'true' }).success, false);
    assert.equal(CourtSchema.safeParse({ ...validCourt, created_at: '2026-11-13' }).success, false);
  });

  it('rejects a missing column', () => {
    const { is_active: _, ...row } = validCourt;
    assert.equal(CourtSchema.safeParse(row).success, false);
  });
});

describe('NearbyCourtSchema', () => {
  const nearby = { ...validCourt, distance_m: 998.6 };

  it('parses a nearby_courts row', () => {
    assert.deepEqual(NearbyCourtSchema.parse(nearby), nearby);
  });

  it('accepts distance 0 (court at the requested point)', () => {
    assert.equal(NearbyCourtSchema.safeParse({ ...nearby, distance_m: 0 }).success, true);
  });

  it('rejects a negative, missing, or non-numeric distance', () => {
    assert.equal(NearbyCourtSchema.safeParse({ ...nearby, distance_m: -1 }).success, false);
    assert.equal(NearbyCourtSchema.safeParse(validCourt).success, false);
    assert.equal(NearbyCourtSchema.safeParse({ ...nearby, distance_m: '998.6' }).success, false);
  });

  it('applies the CourtSchema rules to the court columns', () => {
    const bad = { ...nearby, location: { type: 'Point', coordinates: [0, 91] } };
    assert.equal(NearbyCourtSchema.safeParse(bad).success, false);
  });
});

describe('GeoJsonPointSchema', () => {
  it('parses ST_AsGeoJSON output for a geography point', () => {
    const point: unknown = JSON.parse('{"type":"Point","coordinates":[-73.9857,40.7484]}');
    assert.deepEqual(GeoJsonPointSchema.parse(point), { type: 'Point', coordinates: [-73.9857, 40.7484] });
  });
});
