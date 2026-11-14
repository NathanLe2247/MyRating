import { avatarPrefix, getR2 } from '../_shared/r2.ts';

export { avatarPrefix };

// Built at module load, as before the client moved to _shared, so a missing
// R2 secret still fails this function at boot.
const { client: r2, endpoint, bucket } = getR2();
const publicBaseUrl = Deno.env.get('R2_PUBLIC_URL')!;

const UPLOAD_URL_TTL_SECONDS = 600;

export const AVATAR_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Own-property check, so inherited names like `constructor` aren't accepted as a type. */
export const isAvatarContentType = (value: unknown): value is string =>
  typeof value === 'string' && Object.hasOwn(AVATAR_CONTENT_TYPES, value);

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * True only for keys `createAvatarUploadUrl` could have issued to this user:
 * `avatars/<clerk_user_id>/<uuid>.<ext>`. A bare prefix check would accept
 * `avatars/<id>/../<other id>/…`, which resolves to someone else's photo once
 * it's turned into a public URL.
 */
export function isOwnAvatarKey(clerkUserId: string, key: string): boolean {
  const exts = Object.values(AVATAR_CONTENT_TYPES).join('|');
  return new RegExp(`^${escapeRegExp(avatarPrefix(clerkUserId))}[0-9a-f-]{36}\\.(${exts})$`).test(key);
}

/**
 * Presigned PUT URL for a new avatar. The client uploads the file directly to
 * R2 with the same Content-Type, then sends `key` along with the profile.
 */
export async function createAvatarUploadUrl(clerkUserId: string, contentType: string) {
  const key = `${avatarPrefix(clerkUserId)}${crypto.randomUUID()}.${AVATAR_CONTENT_TYPES[contentType]}`;
  const url = new URL(`${endpoint}/${bucket}/${key}`);
  url.searchParams.set('X-Amz-Expires', String(UPLOAD_URL_TTL_SECONDS));

  const signed = await r2.sign(
    new Request(url, { method: 'PUT', headers: { 'Content-Type': contentType } }),
    { aws: { signQuery: true } },
  );

  return { uploadUrl: signed.url, key, publicUrl: `${publicBaseUrl}/${key}` };
}
