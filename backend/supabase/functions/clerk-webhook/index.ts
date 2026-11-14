// Clerk -> Supabase user sync.
//
// Clerk calls this for user.created / user.updated / user.deleted and we
// mirror the Clerk-owned fields (names, email, phone, login method) into
// public.users, and on delete remove the row and the player's R2 avatars.
// Player-entered fields (username, date of birth, avatar, ...) belong to the
// `player-profile` function and are never touched here.
//
// Clerk can't send a Supabase JWT, so `verify_jwt` is off for this function
// (see supabase/config.toml) and the request is authenticated by its Svix
// signature (CLERK_WEBHOOK_SECRET) instead — never skip that.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { deleteAvatars, getR2 } from '../_shared/r2.ts';
import { createHandler, type SyncResult } from './handler.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

Deno.serve(
  createHandler({
    signingSecret: Deno.env.get('CLERK_WEBHOOK_SECRET'),
    users: {
      // The RPCs hold a per-user advisory lock, so concurrent deliveries
      // (including a sync racing a delete) can't interleave.
      sync: async (row) => {
        const { data, error } = await db.rpc('clerk_sync_user', {
          p_clerk_user_id: row.clerk_user_id,
          p_first_name: row.first_name,
          p_last_name: row.last_name,
          p_email: row.email,
          p_phone_number: row.phone_number,
          p_login_method: row.login_method,
          p_clerk_updated_at: row.clerk_updated_at,
        });
        return { error, result: (data as SyncResult | null) ?? null };
      },
      deleteUser: (clerkUserId) => db.rpc('clerk_delete_user', { p_clerk_user_id: clerkUserId }),
    },
    // getR2() is called per delete so missing R2 secrets only fail cleanup.
    avatars: { deleteAll: (clerkUserId) => deleteAvatars(getR2(), clerkUserId) },
  }),
);
