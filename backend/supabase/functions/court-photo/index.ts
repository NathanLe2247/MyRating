// court-photo: a court's first Google Places photo. Logic in handler.ts.
//
// Public, like the courts list: callable with the anon key so the signed-out
// /courts screen can use it. verify_jwt is off (supabase/config.toml) because
// signed-in mobile callers send a Clerk token, which the gateway can't verify.
// The court is read with the anon key, so RLS applies: inactive courts 404.
// The service role is used only for public.places_reserve_call, the
// free-tier usage counter (PLACES_MONTHLY_CAPS), which clients can't call.
//
// Secret: GOOGLE_PLACES_API_KEY (Supabase function secret, restricted to
// Places API (New)). Never in the repo or an EXPO_PUBLIC_* var. Unset, every
// request gets a 503 `unavailable` (not cached) and the app shows cards
// without photos.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { createHandler } from './handler.ts';

const url = Deno.env.get('SUPABASE_URL')!;
const options = { auth: { persistSession: false } };
const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, options);
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, options);

Deno.serve(
  createHandler({
    apiKey: Deno.env.get('GOOGLE_PLACES_API_KEY') || undefined,
    async placeIdFor(courtId) {
      const { data, error } = await anon.from('courts').select('google_place_id').eq('id', courtId).maybeSingle();
      if (error) throw new Error(`${error.code}: ${error.message}`);
      if (!data) return undefined;
      return (data.google_place_id as string | null) ?? null;
    },
    async reserveCall(sku, cap) {
      const { data, error } = await service.rpc('places_reserve_call', { p_sku: sku, p_cap: cap });
      if (error) throw new Error(`${error.code}: ${error.message}`);
      return data === true;
    },
    log: (event) => console.log(JSON.stringify(event)),
  }),
);
