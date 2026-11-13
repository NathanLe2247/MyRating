import { z } from 'zod';

/** Postgres `uuid`. */
export const UuidSchema = z.uuid();

/** Postgres `date` as PostgREST returns it: `YYYY-MM-DD`. */
export const DateSchema = z.iso.date();

/**
 * Postgres `timestamptz` as PostgREST returns it, e.g.
 * `2026-10-06T12:00:00.123456+00:00`. Also accepts the `Z` form that
 * `Date#toISOString()` writes.
 */
export const TimestampSchema = z.iso.datetime({ offset: true });
