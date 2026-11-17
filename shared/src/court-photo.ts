import { z } from 'zod';

import { UuidSchema } from './common.ts';

// Request and response shapes of the `court-photo` edge function
// (backend/supabase/functions/court-photo/). Callable with the anon key,
// so the signed-out courts screen can use it.
//
//   GET /functions/v1/court-photo?court_id=<uuid>
//
// The function looks up the court's `google_place_id` and resolves its first
// Google Places photo. Nothing it returns is stored anywhere: Google's terms
// forbid caching photo names or URLs, so clients keep it only in memory
// (the response carries `Cache-Control: private,
// max-age=COURT_PHOTO_CACHE_SECONDS`, so shared caches don't store it).
// Google doesn't document how long `photoUri` stays valid: handle the image
// failing to load by showing the card without a photo.

/** Query parameters of `GET /court-photo`. */
export const CourtPhotoRequestSchema = z.object({
  court_id: UuidSchema,
});
export type CourtPhotoRequest = z.infer<typeof CourtPhotoRequestSchema>;

/**
 * One author credit for the photo (Places `authorAttributions`). Google
 * requires showing it with the photo: "Photo: <displayName>", linking to
 * `uri` when there is one.
 */
export const CourtPhotoAttributionSchema = z.object({
  displayName: z.string().min(1),
  uri: z.url().nullable(),
});
export type CourtPhotoAttribution = z.infer<typeof CourtPhotoAttributionSchema>;

/** A 200 from `court-photo`. `photoUri` is short-lived: never persist it. */
export const CourtPhotoResponseSchema = z.object({
  photoUri: z.url(),
  attributions: z.array(CourtPhotoAttributionSchema),
});
export type CourtPhotoResponse = z.infer<typeof CourtPhotoResponseSchema>;

/**
 * The `{ error }` codes:
 * - `invalid_request` (400): missing or non-uuid `court_id`, or not a GET.
 * - `not_found` (404, cached like a 200): unknown or inactive court, no
 *   place id, or no photo.
 * - `upstream_error` (502): Google Places failed.
 * - `internal_error` (500): anything else (e.g. the database read failed).
 * - `unavailable` (503, not cached): the function has no Places key
 *   configured yet.
 *
 * Clients show the card without a photo for all of them.
 */
export const COURT_PHOTO_ERRORS = [
  'invalid_request',
  'not_found',
  'upstream_error',
  'internal_error',
  'unavailable',
] as const;
export type CourtPhotoError = (typeof COURT_PHOTO_ERRORS)[number];

export const CourtPhotoErrorResponseSchema = z.object({ error: z.enum(COURT_PHOTO_ERRORS) });
export type CourtPhotoErrorResponse = z.infer<typeof CourtPhotoErrorResponseSchema>;

/** `Cache-Control: private, max-age` of a 200 or 404, in seconds (1 hour). */
export const COURT_PHOTO_CACHE_SECONDS = 3600;

/** Width the function asks Places for (`maxWidthPx`): a full-width card on a 3x phone. */
export const COURT_PHOTO_MAX_WIDTH_PX = 1200;

/**
 * The Google Places billing SKUs court-photo calls, as stored in
 * `public.places_usage.sku` (20261116130000_places_usage.sql):
 * - `place_details`: Place Details with field mask `photos` only.
 * - `place_photo`: Place Photo media (Google's "Place Details Photos" SKU).
 */
export const PLACES_SKUS = ['place_details', 'place_photo'] as const;
export type PlacesSku = (typeof PLACES_SKUS)[number];

/**
 * Hard monthly caps (calendar month, UTC) on court-photo's Google calls, so
 * it never leaves Google's free monthly usage. Google gives 1,000 free calls
 * a month for these SKUs; the caps sit safely under that. Each call is
 * reserved in `public.places_reserve_call` before it is made; over the cap
 * court-photo skips Google and answers 404 `not_found`. Never raise these
 * above the free threshold of the SKU.
 */
export const PLACES_MONTHLY_CAPS: Readonly<Record<PlacesSku, number>> = {
  place_details: 900,
  place_photo: 900,
};
