import { useAuth } from '@clerk/expo';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useMemo } from 'react';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Auth is Clerk, not Supabase Auth: the client authenticates every request
// with the Clerk session token via `accessToken`, instead of Supabase's own
// AsyncStorage-persisted session.
export function useSupabaseClient(): SupabaseClient {
  const { getToken } = useAuth();

  return useMemo(
    () =>
      createClient(supabaseUrl, supabaseAnonKey, {
        accessToken: async () => (await getToken()) ?? null,
      }),
    [getToken],
  );
}
