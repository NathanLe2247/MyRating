// Onboarding steps 1 ("Create your profile") and 2 ("What's your pickleball
// rating?"). All routes require a Clerk session token:
//
//   POST /player-profile                    save the profile (upserts public.users)
//   POST /player-profile/username           { username } -> { available }
//   POST /player-profile/avatar-upload-url  { contentType } -> { uploadUrl, key, publicUrl }
//   POST /player-profile/rating-source      { source } -> finishes onboarding
//
// public.users is service-role-write-only, so this function is its writer for
// player-entered fields; Clerk-owned fields (names, email, phone) are read from
// Clerk here rather than trusted from the client.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { authenticate, getClerkIdentity, markOnboardingCompleted, markProfileCompleted } from './clerk.ts';
import { createAvatarUploadUrl, isAvatarContentType, isOwnAvatarKey } from './r2.ts';

// Keep in sync with mobile/src/constants/profile.ts and the users_username_format check.
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
const DOMINANT_HANDS = ['left', 'ambi', 'right'] as const;
const MIN_BIRTH_DATE = '1900-01-01';
// Subset of public.rating_source the app can pick today; DUPR and USA
// Pickleball imports aren't implemented yet.
const SUPPORTED_RATING_SOURCES = ['calibration'] as const;

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type ProfileInput = {
  username: string;
  dateOfBirth: string;
  dominantHand: (typeof DOMINANT_HANDS)[number];
  avatarKey: string | null;
};

/** `YYYY-MM-DD` that is a real calendar date, after MIN_BIRTH_DATE and before today. */
function isValidBirthDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  const today = new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10) === value && value >= MIN_BIRTH_DATE && value < today;
}

function parseProfile(body: Record<string, unknown>, clerkUserId: string): ProfileInput | string {
  const { username, dateOfBirth, dominantHand, avatarKey } = body;
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) return 'invalid_username';
  if (!isValidBirthDate(dateOfBirth)) return 'invalid_date_of_birth';
  if (!DOMINANT_HANDS.includes(dominantHand as ProfileInput['dominantHand'])) return 'invalid_dominant_hand';
  if (avatarKey != null && (typeof avatarKey !== 'string' || !isOwnAvatarKey(clerkUserId, avatarKey))) {
    return 'invalid_avatar_key';
  }
  return {
    username,
    dateOfBirth,
    dominantHand: dominantHand as ProfileInput['dominantHand'],
    avatarKey: (avatarKey as string | null | undefined) ?? null,
  };
}

async function isUsernameAvailable(username: string, clerkUserId: string) {
  const { count, error } = await db
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('username', username)
    .neq('clerk_user_id', clerkUserId);
  if (error) throw error;
  return count === 0;
}

async function saveProfile(clerkUserId: string, body: Record<string, unknown>) {
  const input = parseProfile(body, clerkUserId);
  if (typeof input === 'string') return json(422, { error: input });

  const identity = await getClerkIdentity(clerkUserId);
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('users')
    .upsert(
      {
        clerk_user_id: identity.clerkUserId,
        first_name: identity.firstName,
        last_name: identity.lastName,
        email: identity.email,
        phone_number: identity.phoneNumber,
        login_method: identity.loginMethod,
        username: input.username,
        date_of_birth: input.dateOfBirth,
        dominant_hand: input.dominantHand,
        avatar_key: input.avatarKey,
        profile_completed_at: now,
        updated_at: now,
      },
      { onConflict: 'clerk_user_id' },
    )
    .select('id')
    .single();

  if (error) {
    // Lost a race with someone else claiming the same handle.
    if (error.code === '23505') return json(409, { error: 'username_taken' });
    throw error;
  }

  // After the DB write: if this fails the client retries, and the upsert is idempotent.
  await markProfileCompleted(clerkUserId, now);

  // No PII in logs — just what was recorded, for tracing onboarding.
  console.log(
    JSON.stringify({
      event: 'player_profile_saved',
      user_id: data.id,
      clerk_user_id: clerkUserId,
      login_method: identity.loginMethod,
      has_avatar: input.avatarKey !== null,
    }),
  );

  return json(200, { id: data.id });
}

// Step 2: records how the starting rating will be set and finishes onboarding.
// Requires step 1, since that's what creates the public.users row.
async function saveRatingSource(clerkUserId: string, body: Record<string, unknown>) {
  const { source } = body;
  if (!SUPPORTED_RATING_SOURCES.includes(source as (typeof SUPPORTED_RATING_SOURCES)[number])) {
    return json(422, { error: 'unsupported_rating_source' });
  }

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('users')
    .update({ rating_source: source, onboarding_completed_at: now, updated_at: now })
    .eq('clerk_user_id', clerkUserId)
    .not('profile_completed_at', 'is', null)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) return json(409, { error: 'profile_required' });

  await markOnboardingCompleted(clerkUserId, now);

  console.log(
    JSON.stringify({ event: 'onboarding_completed', user_id: data.id, clerk_user_id: clerkUserId, rating_source: source }),
  );

  return json(200, { id: data.id });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const clerkUserId = await authenticate(req);
  if (!clerkUserId) return json(401, { error: 'unauthorized' });

  const route = new URL(req.url).pathname.split('/player-profile')[1] ?? '';
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    switch (route) {
      case '':
      case '/':
        return await saveProfile(clerkUserId, body);

      case '/username': {
        const { username } = body;
        if (typeof username !== 'string' || !USERNAME_PATTERN.test(username)) {
          return json(422, { error: 'invalid_username' });
        }
        return json(200, { available: await isUsernameAvailable(username, clerkUserId) });
      }

      case '/avatar-upload-url': {
        const { contentType } = body;
        if (!isAvatarContentType(contentType)) {
          return json(422, { error: 'unsupported_content_type' });
        }
        return json(200, await createAvatarUploadUrl(clerkUserId, contentType));
      }

      case '/rating-source':
        return await saveRatingSource(clerkUserId, body);

      default:
        return json(404, { error: 'not_found' });
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'player_profile_error', route, clerk_user_id: clerkUserId, err: String(err) }));
    return json(500, { error: 'internal' });
  }
});
