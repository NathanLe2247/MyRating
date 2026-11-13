// deno test backend/supabase/functions/clerk-webhook/
//
// Requests are signed for real with standardwebhooks (what Svix and
// @clerk/backend's verifyWebhook use), so the signature check is exercised,
// not stubbed. public.users is an in-memory fake with Postgres semantics:
// upsert's ON CONFLICT DO UPDATE and update both set only the given columns,
// and update never inserts.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { Webhook } from 'npm:standardwebhooks@1';

import { type ClerkUserRow, createHandler, type UsersTable } from './handler.ts';

const SECRET = `whsec_${btoa('clerk-webhook-test-secret-0123456789')}`;
const OTHER_SECRET = `whsec_${btoa('some-other-secret-0123456789abcdef')}`;

const CLERK_OWNED_COLUMNS = [
  'clerk_user_id',
  'first_name',
  'last_name',
  'email',
  'phone_number',
  'login_method',
  'updated_at',
].sort();

type Row = Record<string, unknown>;

function fakeUsers(seed: Row[] = []) {
  const rows = new Map<string, Row>(seed.map((r) => [r.clerk_user_id as string, { ...r }]));
  const upserts: ClerkUserRow[] = [];
  const updates: ClerkUserRow[] = [];
  const deletes: string[] = [];
  const table: UsersTable = {
    upsertByClerkId(row) {
      upserts.push(row);
      rows.set(row.clerk_user_id, { ...(rows.get(row.clerk_user_id) ?? {}), ...row });
      return Promise.resolve({ error: null });
    },
    updateByClerkId(row) {
      updates.push(row);
      const existing = rows.get(row.clerk_user_id);
      if (!existing) return Promise.resolve({ error: null, matched: 0 });
      rows.set(row.clerk_user_id, { ...existing, ...row });
      return Promise.resolve({ error: null, matched: 1 });
    },
    deleteByClerkId(clerkUserId) {
      deletes.push(clerkUserId);
      rows.delete(clerkUserId);
      return Promise.resolve({ error: null });
    },
  };
  const writeCount = () => upserts.length + updates.length + deletes.length;
  return { table, rows, upserts, updates, deletes, writeCount };
}

function signedRequest(payload: unknown, secret = SECRET): Request {
  const body = JSON.stringify(payload);
  const id = `msg_${crypto.randomUUID()}`;
  const now = new Date();
  const signature = new Webhook(secret).sign(id, now, body);
  return new Request('http://localhost/clerk-webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': String(Math.floor(now.getTime() / 1000)),
      'svix-signature': signature,
    },
    body,
  });
}

const UPDATED_AT = Date.UTC(2026, 10, 1, 12, 0, 0);

function clerkUser(overrides: Record<string, unknown> = {}) {
  return {
    object: 'user',
    id: 'user_abc',
    first_name: 'Ada',
    last_name: 'Lovelace',
    username: 'clerk_side_username',
    image_url: 'https://img.clerk.com/clerk-avatar',
    primary_email_address_id: 'idn_email_1',
    primary_phone_number_id: null,
    email_addresses: [
      { id: 'idn_email_0', email_address: 'old@example.com' },
      { id: 'idn_email_1', email_address: 'ada@example.com' },
    ],
    phone_numbers: [],
    created_at: UPDATED_AT,
    updated_at: UPDATED_AT,
    ...overrides,
  };
}

const event = (type: string, data: unknown) => ({ type, object: 'event', data, timestamp: UPDATED_AT });

Deno.test('rejects a request signed with the wrong secret (401) and writes nothing', async () => {
  const users = fakeUsers();
  const handler = createHandler({ signingSecret: SECRET, users: users.table });

  const res = await handler(signedRequest(event('user.created', clerkUser()), OTHER_SECRET));

  assertEquals(res.status, 401);
  assertEquals(users.writeCount(), 0);
  assertEquals(users.rows.size, 0);
});

Deno.test('rejects a request with no signature headers (401)', async () => {
  const users = fakeUsers();
  const handler = createHandler({ signingSecret: SECRET, users: users.table });

  const res = await handler(
    new Request('http://localhost/clerk-webhook', {
      method: 'POST',
      body: JSON.stringify(event('user.created', clerkUser())),
    }),
  );

  assertEquals(res.status, 401);
  assertEquals(users.writeCount(), 0);
  assertEquals(users.rows.size, 0);
});

Deno.test('rejects a tampered body (401)', async () => {
  const users = fakeUsers();
  const handler = createHandler({ signingSecret: SECRET, users: users.table });
  const signed = signedRequest(event('user.created', clerkUser()));
  const tampered = new Request(signed.url, {
    method: 'POST',
    headers: signed.headers,
    body: JSON.stringify(event('user.created', clerkUser({ id: 'user_attacker' }))),
  });

  const res = await handler(tampered);

  assertEquals(res.status, 401);
  assertEquals(users.rows.size, 0);
});

Deno.test('answers 500 when the signing secret is not configured, so Svix retries', async () => {
  const users = fakeUsers();
  const handler = createHandler({ signingSecret: undefined, users: users.table });

  const res = await handler(signedRequest(event('user.created', clerkUser())));

  assertEquals(res.status, 500);
  assertEquals(users.rows.size, 0);
});

Deno.test('rejects non-POST methods (405)', async () => {
  const handler = createHandler({ signingSecret: SECRET, users: fakeUsers().table });
  const res = await handler(new Request('http://localhost/clerk-webhook'));
  assertEquals(res.status, 405);
});

Deno.test('user.created inserts the Clerk-owned fields, using the primary email', async () => {
  const users = fakeUsers();
  const handler = createHandler({ signingSecret: SECRET, users: users.table });
  const before = new Date().toISOString();

  const res = await handler(signedRequest(event('user.created', clerkUser())));

  assertEquals(res.status, 200);
  const { updated_at, ...row } = users.rows.get('user_abc')!;
  // Server time, not Clerk's updated_at, so the column never moves backwards.
  assert(typeof updated_at === 'string' && updated_at >= before, `updated_at ${updated_at} is not server time`);
  assertEquals(row, {
    clerk_user_id: 'user_abc',
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    phone_number: null,
    login_method: 'email',
  });
});

Deno.test('user.updated upserts onto the existing row by clerk_user_id', async () => {
  const users = fakeUsers();
  const handler = createHandler({ signingSecret: SECRET, users: users.table });
  await handler(signedRequest(event('user.created', clerkUser())));

  const res = await handler(
    signedRequest(
      event(
        'user.updated',
        clerkUser({
          last_name: 'King',
          primary_phone_number_id: 'idn_phone_1',
          phone_numbers: [{ id: 'idn_phone_1', phone_number: '+15555550100' }],
        }),
      ),
    ),
  );

  assertEquals(res.status, 200);
  assertEquals(users.rows.size, 1);
  const row = users.rows.get('user_abc')!;
  assertEquals(row.last_name, 'King');
  assertEquals(row.phone_number, '+15555550100');
  assertEquals(row.login_method, 'both');
});

Deno.test('a phone-only user gets login_method phone and a null email', async () => {
  const users = fakeUsers();
  const handler = createHandler({ signingSecret: SECRET, users: users.table });

  await handler(
    signedRequest(
      event(
        'user.created',
        clerkUser({
          primary_email_address_id: null,
          email_addresses: [],
          primary_phone_number_id: 'idn_phone_1',
          phone_numbers: [{ id: 'idn_phone_1', phone_number: '+15555550100' }],
        }),
      ),
    ),
  );

  const row = users.rows.get('user_abc')!;
  assertEquals(row.email, null);
  assertEquals(row.login_method, 'phone');
});

Deno.test('user.updated never overwrites player-owned columns', async () => {
  const playerOwned = {
    id: '6f1c8f0e-0000-4000-8000-000000000001',
    username: 'ada_l',
    date_of_birth: '1990-12-10',
    dominant_hand: 'right',
    avatar_key: 'avatars/user_abc/photo.jpg',
    profile_completed_at: '2026-10-20T10:00:00.000Z',
    rating_source: 'calibration',
    onboarding_completed_at: '2026-10-20T10:05:00.000Z',
    games_played: 7,
    created_at: '2026-10-20T09:00:00.000Z',
  };
  const users = fakeUsers([{ clerk_user_id: 'user_abc', first_name: 'Ada', ...playerOwned }]);
  const handler = createHandler({ signingSecret: SECRET, users: users.table });

  // Clerk's own username / image_url differ from the player's; they must not leak in.
  const res = await handler(signedRequest(event('user.updated', clerkUser({ first_name: 'Augusta' }))));

  assertEquals(res.status, 200);
  assertEquals(users.upserts.length, 0);
  assertEquals(Object.keys(users.updates[0]).sort(), CLERK_OWNED_COLUMNS);
  const row = users.rows.get('user_abc')!;
  assertEquals(row.first_name, 'Augusta');
  for (const [column, value] of Object.entries(playerOwned)) {
    assertEquals(row[column], value, `${column} was overwritten`);
  }
});

Deno.test('user.deleted removes the row', async () => {
  const users = fakeUsers([
    { clerk_user_id: 'user_abc', username: 'ada_l' },
    { clerk_user_id: 'user_other', username: 'other' },
  ]);
  const handler = createHandler({ signingSecret: SECRET, users: users.table });

  const res = await handler(signedRequest(event('user.deleted', { object: 'user', id: 'user_abc', deleted: true })));

  assertEquals(res.status, 200);
  assert(!users.rows.has('user_abc'));
  assert(users.rows.has('user_other'));
});

Deno.test('user.updated after user.deleted does not resurrect the row', async () => {
  const users = fakeUsers();
  const handler = createHandler({ signingSecret: SECRET, users: users.table });
  await handler(signedRequest(event('user.created', clerkUser())));
  await handler(signedRequest(event('user.deleted', { object: 'user', id: 'user_abc', deleted: true })));

  // A Svix retry or late delivery of an update made before the delete.
  const res = await handler(signedRequest(event('user.updated', clerkUser())));

  assertEquals(res.status, 200);
  assertEquals(users.rows.size, 0);
});

Deno.test('user.updated for an unknown user inserts nothing and is acknowledged', async () => {
  const users = fakeUsers();
  const handler = createHandler({ signingSecret: SECRET, users: users.table });

  const res = await handler(signedRequest(event('user.updated', clerkUser({ id: 'user_unknown' }))));

  assertEquals(res.status, 200);
  assertEquals(users.upserts.length, 0);
  assertEquals(users.rows.size, 0);
});

Deno.test('user.deleted without an id deletes nothing and is acknowledged', async () => {
  const users = fakeUsers([{ clerk_user_id: 'user_abc' }]);
  const handler = createHandler({ signingSecret: SECRET, users: users.table });

  const res = await handler(signedRequest(event('user.deleted', { object: 'user', deleted: true })));

  assertEquals(res.status, 200);
  assertEquals(users.deletes.length, 0);
  assert(users.rows.has('user_abc'));
});

Deno.test('a failed write answers 500 so Svix retries', async () => {
  const failing: UsersTable = {
    upsertByClerkId: () => Promise.resolve({ error: { message: 'boom' } }),
    updateByClerkId: () => Promise.resolve({ error: { message: 'boom' }, matched: 0 }),
    deleteByClerkId: () => Promise.resolve({ error: { message: 'boom' } }),
  };
  const handler = createHandler({ signingSecret: SECRET, users: failing });

  assertEquals((await handler(signedRequest(event('user.created', clerkUser())))).status, 500);
  assertEquals((await handler(signedRequest(event('user.updated', clerkUser())))).status, 500);
  assertEquals(
    (await handler(signedRequest(event('user.deleted', { object: 'user', id: 'user_abc', deleted: true })))).status,
    500,
  );
});

Deno.test('other event types are acknowledged and ignored', async () => {
  const users = fakeUsers();
  const handler = createHandler({ signingSecret: SECRET, users: users.table });

  const res = await handler(signedRequest(event('session.created', { object: 'session', id: 'sess_1' })));

  assertEquals(res.status, 200);
  assertEquals(users.writeCount(), 0);
});
