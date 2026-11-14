// Request handling for the clerk-webhook function, kept free of env and
// network setup (that's in index.ts) so it can be tested with fakes.
import type { UserJSON } from 'npm:@clerk/backend@3';
import { verifyWebhook } from 'npm:@clerk/backend@3/webhooks';

import { type LoginMethod, loginMethodFor } from '../_shared/login-method.ts';

/**
 * The Clerk-owned public.users columns this function writes, plus
 * `clerk_updated_at` (Clerk's updated_at for the event, used to skip stale
 * deliveries). Everything else (username, date_of_birth, dominant_hand,
 * avatar_key, profile_completed_at, rating_source, onboarding_completed_at,
 * games_played) is owned by `player-profile` or `ratings` and must never
 * appear here. `updated_at` is set to now() by the database.
 */
export type ClerkUserRow = {
  clerk_user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  login_method: LoginMethod;
  clerk_updated_at: string;
};

type ClerkFields = Omit<ClerkUserRow, 'clerk_user_id'>;

/** What public.clerk_sync_user returns (see its migration). */
export type SyncResult =
  | { outcome: 'inserted' | 'updated' | 'deleted' }
  | { outcome: 'stale'; stored: Omit<ClerkFields, 'clerk_updated_at'> & { clerk_updated_at: string | null } };

type DbError = { message: string } | null;

/** The writes the handler needs; index.ts backs them with the RPCs. */
export type UsersTable = {
  /**
   * public.clerk_sync_user: inserts a missing row, or writes the Clerk-owned
   * columns only if the stored clerk_updated_at is null or older than the
   * row's. Never writes a tombstoned (deleted) user.
   */
  sync(row: ClerkUserRow): PromiseLike<{ error: DbError; result: SyncResult | null }>;
  /** public.clerk_delete_user: tombstone + delete the row, in one transaction. */
  deleteUser(clerkUserId: string): PromiseLike<{ error: DbError }>;
};

/** Removes a deleted user's files; index.ts backs it with R2. Throws on failure. */
export type AvatarStore = {
  deleteAll(clerkUserId: string): Promise<number>;
};

export class InvalidEventError extends Error {}

export function toUserRow(user: UserJSON): ClerkUserRow {
  // The stale-event guard depends on it; refuse rather than write a bogus stamp.
  if (typeof user.updated_at !== 'number' || !Number.isFinite(user.updated_at)) {
    throw new InvalidEventError(`invalid updated_at: ${JSON.stringify(user.updated_at)}`);
  }
  const email = user.email_addresses.find((e) => e.id === user.primary_email_address_id)?.email_address ?? null;
  const phoneNumber = user.phone_numbers.find((p) => p.id === user.primary_phone_number_id)?.phone_number ?? null;

  return {
    clerk_user_id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email,
    phone_number: phoneNumber,
    login_method: loginMethodFor(email, phoneNumber),
    clerk_updated_at: new Date(user.updated_at).toISOString(),
  };
}

// Values safe to log; email and phone are PII, so only "changed" is logged.
const LOGGED_VALUE_FIELDS = ['first_name', 'last_name', 'login_method'] as const;
const PII_FIELDS = ['email', 'phone_number'] as const;

/** What a skipped stale event would have changed, without PII values. */
export function staleDiff(incoming: ClerkUserRow, stored: Extract<SyncResult, { outcome: 'stale' }>['stored']) {
  const changed: Record<string, { stored: unknown; incoming: unknown } | { changed: true }> = {};
  for (const field of LOGGED_VALUE_FIELDS) {
    if (incoming[field] !== stored[field]) changed[field] = { stored: stored[field], incoming: incoming[field] };
  }
  for (const field of PII_FIELDS) {
    if (incoming[field] !== stored[field]) changed[field] = { changed: true };
  }
  return changed;
}

const log = (fields: Record<string, unknown>) => console.error(JSON.stringify(fields));

export function createHandler(deps: { signingSecret: string | undefined; users: UsersTable; avatars: AvatarStore }) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    // A missing secret is our misconfiguration, not a bad request: answer 5xx
    // so Svix keeps retrying until the secret is set.
    if (!deps.signingSecret) {
      log({ event: 'clerk_webhook_misconfigured', err: 'CLERK_WEBHOOK_SECRET is not set' });
      return new Response('Webhook secret not configured', { status: 500 });
    }

    let evt;
    try {
      evt = await verifyWebhook(req, { signingSecret: deps.signingSecret });
    } catch (err) {
      log({ event: 'clerk_webhook_unverified', err: String(err) });
      return new Response('Verification failed', { status: 401 });
    }

    // Non-2xx responses make Svix retry, so only real failures return 5xx.

    // Both events may insert, so a user.updated delivered before user.created
    // creates the row and the older user.created is then stale. Writes only
    // apply when newer than what's stored, so Svix retries (equal timestamp)
    // and out-of-order deliveries (older timestamp) are no-ops, and nothing
    // recreates a user after user.deleted (tombstone).
    if (evt.type === 'user.created' || evt.type === 'user.updated') {
      let row: ClerkUserRow;
      try {
        row = toUserRow(evt.data);
      } catch (err) {
        // Retrying the same payload can't succeed, so 400 rather than 5xx.
        log({ event: 'clerk_webhook_sync_failed', type: evt.type, clerk_user_id: evt.data?.id, err: String(err) });
        return new Response('Invalid event', { status: 400 });
      }
      const { error, result } = await deps.users.sync(row);
      if (error || !result) {
        log({ event: 'clerk_webhook_sync_failed', type: evt.type, clerk_user_id: row.clerk_user_id, err: error?.message ?? 'no result' });
        return new Response('Sync failed', { status: 500 });
      }
      if (result.outcome === 'deleted') {
        log({ event: 'clerk_webhook_event_after_delete', type: evt.type, clerk_user_id: row.clerk_user_id });
      }
      if (result.outcome === 'stale') {
        log({
          event: 'clerk_webhook_stale_event',
          type: evt.type,
          clerk_user_id: row.clerk_user_id,
          incoming_clerk_updated_at: row.clerk_updated_at,
          stored_clerk_updated_at: result.stored.clerk_updated_at,
          changed: staleDiff(row, result.stored),
        });
      }
    }

    if (evt.type === 'user.deleted') {
      const clerkUserId = evt.data.id;
      if (!clerkUserId) {
        log({ event: 'clerk_webhook_delete_missing_id' });
        return new Response('OK', { status: 200 });
      }

      // Deletion policy is a hard delete: the Clerk id is tombstoned and the
      // public.users row deleted in one transaction, and player_ratings goes
      // with it (ON DELETE CASCADE). Every table that references users.id must
      // use ON DELETE CASCADE too (backend/CLAUDE.md).
      const { error } = await deps.users.deleteUser(clerkUserId);
      if (error) {
        log({ event: 'clerk_webhook_delete_failed', clerk_user_id: clerkUserId, err: error.message });
        return new Response('Delete failed', { status: 500 });
      }

      // Then the player's R2 avatars (avatars/<clerk_user_id>/). A failure is
      // logged, not retried: the row is already gone, and answering 5xx for
      // every delete while R2 is down or misconfigured could get the whole
      // endpoint disabled by Svix, which would stop user sync too. The log
      // line is the cue to clean the prefix up by hand.
      try {
        const deleted = await deps.avatars.deleteAll(clerkUserId);
        if (deleted > 0) log({ event: 'clerk_webhook_avatars_deleted', clerk_user_id: clerkUserId, count: deleted });
      } catch (err) {
        log({ event: 'clerk_webhook_avatar_cleanup_failed', clerk_user_id: clerkUserId, err: String(err) });
      }
    }

    // Other event types (sessions, orgs, ...) are acknowledged and ignored so
    // Svix doesn't retry them if the endpoint is subscribed too broadly.
    return new Response('OK', { status: 200 });
  };
}
