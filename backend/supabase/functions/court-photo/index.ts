// court-photo: a court's first Google Places photo. Logic in handler.ts.
//
// Public, like the courts list: callable with the anon key so the signed-out
// /courts screen can use it. verify_jwt is off (supabase/config.toml) because
// signed-in mobile callers send a Clerk token, which the gateway can't verify.
// The court is read with the anon key, so RLS applies: inactive courts 404.
//
// Secret: GOOGLE_PLACES_API_KEY (Supabase function secret, restricted to
// Places API (New)). Never in the repo or an EXPO_PUBLIC_* var. Unset, every
// court 404s and the app shows cards without photos.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { createHandler } from './handler.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
  auth: { persistSession: false },
});

Deno.serve(
  createHandler({
    apiKey: Deno.env.get('GOOGLE_PLACES_API_KEY') || undefined,
    async placeIdFor(courtId) {
      const { data, error } = await db.from('courts').select('google_place_id').eq('id', courtId).maybeSingle();
      if (error) throw new Error(`${error.code}: ${error.message}`);
      if (!data) return undefined;
      return (data.google_place_id as string | null) ?? null;
    },
    log: (event) => console.log(JSON.stringify(event)),
  }),
);
