// court-photo: GET /court-photo?court_id=<uuid> → the court's first Google
// Places photo as a short-lived URL plus the author credits Google requires
// us to show. Wiring (env, DB) is in index.ts; this file is the logic, so
// handler.test.ts can run it with a fake court lookup and a mocked fetch.
//
// Google's terms: only the Place ID is stored (courts.google_place_id). The
// photo name and photo URL resolved here are never written anywhere and
// never logged; clients may only keep them in memory.
import {
  COURT_PHOTO_CACHE_SECONDS,
  COURT_PHOTO_MAX_WIDTH_PX,
  type CourtPhotoAttribution,
  type CourtPhotoError,
  CourtPhotoRequestSchema,
  type CourtPhotoResponse,
  CourtPhotoResponseSchema,
} from '@myrating/shared';
import { z } from 'zod';

export const PLACES_BASE_URL = 'https://places.googleapis.com/v1';

/**
 * The court's place id: a string, `null` when the court has none, or
 * `undefined` when there is no such active court.
 */
export type PlaceIdLookup = (courtId: string) => Promise<string | null | undefined>;

export type LogEvent = { event: string; court_id?: string; status?: number; error?: string };

export type HandlerDeps = {
  placeIdFor: PlaceIdLookup;
  /** `GOOGLE_PLACES_API_KEY`; unset means every court 404s. */
  apiKey: string | undefined;
  fetch?: typeof fetch;
  log?: (event: LogEvent) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const STATUS: Record<CourtPhotoError, number> = {
  invalid_request: 400,
  not_found: 404,
  upstream_error: 502,
  internal_error: 500,
};

// 200s and 404s are cacheable for an hour (the photo URL outlives that, and a
// court without a photo rarely gains one); errors are not cached.
const cacheable = `public, max-age=${COURT_PHOTO_CACHE_SECONDS}`;

function json(status: number, body: unknown, cache: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': cache },
  });
}

const fail = (error: CourtPhotoError) =>
  json(STATUS[error], { error }, error === 'not_found' ? cacheable : 'no-store');

// The subset of Places (New) responses we read. Unknown fields are ignored.
const PlaceDetailsSchema = z.object({
  photos: z
    .array(
      z.object({
        name: z.string().min(1),
        authorAttributions: z
          .array(z.object({ displayName: z.string().optional(), uri: z.string().optional() }))
          .optional(),
      }),
    )
    .optional(),
});
const PhotoMediaSchema = z.object({ photoUri: z.string().min(1) });

class UpstreamError extends Error {}

/** Google sends author links protocol-relative (`//maps.google.com/...`). */
function absoluteUri(uri: string | undefined): string | null {
  if (!uri) return null;
  const full = uri.startsWith('//') ? `https:${uri}` : uri;
  return z.url({ protocol: /^https?$/ }).safeParse(full).success ? full : null;
}

function attributionsOf(
  raw: { displayName?: string; uri?: string }[] | undefined,
): CourtPhotoAttribution[] {
  return (raw ?? [])
    .filter((a): a is { displayName: string; uri?: string } => !!a.displayName?.trim())
    .map((a) => ({ displayName: a.displayName.trim(), uri: absoluteUri(a.uri) }));
}

export function createHandler({ placeIdFor, apiKey, fetch: fetchFn = fetch, log = () => {} }: HandlerDeps) {
  async function places(url: string, headers: Record<string, string> = {}): Promise<unknown | null> {
    const res = await fetchFn(url, { headers: { 'X-Goog-Api-Key': apiKey!, ...headers } });
    // A stale or wrong place id: Google answers 404 NOT_FOUND. Treat it like
    // "no photo" rather than an outage.
    if (res.status === 404) {
      await res.body?.cancel();
      return null;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new UpstreamError(`places ${res.status}`);
    }
    return await res.json();
  }

  async function resolve(placeId: string): Promise<CourtPhotoResponse | null> {
    const raw = await places(`${PLACES_BASE_URL}/places/${encodeURIComponent(placeId)}`, {
      'X-Goog-FieldMask': 'photos',
    });
    if (raw === null) return null;
    const details = PlaceDetailsSchema.safeParse(raw);
    if (!details.success) throw new UpstreamError('places details: unexpected response');
    const photo = details.data.photos?.[0];
    if (!photo) return null;

    // photo.name is `places/<id>/photos/<ref>`: a path, so it is not encoded.
    // skipHttpRedirect returns JSON with the URL instead of the image bytes.
    const media = await places(
      `${PLACES_BASE_URL}/${photo.name}/media?maxWidthPx=${COURT_PHOTO_MAX_WIDTH_PX}&skipHttpRedirect=true`,
    );
    if (media === null) return null;
    const parsed = PhotoMediaSchema.safeParse(media);
    if (!parsed.success) throw new UpstreamError('places media: unexpected response');

    const body = CourtPhotoResponseSchema.safeParse({
      photoUri: parsed.data.photoUri,
      attributions: attributionsOf(photo.authorAttributions),
    });
    if (!body.success) throw new UpstreamError('places media: photoUri is not a URL');
    return body.data;
  }

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'GET') return fail('invalid_request');

    const query = CourtPhotoRequestSchema.safeParse({
      court_id: new URL(req.url).searchParams.get('court_id') ?? undefined,
    });
    if (!query.success) return fail('invalid_request');
    const courtId = query.data.court_id;

    if (!apiKey) {
      log({ event: 'no_api_key', court_id: courtId });
      return fail('not_found');
    }

    let placeId: string | null | undefined;
    try {
      placeId = await placeIdFor(courtId);
    } catch (e) {
      log({ event: 'db_error', court_id: courtId, error: e instanceof Error ? e.message : String(e) });
      return fail('internal_error');
    }
    if (!placeId) {
      log({ event: placeId === undefined ? 'no_court' : 'no_place_id', court_id: courtId });
      return fail('not_found');
    }

    try {
      const photo = await resolve(placeId);
      if (!photo) {
        log({ event: 'no_photo', court_id: courtId });
        return fail('not_found');
      }
      return json(200, photo, cacheable);
    } catch (e) {
      // Never log the photo name, the URL or the key; the message is ours.
      const error = e instanceof UpstreamError ? e.message : 'places request failed';
      log({ event: 'upstream_error', court_id: courtId, error });
      return fail('upstream_error');
    }
  };
}
