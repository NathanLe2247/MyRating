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
  PLACES_MONTHLY_CAPS,
  type PlacesSku,
} from '@myrating/shared';
import { z } from 'zod';

export const PLACES_BASE_URL = 'https://places.googleapis.com/v1';

/**
 * The court's place id: a string, `null` when the court has none, or
 * `undefined` when there is no such active court.
 */
export type PlaceIdLookup = (courtId: string) => Promise<string | null | undefined>;

/**
 * Reserves one Google call of `sku` in this calendar month (UTC), if fewer
 * than `cap` have been made (`public.places_reserve_call`, atomic). False
 * means the free-tier cap is reached and the call must not be made.
 */
export type ReserveCall = (sku: PlacesSku, cap: number) => Promise<boolean>;

export type LogEvent = { event: string; court_id?: string; sku?: PlacesSku; error?: string };

export type HandlerDeps = {
  placeIdFor: PlaceIdLookup;
  reserveCall: ReserveCall;
  /** `GOOGLE_PLACES_API_KEY`; unset means every request gets a 503 `unavailable`. */
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
  unavailable: 503,
};

// 200s and 404s (a court without a place or photo rarely gains one) may be
// cached for an hour, but only by the client: `private`, so no CDN or proxy
// stores the photoUri (Google's terms allow holding it in memory only).
// Google doesn't document how long a photoUri stays valid, so clients must
// handle the image failing to load. Errors are not cached.
const cacheable = `private, max-age=${COURT_PHOTO_CACHE_SECONDS}`;

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

/** The month's free-tier cap for `sku` is used up: no Google call was made. */
class CapReached extends Error {
  constructor(readonly sku: PlacesSku) {
    super(`cap reached: ${sku}`);
  }
}

/** The usage counter couldn't be read: fail closed, never call Google. */
class ReserveFailed extends Error {}

export function createHandler({
  placeIdFor,
  reserveCall,
  apiKey,
  fetch: fetchFn = fetch,
  log = () => {},
}: HandlerDeps) {
  // Every Google call is reserved first, so usage can't pass the free tier.
  async function reserve(sku: PlacesSku) {
    let allowed: boolean;
    try {
      allowed = await reserveCall(sku, PLACES_MONTHLY_CAPS[sku]);
    } catch (e) {
      throw new ReserveFailed(e instanceof Error ? e.message : String(e));
    }
    if (!allowed) throw new CapReached(sku);
  }

  async function places(url: string, headers: Record<string, string> = {}): Promise<unknown | null> {
    // redirect: 'error' so the key header can never follow a redirect to
    // another host (skipHttpRedirect means Places shouldn't send one).
    const res = await fetchFn(url, { headers: { 'X-Goog-Api-Key': apiKey!, ...headers }, redirect: 'error' });
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
    // Field mask `photos` only: any other field could bill a pricier SKU.
    await reserve('place_details');
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
    await reserve('place_photo');
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
      // 503, not a cached 404: once the key is set, photos appear at once.
      log({ event: 'no_api_key', court_id: courtId });
      return fail('unavailable');
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
      if (e instanceof CapReached) {
        // Same answer as "no photo": the card just shows without one.
        log({ event: 'free_cap_reached', court_id: courtId, sku: e.sku });
        return fail('not_found');
      }
      if (e instanceof ReserveFailed) {
        log({ event: 'usage_counter_error', court_id: courtId, error: e.message });
        return fail('internal_error');
      }
      // Never log the photo name, the URL or the key; the message is ours.
      const error = e instanceof UpstreamError ? e.message : 'places request failed';
      log({ event: 'upstream_error', court_id: courtId, error });
      return fail('upstream_error');
    }
  };
}
