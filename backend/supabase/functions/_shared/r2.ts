// Cloudflare R2 (S3 API) access shared by player-profile (avatar uploads) and
// clerk-webhook (avatar cleanup when a Clerk user is deleted).
import { AwsClient } from 'npm:aws4fetch@1';

export type R2 = { client: AwsClient; endpoint: string; bucket: string };

let cached: R2 | undefined;

/**
 * The R2 client and bucket location, built from env on first use. Lazy so a
 * function that only sometimes needs R2 (clerk-webhook) still boots and
 * syncs users when the R2 secrets are missing; callers that need R2 up front
 * (player-profile) call it at module load.
 */
export function getR2(): R2 {
  if (!cached) {
    cached = {
      client: new AwsClient({
        accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
        secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
        service: 's3',
        region: 'auto',
      }),
      // Origin only: some setups put the bucket in R2_ENDPOINT's path, which
      // would double it up in object URLs.
      endpoint: new URL(Deno.env.get('R2_ENDPOINT')!).origin,
      bucket: Deno.env.get('R2_BUCKET_NAME')!,
    };
  }
  return cached;
}

/** Every avatar a user uploads lives under this prefix, so a saved key can be checked for ownership. */
export const avatarPrefix = (clerkUserId: string) => `avatars/${clerkUserId}/`;

const objectUrl = ({ endpoint, bucket }: R2, key: string) =>
  `${endpoint}/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`;

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const xmlValues = (xml: string, tag: string) =>
  [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => decodeXml(m[1]));

/** Every object key under `prefix`, following ListObjectsV2 pagination. */
export async function listKeys(r2: R2, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const url = new URL(`${r2.endpoint}/${r2.bucket}`);
    url.searchParams.set('list-type', '2');
    url.searchParams.set('prefix', prefix);
    if (continuationToken) url.searchParams.set('continuation-token', continuationToken);

    const res = await r2.client.fetch(url);
    const body = await res.text();
    if (!res.ok) throw new Error(`R2 list ${prefix} failed: ${res.status} ${body.slice(0, 200)}`);

    keys.push(...xmlValues(body, 'Key'));
    continuationToken = xmlValues(body, 'IsTruncated')[0] === 'true'
      ? xmlValues(body, 'NextContinuationToken')[0]
      : undefined;
  } while (continuationToken);
  return keys;
}

/**
 * Deletes every object under `avatars/<clerkUserId>/` and returns how many.
 * One DELETE per key (a player has a handful of avatars at most), which also
 * avoids DeleteObjects' Content-MD5 requirement. Throws on the first failure;
 * calling it again resumes, since already-deleted keys are no longer listed.
 */
export async function deleteAvatars(r2: R2, clerkUserId: string): Promise<number> {
  const keys = await listKeys(r2, avatarPrefix(clerkUserId));
  for (const key of keys) {
    const res = await r2.client.fetch(objectUrl(r2, key), { method: 'DELETE' });
    // S3 DELETE is 204 even for a missing key; 404 is tolerated for safety.
    if (!res.ok && res.status !== 404) {
      throw new Error(`R2 delete ${key} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    }
    await res.body?.cancel();
  }
  return keys.length;
}
