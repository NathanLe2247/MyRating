// Clerk -> Supabase user sync.
//
// Clerk calls this for user.created / user.updated / user.deleted and we
// mirror the Clerk-owned fields (names, email, phone, login method) into
// public.users. Player-entered fields (username, date of birth, avatar, ...)
// belong to the `player-profile` function and are never touched here.
//
// Clerk can't send a Supabase JWT, so `verify_jwt` is off for this function
// (see supabase/config.toml) and the request is authenticated by its Svix
// signature (CLERK_WEBHOOK_SECRET) instead — never skip that.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { createHandler } from './handler.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(
  createHandler({
    signingSecret: Deno.env.get('CLERK_WEBHOOK_SECRET'),
    users: {
      // ON CONFLICT DO UPDATE sets only the columns in the row, so
      // player-owned columns on an existing row are left as they are.
      upsertByClerkId: (row) => db.from('users').upsert(row, { onConflict: 'clerk_user_id' }),
      deleteByClerkId: (clerkUserId) => db.from('users').delete().eq('clerk_user_id', clerkUserId),
    },
  }),
);
