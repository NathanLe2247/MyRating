// deno test backend/supabase/functions/clerk-webhook/
//
// Requests are signed for real with standardwebhooks (what Svix and
// @clerk/backend's verifyWebhook use), so the signature check is exercised,
// not stubbed. public.users is an in-memory fake of public.clerk_sync_user
// (its SQL is covered by supabase/tests/clerk_sync_user.test.sql): writes only
// when the stored clerk_updated_at is null or older, inserts only when
// allowed, and touches only the columns it's given. R2 is a fake AvatarStore.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { Webhook } from 'npm:standardwebhooks@1';

import { type AvatarStore, type ClerkUserRow, createHandler, type SyncResult, type UsersTable } from './handler.ts';

const SECRET = `whsec_${btoa('clerk-webhook-test-secret-0123456789')}`;
const OTHER_SECRET = `whsec_${btoa('some-other-secret-0123456789abcdef')}`;

const CLERK_OWNED_COLUMNS = [
  'clerk_user_id',
  'first_name',
  'last_name',
  'email',
  'phone_number',
  'login_method',
  'clerk_updated_at',
].sort();

type Row = Record<string, unknown>;

function fakeUsers(seed: Row[] = []) {
  const rows = new Map<string, Row>(seed.map((r) => [r.clerk_user_id as string, { ...r }]));
  const syncs: { row: ClerkUserRow; allowInsert: boolean }[] = [];
  const deletes: string[] = [];
  const table: UsersTable = {
    sync(row, { allowInsert }) {
      syncs.push({ row, allowInsert });
      const existing = rows.get(row.clerk_user_id);
      let result: SyncResult;
      if (!existing) {
        if (allowInsert) rows.set(row.clerk_user_id, { ...row });
        result = { outcome: allowInsert ? 'inserted' : 'missing' };
      } else if (existing.clerk_updated_at == null || (existing.clerk_updated_at as string) < row.clerk_updated_at) {
        rows.set(row.clerk_user_id, { ...existing, ...row });
        result = { outcome: 'updated' };
      } else {
        const { first_name, last_name, email, phone_number, login_method, clerk_updated_at } = existing;
        result = {
          outcome: 'stale',
          stored: { first_name, last_name, email, phone_number, login_method, clerk_updated_at } as Extract<
            SyncResult,
            { outcome: 'stale' }
          >['stored'],
        };
      }
      return Promise.resolve({ error: null, result });
    },
    deleteByClerkId(clerkUserId) {
      deletes.push(clerkUserId);
      rows.delete(clerkUserId);
      return Promise.resolve({ error: null });
    },
  };
  const writeCount = () => syncs.length + deletes.length;
  return { table, rows, syncs, deletes, writeCount };
}

function fakeAvatars(objects: Record<string, string[]> = {}, opts: { fail?: boolean } = {}) {
  const calls: string[] = [];
  const store: AvatarStore = {
    deleteAll(clerkUserId) {
      calls.push(clerkUserId);
      if (opts.fail) return Promise.reject(new Error('R2 list avatars/user_abc/ failed: 403'));
      const count = objects[clerkUserId]?.length ?? 0;
      delete objects[clerkUserId];
      return Promise.resolve(count);
    },
  };
  return { store, calls, objects };
}

/** Captures the handler's structured log lines (console.error JSON). */
async function captureLogs<T>(fn: () => Promise<T>): Promise<{ result: T; logs: Record<string, unknown>[] }> {
  const logs: Record<string, unknown>[] = [];
  const original = console.error;
  console.error = (line: string) => logs.push(JSON.parse(line));
  try {
    return { result: await fn(), logs };
  } finally {
    console.error = original;
  }
}

function setup(seed: Row[] = [], avatarObjects: Record<string, string[]> = {}, avatarOpts: { fail?: boolean } = {}) {
  const users = fakeUsers(seed);
  const avatars = fakeAvatars(avatarObjects, avatarOpts);
  const handler = createHandler({ signingSecret: SECRET, users: users.table, avatars: avatars.store });
  return { users, avatars, handler };
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

const T1 = Date.UTC(2026, 10, 1, 12, 0, 0);
const T2 = T1 + 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

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
    created_at: T1,
    updated_at: T1,
    ...overrides,
  };
}

const event = (type: string, data: unknown) => ({ type, object: 'event', data, timestamp: T1 });
const deletedEvent = (id = 'user_abc') => event('user.deleted', { object: 'user', id, deleted: true });

// --- authentication ---------------------------------------------------------

Deno.test('rejects a request signed with the wrong secret (401) and writes nothing', async () => {
  const { users, avatars, handler } = setup();

  const res = await handler(signedRequest(event('user.created', clerkUser()), OTHER_SECRET));

  assertEquals(res.status, 401);
  assertEquals(users.writeCount(), 0);
  assertEquals(avatars.calls.length, 0);
});

Deno.test('rejects a request with no signature headers (401) and writes nothing', async () => {
  const { users, avatars, handler } = setup();

  const res = await handler(
    new Request('http://localhost/clerk-webhook', { method: 'POST', body: JSON.stringify(deletedEvent()) }),
  );

  assertEquals(res.status, 401);
  assertEquals(users.writeCount(), 0);
  assertEquals(avatars.calls.length, 0);
});

Deno.test('rejects a tampered body (401)', async () => {
  const { users, handler } = setup();
  const signed = signedRequest(event('user.created', clerkUser()));
  const tampered = new Request(signed.url, {
    method: 'POST',
    headers: signed.headers,
    body: JSON.stringify(event('user.created', clerkUser({ id: 'user_attacker' }))),
  });

  const res = await handler(tampered);

  assertEquals(res.status, 401);
  assertEquals(users.writeCount(), 0);
});

Deno.test('answers 500 when the signing secret is not configured, so Svix retries', async () => {
  const users = fakeUsers();
  const handler = createHandler({ signingSecret: undefined, users: users.table, avatars: fakeAvatars().store });

  const res = await handler(signedRequest(event('user.created', clerkUser())));

  assertEquals(res.status, 500);
  assertEquals(users.writeCount(), 0);
});

Deno.test('rejects non-POST methods (405)', async () => {
  const { handler } = setup();
  const res = await handler(new Request('http://localhost/clerk-webhook'));
  assertEquals(res.status, 405);
});

// --- created / updated --------------------------------------------------------

Deno.test('user.created inserts the Clerk-owned fields, using the primary email', async () => {
  const { users, avatars, handler } = setup();

  const res = await handler(signedRequest(event('user.created', clerkUser())));

  assertEquals(res.status, 200);
  assertEquals(users.syncs[0].allowInsert, true);
  assertEquals(users.rows.get('user_abc'), {
    clerk_user_id: 'user_abc',
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    phone_number: null,
    login_method: 'email',
    clerk_updated_at: iso(T1),
  });
  assertEquals(avatars.calls.length, 0);
});

Deno.test('a newer user.updated changes the existing row', async () => {
  const { users, avatars, handler } = setup();
  await handler(signedRequest(event('user.created', clerkUser())));

  const res = await handler(
    signedRequest(
      event(
        'user.updated',
        clerkUser({
          last_name: 'King',
          primary_phone_number_id: 'idn_phone_1',
          phone_numbers: [{ id: 'idn_phone_1', phone_number: '+15555550100' }],
          updated_at: T2,
        }),
      ),
    ),
  );

  assertEquals(res.status, 200);
  assertEquals(users.syncs[1].allowInsert, false);
  const row = users.rows.get('user_abc')!;
  assertEquals(row.last_name, 'King');
  assertEquals(row.phone_number, '+15555550100');
  assertEquals(row.login_method, 'both');
  assertEquals(row.clerk_updated_at, iso(T2));
  assertEquals(avatars.calls.length, 0);
});

Deno.test('a phone-only user gets login_method phone and a null email', async () => {
  const { users, handler } = setup();

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
  const { users, handler } = setup([{ clerk_user_id: 'user_abc', first_name: 'Ada', ...playerOwned }]);

  // Clerk's own username / image_url differ from the player's; they must not leak in.
  const res = await handler(signedRequest(event('user.updated', clerkUser({ first_name: 'Augusta' }))));

  assertEquals(res.status, 200);
  assertEquals(Object.keys(users.syncs[0].row).sort(), CLERK_OWNED_COLUMNS);
  const row = users.rows.get('user_abc')!;
  assertEquals(row.first_name, 'Augusta');
  for (const [column, value] of Object.entries(playerOwned)) {
    assertEquals(row[column], value, `${column} was overwritten`);
  }
});

Deno.test('user.updated for an unknown user inserts nothing and is acknowledged', async () => {
  const { users, handler } = setup();

  const { result: res, logs } = await captureLogs(() =>
    handler(signedRequest(event('user.updated', clerkUser({ id: 'user_unknown' }))))
  );

  assertEquals(res.status, 200);
  assertEquals(users.rows.size, 0);
  assertEquals(logs.map((l) => l.event), ['clerk_webhook_update_no_row']);
});

// --- stale / out-of-order deliveries -----------------------------------------

Deno.test('an older user.updated after a newer one keeps the newer values and logs the diff', async () => {
  const { users, handler } = setup();
  const newer = clerkUser({
    first_name: 'Augusta',
    email_addresses: [{ id: 'idn_email_1', email_address: 'augusta@example.com' }],
    updated_at: T2,
  });
  await handler(signedRequest(event('user.created', newer)));
  const before = { ...users.rows.get('user_abc') };

  const { result: res, logs } = await captureLogs(() =>
    handler(signedRequest(event('user.updated', clerkUser({ updated_at: T1 }))))
  );

  assertEquals(res.status, 200);
  assertEquals(users.rows.get('user_abc'), before);
  assertEquals(logs.length, 1);
  assertEquals(logs[0], {
    event: 'clerk_webhook_stale_event',
    type: 'user.updated',
    clerk_user_id: 'user_abc',
    incoming_clerk_updated_at: iso(T1),
    stored_clerk_updated_at: iso(T2),
    changed: {
      first_name: { stored: 'Augusta', incoming: 'Ada' },
      // PII: only that it differs, never the values.
      email: { changed: true },
    },
  });
  assert(!JSON.stringify(logs).includes('example.com'), 'an email address was logged');
});

Deno.test('a retried event with the same clerk_updated_at is a no-op', async () => {
  const { users, handler } = setup();
  await handler(signedRequest(event('user.created', clerkUser())));
  const before = { ...users.rows.get('user_abc') };

  const { result: res, logs } = await captureLogs(() =>
    handler(signedRequest(event('user.updated', clerkUser({ first_name: 'Changed but same timestamp' }))))
  );

  assertEquals(res.status, 200);
  assertEquals(users.rows.get('user_abc'), before);
  assertEquals(logs[0].event, 'clerk_webhook_stale_event');
});

Deno.test('a row with no clerk_updated_at (player-profile wrote it) accepts any event', async () => {
  const { users, handler } = setup([
    { clerk_user_id: 'user_abc', first_name: 'Old', login_method: 'email', clerk_updated_at: null, username: 'ada_l' },
  ]);

  const res = await handler(signedRequest(event('user.created', clerkUser())));

  assertEquals(res.status, 200);
  const row = users.rows.get('user_abc')!;
  assertEquals(row.first_name, 'Ada');
  assertEquals(row.clerk_updated_at, iso(T1));
  assertEquals(row.username, 'ada_l');
});

// --- deleted ------------------------------------------------------------------

Deno.test('user.deleted removes the row and the user\'s R2 avatars', async () => {
  const { users, avatars, handler } = setup(
    [
      { clerk_user_id: 'user_abc', username: 'ada_l' },
      { clerk_user_id: 'user_other', username: 'other' },
    ],
    { user_abc: ['avatars/user_abc/a.jpg', 'avatars/user_abc/b.png'], user_other: ['avatars/user_other/c.jpg'] },
  );

  const res = await handler(signedRequest(deletedEvent()));

  assertEquals(res.status, 200);
  assert(!users.rows.has('user_abc'));
  assert(users.rows.has('user_other'));
  assertEquals(avatars.calls, ['user_abc']);
  assertEquals(Object.keys(avatars.objects), ['user_other']);
});

Deno.test('an R2 cleanup failure is logged and still answers 200 (row already gone)', async () => {
  const { users, handler } = setup([{ clerk_user_id: 'user_abc' }], {}, { fail: true });

  const { result: res, logs } = await captureLogs(() => handler(signedRequest(deletedEvent())));

  assertEquals(res.status, 200);
  assert(!users.rows.has('user_abc'));
  assertEquals(logs.map((l) => l.event), ['clerk_webhook_avatar_cleanup_failed']);
  assertEquals(logs[0].clerk_user_id, 'user_abc');
});

Deno.test('a failed row delete answers 500 and skips R2, so Svix retries both', async () => {
  const avatars = fakeAvatars({ user_abc: ['avatars/user_abc/a.jpg'] });
  const handler = createHandler({
    signingSecret: SECRET,
    users: {
      sync: () => Promise.resolve({ error: null, result: { outcome: 'updated' } }),
      deleteByClerkId: () => Promise.resolve({ error: { message: 'boom' } }),
    },
    avatars: avatars.store,
  });

  const { result: res } = await captureLogs(() => handler(signedRequest(deletedEvent())));

  assertEquals(res.status, 500);
  assertEquals(avatars.calls.length, 0);
});

Deno.test('user.updated after user.deleted does not resurrect the row', async () => {
  const { users, handler } = setup();
  await handler(signedRequest(event('user.created', clerkUser())));
  await handler(signedRequest(deletedEvent()));

  // A Svix retry or late delivery of an update made before the delete.
  const { result: res } = await captureLogs(() =>
    handler(signedRequest(event('user.updated', clerkUser({ updated_at: T2 }))))
  );

  assertEquals(res.status, 200);
  assertEquals(users.rows.size, 0);
});

Deno.test('user.deleted without an id deletes nothing and is acknowledged', async () => {
  const { users, avatars, handler } = setup([{ clerk_user_id: 'user_abc' }]);

  const { result: res } = await captureLogs(() =>
    handler(signedRequest(event('user.deleted', { object: 'user', deleted: true })))
  );

  assertEquals(res.status, 200);
  assertEquals(users.deletes.length, 0);
  assertEquals(avatars.calls.length, 0);
  assert(users.rows.has('user_abc'));
});

// --- failures and other events ------------------------------------------------

Deno.test('a failed sync answers 500 so Svix retries', async () => {
  const handler = createHandler({
    signingSecret: SECRET,
    users: {
      sync: () => Promise.resolve({ error: { message: 'boom' }, result: null }),
      deleteByClerkId: () => Promise.resolve({ error: null }),
    },
    avatars: fakeAvatars().store,
  });

  await captureLogs(async () => {
    assertEquals((await handler(signedRequest(event('user.created', clerkUser())))).status, 500);
    assertEquals((await handler(signedRequest(event('user.updated', clerkUser())))).status, 500);
  });
});

Deno.test('other event types are acknowledged and ignored', async () => {
  const { users, avatars, handler } = setup();

  const res = await handler(signedRequest(event('session.created', { object: 'session', id: 'sess_1' })));

  assertEquals(res.status, 200);
  assertEquals(users.writeCount(), 0);
  assertEquals(avatars.calls.length, 0);
});
