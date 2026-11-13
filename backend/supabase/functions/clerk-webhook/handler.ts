// Request handling for the clerk-webhook function, kept free of env and
// network setup (that's in index.ts) so it can be tested with a fake table.
import type { UserJSON } from 'npm:@clerk/backend@3';
import { verifyWebhook } from 'npm:@clerk/backend@3/webhooks';

import { loginMethodFor } from '../_shared/login-method.ts';

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
  login_method: ReturnType<typeof loginMethodFor>;
  updated_at: string;
};

/** The two writes the handler needs; index.ts backs them with supabase-js. */
export type UsersTable = {
  /** Insert, or on clerk_user_id conflict update only the given columns. */
  upsertByClerkId(row: ClerkUserRow): PromiseLike<{ error: { message: string } | null }>;
  deleteByClerkId(clerkUserId: string): PromiseLike<{ error: { message: string } | null }>;
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
    updated_at: new Date(user.updated_at).toISOString(),
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

    // Upserts keyed on the Clerk id make Svix retries and created/updated
    // deliveries idempotent. Non-2xx responses make Svix retry.
    if (evt.type === 'user.created' || evt.type === 'user.updated') {
      const { error } = await deps.users.upsertByClerkId(toUserRow(evt.data));
      if (error) {
        log({ event: 'clerk_webhook_sync_failed', type: evt.type, clerk_user_id: evt.data.id, err: error.message });
        return new Response('Sync failed', { status: 500 });
      }
    }

    // Cascades to player_ratings and anything else keyed on users.id.
    if (evt.type === 'user.deleted' && evt.data.id) {
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
