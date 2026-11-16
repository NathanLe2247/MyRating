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
// (the response carries `Cache-Control: max-age=COURT_PHOTO_CACHE_SECONDS`).

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
 * - `not_found` (404): unknown or inactive court, no place id, no photo, or
 *   the function has no Places key configured.
 * - `upstream_error` (502): Google Places failed.
 * - `internal_error` (500): anything else (e.g. the database read failed).
 *
 * Clients show the card without a photo for all of them.
 */
export const COURT_PHOTO_ERRORS = ['invalid_request', 'not_found', 'upstream_error', 'internal_error'] as const;
export type CourtPhotoError = (typeof COURT_PHOTO_ERRORS)[number];

export const CourtPhotoErrorResponseSchema = z.object({ error: z.enum(COURT_PHOTO_ERRORS) });
export type CourtPhotoErrorResponse = z.infer<typeof CourtPhotoErrorResponseSchema>;

/** `Cache-Control: max-age` of a 200 or 404, in seconds (1 hour). */
export const COURT_PHOTO_CACHE_SECONDS = 3600;

/** Width the function asks Places for (`maxWidthPx`): a full-width card on a 3x phone. */
export const COURT_PHOTO_MAX_WIDTH_PX = 1200;
