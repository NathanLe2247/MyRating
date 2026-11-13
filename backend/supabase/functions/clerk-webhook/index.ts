// Clerk -> Supabase user sync.
//
// Clerk calls this for user.created / user.updated / user.deleted and we
// mirror the Clerk-owned fields (names, email, phone, login method) into
// public.users. Player-entered fields (username, date of birth, avatar, ...)
// belong to the `player-profile` function and are never touched here.
//
// Clerk can't send a Supabase JWT, so `verify_jwt` is off for this function
// (see supabase/config.toml) and the request is authenticated by its Svix
// signature instead — never skip that.
import { verifyWebhook } from 'npm:@clerk/backend@3/webhooks';
import type { UserWebhookEvent } from 'npm:@clerk/backend@3/webhooks';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { loginMethodFor } from '../_shared/login-method.ts';

type UserJSON = Extract<UserWebhookEvent, { type: 'user.created' }>['data'];

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function toUserRow(user: UserJSON) {
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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let evt;
  try {
    evt = await verifyWebhook(req, { signingSecret: Deno.env.get('CLERK_WEBHOOK_SECRET') });
  } catch (err) {
    console.error(JSON.stringify({ event: 'clerk_webhook_unverified', err: String(err) }));
    return new Response('Verification failed', { status: 400 });
  }

  // Upserts keyed on the Clerk id make Svix retries and out-of-order
  // created/updated deliveries idempotent. Non-2xx responses make Svix retry.
  if (evt.type === 'user.created' || evt.type === 'user.updated') {
    const { error } = await db.from('users').upsert(toUserRow(evt.data), { onConflict: 'clerk_user_id' });
    if (error) {
      console.error(JSON.stringify({ event: 'clerk_webhook_sync_failed', type: evt.type, clerk_user_id: evt.data.id, err: error.message }));
      return new Response('Sync failed', { status: 500 });
    }
  }

  // Cascades to player_ratings and anything else keyed on users.id.
  if (evt.type === 'user.deleted' && evt.data.id) {
    const { error } = await db.from('users').delete().eq('clerk_user_id', evt.data.id);
    if (error) {
      console.error(JSON.stringify({ event: 'clerk_webhook_delete_failed', clerk_user_id: evt.data.id, err: error.message }));
      return new Response('Delete failed', { status: 500 });
    }
  }

  return new Response('OK', { status: 200 });
});
