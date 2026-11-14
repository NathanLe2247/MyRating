// deno test backend/supabase/functions/_shared/
//
// deleteAvatars against a fake S3 endpoint: ListObjectsV2 pagination, one
// DELETE per key, and errors surfacing as throws.
import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import type { AwsClient } from 'npm:aws4fetch@1';

import { deleteAvatars, isSafeKeyUnder, type R2 } from './r2.ts';

const ENDPOINT = 'https://acct.r2.cloudflarestorage.com';
const BUCKET = 'myrating';

function listXml(keys: string[], nextToken?: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>${BUCKET}</Name>` +
    keys.map((k) => `<Contents><Key>${k}</Key><Size>1</Size></Contents>`).join('') +
    `<IsTruncated>${nextToken ? 'true' : 'false'}</IsTruncated>` +
    (nextToken ? `<NextContinuationToken>${nextToken}</NextContinuationToken>` : '') +
    `</ListBucketResult>`;
}

/** Fake S3: `pages[token ?? '']` answers a list; DELETEs are recorded. */
function fakeR2(pages: Record<string, { keys: string[]; next?: string }>, opts: { failDelete?: string } = {}) {
  const lists: URL[] = [];
  const deleted: string[] = [];
  const client = {
    fetch(input: string | URL, init?: RequestInit) {
      const url = new URL(input);
      if ((init?.method ?? 'GET') === 'DELETE') {
        const key = decodeURIComponent(url.pathname.slice(`/${BUCKET}/`.length));
        if (key === opts.failDelete) return Promise.resolve(new Response('AccessDenied', { status: 403 }));
        deleted.push(key);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      lists.push(url);
      const page = pages[url.searchParams.get('continuation-token') ?? ''];
      if (!page) return Promise.resolve(new Response('NoSuchToken', { status: 400 }));
      return Promise.resolve(new Response(listXml(page.keys, page.next), { status: 200 }));
    },
  };
  const r2: R2 = { client: client as unknown as AwsClient, endpoint: ENDPOINT, bucket: BUCKET };
  return { r2, lists, deleted };
}

Deno.test('lists every page under the user prefix and deletes each object', async () => {
  const { r2, lists, deleted } = fakeR2({
    '': { keys: ['avatars/user_abc/1.jpg', 'avatars/user_abc/2.png'], next: 'tok&1' },
    'tok&1': { keys: ['avatars/user_abc/3.webp'] },
  });

  const count = await deleteAvatars(r2, 'user_abc');

  assertEquals(count, 3);
  assertEquals(deleted, ['avatars/user_abc/1.jpg', 'avatars/user_abc/2.png', 'avatars/user_abc/3.webp']);
  assertEquals(lists.length, 2);
  for (const url of lists) {
    assertEquals(url.origin + url.pathname, `${ENDPOINT}/${BUCKET}`);
    assertEquals(url.searchParams.get('list-type'), '2');
    assertEquals(url.searchParams.get('prefix'), 'avatars/user_abc/');
  }
});

Deno.test('decodes XML entities in keys and continuation tokens', async () => {
  const { r2, deleted } = fakeR2({
    '': { keys: ['avatars/user_abc/a&amp;b.jpg'], next: 'x&amp;y' },
    'x&y': { keys: [] },
  });

  await deleteAvatars(r2, 'user_abc');

  assertEquals(deleted, ['avatars/user_abc/a&b.jpg']);
});

Deno.test('no objects means no deletes', async () => {
  const { r2, deleted } = fakeR2({ '': { keys: [] } });
  assertEquals(await deleteAvatars(r2, 'user_abc'), 0);
  assertEquals(deleted, []);
});

Deno.test('a failed list or delete throws', async () => {
  await assertRejects(() => deleteAvatars(fakeR2({}).r2, 'user_abc'), Error, 'R2 list');
  await assertRejects(
    () =>
      deleteAvatars(
        fakeR2({ '': { keys: ['avatars/user_abc/1.jpg'] } }, { failDelete: 'avatars/user_abc/1.jpg' }).r2,
        'user_abc',
      ),
    Error,
    'R2 delete',
  );
});

Deno.test('a truncated listing without a continuation token throws instead of stopping early', async () => {
  const xml = listXml(['avatars/user_abc/1.jpg']).replace('<IsTruncated>false', '<IsTruncated>true');
  const client = { fetch: () => Promise.resolve(new Response(xml, { status: 200 })) };
  const r2: R2 = { client: client as unknown as AwsClient, endpoint: ENDPOINT, bucket: BUCKET };

  await assertRejects(() => deleteAvatars(r2, 'user_abc'), Error, 'truncated without a continuation token');
});

Deno.test('keys outside the user prefix or with dot/empty segments abort before any delete', async () => {
  const badKeys = [
    'avatars/user_other/1.jpg',
    'avatars/user_abc/../user_other/1.jpg',
    'avatars/user_abc/./1.jpg',
    'avatars/user_abc//1.jpg',
  ];
  for (const bad of badKeys) {
    const { r2, deleted } = fakeR2({ '': { keys: ['avatars/user_abc/ok.jpg', bad] } });
    await assertRejects(() => deleteAvatars(r2, 'user_abc'), Error, 'outside the prefix');
    assertEquals(deleted, [], bad);
  }
});

Deno.test('isSafeKeyUnder', () => {
  assertEquals(isSafeKeyUnder('avatars/u/', 'avatars/u/a.jpg'), true);
  assertEquals(isSafeKeyUnder('avatars/u/', 'avatars/u/'), false);
  assertEquals(isSafeKeyUnder('avatars/u/', 'avatars/u2/a.jpg'), false);
  assertEquals(isSafeKeyUnder('avatars/u/', 'avatars/u/../v/a.jpg'), false);
});
