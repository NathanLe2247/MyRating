// cd backend/supabase/functions/court-photo && deno test
//
// The court lookup is a fake and fetch is mocked, so nothing here calls
// Google or the database. Bodies are parsed with the shared schemas.
import { assert, assertEquals, assertFalse } from 'jsr:@std/assert@1';
import {
  COURT_PHOTO_CACHE_SECONDS,
  COURT_PHOTO_MAX_WIDTH_PX,
  CourtPhotoErrorResponseSchema,
  CourtPhotoResponseSchema,
} from '@myrating/shared';

import { createHandler, type LogEvent, PLACES_BASE_URL } from './handler.ts';
import { PLACES_MONTHLY_CAPS, type PlacesSku } from '@myrating/shared';

const KEY = 'test-places-key';
const WITH_PHOTO = 'b1000000-0000-4000-8000-000000000001';
const NO_PLACE = 'b1000000-0000-4000-8000-000000000002';
const NO_PHOTOS = 'b1000000-0000-4000-8000-000000000003';
const UNKNOWN = 'b1000000-0000-4000-8000-0000000000ff';

const PLACE_IDS: Record<string, string | null> = {
  [WITH_PHOTO]: 'ChIJ-with-photo',
  [NO_PLACE]: null,
  [NO_PHOTOS]: 'ChIJ-no-photos',
};
const PHOTO_NAME = 'places/ChIJ-with-photo/photos/AXCi-photo-ref';
const PHOTO_URI = 'https://lh3.googleusercontent.com/places/AXCi-photo=s1200';

type Call = { url: string; headers: Headers; redirect: RequestRedirect | undefined };

/** A fetch that answers like Places (New), or with `override` for every call. */
function mockPlaces(override?: (url: string) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchFn = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: new Headers(init?.headers), redirect: init?.redirect });
    if (override) return Promise.resolve(override(url));
    if (url === `${PLACES_BASE_URL}/places/ChIJ-with-photo`) {
      return Promise.resolve(
        Response.json({
          photos: [
            {
              name: PHOTO_NAME,
              widthPx: 4032,
              heightPx: 3024,
              authorAttributions: [
                {
                  displayName: 'A Contributor',
                  uri: '//maps.google.com/maps/contrib/123',
                  photoUri: '//lh3.googleusercontent.com/a/avatar',
                },
                { displayName: 'No Link' },
                { uri: 'https://maps.google.com/maps/contrib/456' },
              ],
            },
            { name: 'places/ChIJ-with-photo/photos/second' },
          ],
        }),
      );
    }
    if (url === `${PLACES_BASE_URL}/places/ChIJ-no-photos`) return Promise.resolve(Response.json({}));
    if (url.startsWith(`${PLACES_BASE_URL}/${PHOTO_NAME}/media?`)) {
      return Promise.resolve(Response.json({ name: PHOTO_NAME, photoUri: PHOTO_URI }));
    }
    return Promise.resolve(Response.json({ error: { code: 404, status: 'NOT_FOUND' } }, { status: 404 }));
  }) as typeof fetch;
  return { fetchFn, calls };
}

/**
 * An in-memory public.places_reserve_call: one counter per (month, SKU),
 * refusing at the cap without counting. `month` stands in for the UTC
 * calendar month the SQL function derives from now().
 */
type FakeUsage = {
  month: string;
  reserves: { sku: PlacesSku; cap: number }[];
  count: (sku: PlacesSku, month?: string) => number;
  set: (sku: PlacesSku, calls: number, month?: string) => void;
  reserveCall: (sku: PlacesSku, cap: number) => Promise<boolean>;
};

function fakeUsage(): FakeUsage {
  const counts = new Map<string, number>();
  const usage: FakeUsage = {
    month: '2026-11',
    reserves: [],
    count: (sku, month = usage.month) => counts.get(`${month}/${sku}`) ?? 0,
    set: (sku, calls, month = usage.month) => {
      counts.set(`${month}/${sku}`, calls);
    },
    reserveCall: (sku, cap) => {
      usage.reserves.push({ sku, cap });
      const n = usage.count(sku);
      if (n >= cap) return Promise.resolve(false);
      usage.set(sku, n + 1);
      return Promise.resolve(true);
    },
  };
  return usage;
}

function setup(
  opts: {
    apiKey?: string | null;
    override?: (url: string) => Response | Promise<Response>;
    usage?: FakeUsage;
  } = {},
) {
  const { fetchFn, calls } = mockPlaces(opts.override);
  const usage = opts.usage ?? fakeUsage();
  const logs: LogEvent[] = [];
  const handler = createHandler({
    apiKey: opts.apiKey === null ? undefined : (opts.apiKey ?? KEY),
    placeIdFor: (id) => Promise.resolve(id in PLACE_IDS ? PLACE_IDS[id] : undefined),
    reserveCall: usage.reserveCall,
    fetch: fetchFn,
    log: (e) => logs.push(e),
  });
  const get = (courtId?: string, method = 'GET') =>
    handler(
      new Request(`http://localhost/court-photo${courtId === undefined ? '' : `?court_id=${courtId}`}`, { method }),
    );
  return { get, calls, logs, usage };
}

const PRIVATE_1H = `private, max-age=${COURT_PHOTO_CACHE_SECONDS}`;

async function expectError(res: Response, status: number, error: string) {
  assertEquals(res.status, status);
  assertEquals(CourtPhotoErrorResponseSchema.parse(await res.json()), { error });
}

Deno.test('success: first photo, sized for the card, with attributions and a 1h cache', async () => {
  const { get, calls } = setup();
  const res = await get(WITH_PHOTO);

  assertEquals(res.status, 200);
  assertEquals(res.headers.get('Cache-Control'), PRIVATE_1H);
  assertEquals(res.headers.get('Access-Control-Allow-Origin'), '*');
  const body = CourtPhotoResponseSchema.parse(await res.json());
  assertEquals(body, {
    photoUri: PHOTO_URI,
    attributions: [
      { displayName: 'A Contributor', uri: 'https://maps.google.com/maps/contrib/123' },
      { displayName: 'No Link', uri: null },
    ],
  });

  // Details asks only for photos; media asks for JSON (no redirect), and the
  // key goes in a header, never the URL.
  assertEquals(calls.length, 2);
  assertEquals(calls[0].url, `${PLACES_BASE_URL}/places/ChIJ-with-photo`);
  assertEquals(calls[0].headers.get('X-Goog-FieldMask'), 'photos');
  const media = new URL(calls[1].url);
  assertEquals(media.pathname, `/v1/${PHOTO_NAME}/media`);
  assertEquals(media.searchParams.get('skipHttpRedirect'), 'true');
  assertEquals(media.searchParams.get('maxWidthPx'), String(COURT_PHOTO_MAX_WIDTH_PX));
  for (const call of calls) {
    // A redirect would carry the key header to another host: refuse it.
    assertEquals(call.redirect, 'error');
    assertEquals(call.headers.get('X-Goog-Api-Key'), KEY);
    assertFalse(call.url.includes(KEY));
  }
});

Deno.test('no place id: 404 without calling Google', async () => {
  const { get, calls, logs } = setup();
  const res = await get(NO_PLACE);
  await expectError(res, 404, 'not_found');
  assertEquals(res.headers.get('Cache-Control'), PRIVATE_1H);
  assertEquals(calls.length, 0);
  assertEquals(logs, [{ event: 'no_place_id', court_id: NO_PLACE }]);
});

Deno.test('unknown or inactive court: 404 without calling Google', async () => {
  const { get, calls } = setup();
  await expectError(await get(UNKNOWN), 404, 'not_found');
  assertEquals(calls.length, 0);
});

Deno.test('no photos: 404 after Place Details only', async () => {
  const { get, calls, logs } = setup();
  await expectError(await get(NO_PHOTOS), 404, 'not_found');
  assertEquals(calls.length, 1);
  assertEquals(logs, [{ event: 'no_photo', court_id: NO_PHOTOS }]);
});

Deno.test('a place id Google no longer knows: 404, not an upstream error', async () => {
  const { get } = setup({
    override: () => Response.json({ error: { code: 404, status: 'NOT_FOUND' } }, { status: 404 }),
  });
  await expectError(await get(WITH_PHOTO), 404, 'not_found');
});

Deno.test('Google error on Place Details: 502, not cached, nothing secret logged', async () => {
  const { get, logs } = setup({
    override: () => Response.json({ error: { code: 403, status: 'PERMISSION_DENIED' } }, { status: 403 }),
  });
  const res = await get(WITH_PHOTO);
  await expectError(res, 502, 'upstream_error');
  assertEquals(res.headers.get('Cache-Control'), 'no-store');
  assertEquals(logs, [{ event: 'upstream_error', court_id: WITH_PHOTO, error: 'places 403' }]);
  assertFalse(JSON.stringify(logs).includes(KEY));
});

Deno.test('Google error on Place Photo: 502', async () => {
  const { get } = setup({
    override: (url) =>
      url.includes('/media?')
        ? new Response('oops', { status: 500 })
        : Response.json({ photos: [{ name: PHOTO_NAME }] }),
  });
  await expectError(await get(WITH_PHOTO), 502, 'upstream_error');
});

Deno.test('network failure or a malformed Google response: 502', async () => {
  const { get: networkDown } = setup({
    override: () => {
      throw new TypeError('connection refused');
    },
  });
  await expectError(await networkDown(WITH_PHOTO), 502, 'upstream_error');

  const { get: badMedia } = setup({
    override: (url) =>
      url.includes('/media?') ? Response.json({ photoUri: 'not a url' }) : Response.json({ photos: [{ name: PHOTO_NAME }] }),
  });
  await expectError(await badMedia(WITH_PHOTO), 502, 'upstream_error');
});

Deno.test('no API key: 503 unavailable, not cached, without a Google call', async () => {
  const { get, calls, logs, usage } = setup({ apiKey: null });
  const res = await get(WITH_PHOTO);
  await expectError(res, 503, 'unavailable');
  assertEquals(res.headers.get('Cache-Control'), 'no-store');
  assertEquals(usage.reserves.length, 0);
  assertEquals(calls.length, 0);
  assertEquals(logs, [{ event: 'no_api_key', court_id: WITH_PHOTO }]);
});

Deno.test('bad requests: 400', async () => {
  const { get, calls } = setup();
  await expectError(await get(), 400, 'invalid_request');
  await expectError(await get('court-1'), 400, 'invalid_request');
  await expectError(await get(WITH_PHOTO, 'POST'), 400, 'invalid_request');
  assertEquals(calls.length, 0);
});

Deno.test('CORS preflight', async () => {
  const { get } = setup();
  const res = await get(undefined, 'OPTIONS');
  assert(res.ok);
  assertEquals(res.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS');
  await res.body?.cancel();
});

Deno.test('a failed court lookup: 500', async () => {
  const handler = createHandler({
    apiKey: KEY,
    placeIdFor: () => Promise.reject(new Error('db down')),
    reserveCall: fakeUsage().reserveCall,
    fetch: mockPlaces().fetchFn,
  });
  await expectError(
    await handler(new Request(`http://localhost/court-photo?court_id=${WITH_PHOTO}`)),
    500,
    'internal_error',
  );
});

Deno.test('a redirect from Google is refused, not followed with the key', async () => {
  // fetch with redirect: 'error' rejects with a TypeError on a 3xx.
  const { get, calls } = setup({
    override: () => {
      throw new TypeError('redirect was not allowed');
    },
  });
  await expectError(await get(WITH_PHOTO), 502, 'upstream_error');
  assertEquals(calls.length, 1);
  assertEquals(calls[0].redirect, 'error');
});

Deno.test('free-tier cap: each Google call is reserved first, at the shared caps', async () => {
  const { get, usage } = setup();
  assertEquals((await get(WITH_PHOTO)).status, 200);
  assertEquals(usage.reserves, [
    { sku: 'place_details', cap: PLACES_MONTHLY_CAPS.place_details },
    { sku: 'place_photo', cap: PLACES_MONTHLY_CAPS.place_photo },
  ]);
  assertEquals(usage.count('place_details'), 1);
  assertEquals(usage.count('place_photo'), 1);
});

Deno.test('free-tier cap: the caps stay under the 1,000 free calls a month', () => {
  for (const cap of Object.values(PLACES_MONTHLY_CAPS)) assert(cap > 0 && cap <= 900, String(cap));
});

Deno.test('free-tier cap: Place Details at the cap → private 404 and no fetch at all', async () => {
  const usage = fakeUsage();
  usage.set('place_details', PLACES_MONTHLY_CAPS.place_details);
  const { get, calls, logs } = setup({ usage });

  const res = await get(WITH_PHOTO);
  await expectError(res, 404, 'not_found');
  assertEquals(res.headers.get('Cache-Control'), PRIVATE_1H);
  assertEquals(calls.length, 0);
  assertEquals(usage.count('place_details'), PLACES_MONTHLY_CAPS.place_details);
  assertEquals(usage.count('place_photo'), 0);
  assertEquals(logs, [{ event: 'free_cap_reached', court_id: WITH_PHOTO, sku: 'place_details' }]);
  assertFalse(JSON.stringify(logs).includes(KEY));
});

Deno.test('free-tier cap: counters are per SKU (photo capped, details not)', async () => {
  const usage = fakeUsage();
  usage.set('place_photo', PLACES_MONTHLY_CAPS.place_photo);
  const { get, calls, logs } = setup({ usage });

  await expectError(await get(WITH_PHOTO), 404, 'not_found');
  // Details was still allowed and made; the media call never was.
  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, `${PLACES_BASE_URL}/places/ChIJ-with-photo`);
  assertEquals(usage.count('place_details'), 1);
  assertEquals(logs, [{ event: 'free_cap_reached', court_id: WITH_PHOTO, sku: 'place_photo' }]);
  assertFalse(JSON.stringify(logs).includes(PHOTO_NAME));
});

Deno.test('free-tier cap: counters are per month (a new month is allowed again)', async () => {
  const usage = fakeUsage();
  usage.set('place_details', PLACES_MONTHLY_CAPS.place_details);
  usage.set('place_photo', PLACES_MONTHLY_CAPS.place_photo);
  const { get, calls } = setup({ usage });

  await expectError(await get(WITH_PHOTO), 404, 'not_found');
  assertEquals(calls.length, 0);

  usage.month = '2026-12';
  assertEquals((await get(WITH_PHOTO)).status, 200);
  assertEquals(calls.length, 2);
  assertEquals(usage.count('place_details'), 1);
  assertEquals(usage.count('place_details', '2026-11'), PLACES_MONTHLY_CAPS.place_details);
});

Deno.test('free-tier cap: a failing usage counter fails closed (500, no Google call)', async () => {
  const { fetchFn, calls } = mockPlaces();
  const handler = createHandler({
    apiKey: KEY,
    placeIdFor: () => Promise.resolve('ChIJ-with-photo'),
    reserveCall: () => Promise.reject(new Error('rpc down')),
    fetch: fetchFn,
  });
  const res = await handler(new Request(`http://localhost/court-photo?court_id=${WITH_PHOTO}`));
  await expectError(res, 500, 'internal_error');
  assertEquals(res.headers.get('Cache-Control'), 'no-store');
  assertEquals(calls.length, 0);
});
