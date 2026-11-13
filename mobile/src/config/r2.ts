// Cloudflare R2 public bucket (player photos etc.). Read at call time so the
// value Expo inlines at build time is used, and tests can set it.

function r2PublicBase(): string | null {
  const base = process.env.EXPO_PUBLIC_R2_PUBLIC_URL;
  if (!base || !base.startsWith('https://')) return null;
  return base.replace(/\/+$/, '');
}

/**
 * True only for an object URL inside the app's R2 public bucket. Use it before
 * loading an image URL that came from outside the app (route params, deep
 * links), so arbitrary remote images are never fetched.
 */
export function isR2PublicUrl(url: string): boolean {
  const base = r2PublicBase();
  if (!base) return false;
  return url.startsWith(`${base}/`) && !url.includes('..');
}
