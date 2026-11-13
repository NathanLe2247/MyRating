// Request handling for the clerk-webhook function, kept free of env and
// network setup (that's in index.ts) so it can be tested with a fake table.
import type { UserJSON } from 'npm:@clerk/backend@3';
import { verifyWebhook } from 'npm:@clerk/backend@3/webhooks';

import { type LoginMethod, loginMethodFor } from '../_shared/login-method.ts';

/**
 * The only public.users columns this function writes. Everything else
 * (username, date_of_birth, dominant_hand, avatar_key, profile_completed_at,
 * rating_source, onboarding_completed_at, games_played) is owned by
 * `player-profile` or `ratings` and must never appear here.
 */
export type ClerkUserRow = {
  clerk_user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  login_method: LoginMethod;
  updated_at: string;
};

type WriteResult = { error: { message: string } | null };

/** The writes the handler needs; index.ts backs them with supabase-js. */
export type UsersTable = {
  /** Insert, or on clerk_user_id conflict update only the given columns. */
  upsertByClerkId(row: ClerkUserRow): PromiseLike<WriteResult>;
  /** Update only the given columns of an existing row; never inserts. */
  updateByClerkId(row: ClerkUserRow): PromiseLike<WriteResult & { matched: number }>;
  deleteByClerkId(clerkUserId: string): PromiseLike<WriteResult>;
};

export function toUserRow(user: UserJSON): ClerkUserRow {
  const email = user.email_addresses.find((e) => e.id === user.primary_email_address_id)?.email_address ?? null;
  const phoneNumber = user.phone_numbers.find((p) => p.id === user.primary_phone_number_id)?.phone_number ?? null;

  return {
    clerk_user_id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email,
    phone_number: phoneNumber,
    login_method: loginMethodFor(email, phoneNumber),
    // Server time, like player-profile writes, so the column never moves
    // backwards when an older Clerk event is delivered late.
    updated_at: new Date().toISOString(),
  };
}

const log = (fields: Record<string, unknown>) => console.error(JSON.stringify(fields));

export function createHandler(deps: { signingSecret: string | undefined; users: UsersTable }) {
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

    // user.created is the only insert path. Upserting on the Clerk id makes
    // Svix retries idempotent.
    if (evt.type === 'user.created') {
      const { error } = await deps.users.upsertByClerkId(toUserRow(evt.data));
      if (error) {
        log({ event: 'clerk_webhook_sync_failed', type: evt.type, clerk_user_id: evt.data.id, err: error.message });
        return new Response('Sync failed', { status: 500 });
      }
    }

    // user.updated never inserts: a late or retried update arriving after
    // user.deleted must not bring the deleted user's row (and their email /
    // phone) back. No matching row is acknowledged, not retried.
    if (evt.type === 'user.updated') {
      const { error, matched } = await deps.users.updateByClerkId(toUserRow(evt.data));
      if (error) {
        log({ event: 'clerk_webhook_sync_failed', type: evt.type, clerk_user_id: evt.data.id, err: error.message });
        return new Response('Sync failed', { status: 500 });
      }
      if (matched === 0) log({ event: 'clerk_webhook_update_no_row', clerk_user_id: evt.data.id });
    }

    if (evt.type === 'user.deleted') {
      if (!evt.data.id) {
        log({ event: 'clerk_webhook_delete_missing_id' });
        return new Response('OK', { status: 200 });
      }
      // Removes the public.users row; player_ratings goes with it (ON DELETE
      // CASCADE). Nothing else references users.id yet, and the player's R2
      // avatar objects (avatars/<clerk_user_id>/) are not removed.
      const { error } = await deps.users.deleteByClerkId(evt.data.id);
      if (error) {
        log({ event: 'clerk_webhook_delete_failed', clerk_user_id: evt.data.id, err: error.message });
        return new Response('Delete failed', { status: 500 });
      }
    }

    // Other event types (sessions, orgs, ...) are acknowledged and ignored so
    // Svix doesn't retry them if the endpoint is subscribed too broadly.
    return new Response('OK', { status: 200 });
  };
}
