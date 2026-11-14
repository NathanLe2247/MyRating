-- Out-of-order protection for the clerk-webhook edge function.
--
-- Svix doesn't guarantee delivery order, so an older user.updated can arrive
-- after a newer one. `clerk_updated_at` stores Clerk's own `updated_at` for
-- the event last applied, and `clerk_sync_user` only writes when the incoming
-- event is strictly newer. Null = no Clerk event applied yet (rows created by
-- player-profile, or rows from before this migration), which any event beats.
--
-- Only Clerk-owned columns are written here; player-entered columns belong to
-- player-profile. Internal bookkeeping: not part of a shape in shared/.

alter table public.users
  add column clerk_updated_at timestamptz;

comment on column public.users.clerk_updated_at is
  'Clerk user.updated_at of the last webhook event applied by clerk-webhook. Older or equal events are skipped.';

-- Returns {"outcome": ...}:
--   inserted  no row existed and p_allow_insert (user.created) inserted one
--   updated   the row existed and the event was newer; Clerk columns written
--   missing   no row and inserts not allowed (user.updated for a deleted or
--             unknown user); nothing written
--   stale     the row's clerk_updated_at is >= the event's; nothing written.
--             Also returns "stored": the row's current Clerk-owned columns, so
--             the caller can log what the stale event would have changed.
create function public.clerk_sync_user(
  p_clerk_user_id text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone_number text,
  p_login_method public.login_method,
  p_clerk_updated_at timestamptz,
  p_allow_insert boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stored public.users%rowtype;
begin
  if p_allow_insert then
    insert into public.users (clerk_user_id, first_name, last_name, email, phone_number, login_method, clerk_updated_at)
    values (p_clerk_user_id, p_first_name, p_last_name, p_email, p_phone_number, p_login_method, p_clerk_updated_at)
    on conflict (clerk_user_id) do nothing;
    if found then
      return jsonb_build_object('outcome', 'inserted');
    end if;
  end if;

  update public.users
     set first_name = p_first_name,
         last_name = p_last_name,
         email = p_email,
         phone_number = p_phone_number,
         login_method = p_login_method,
         clerk_updated_at = p_clerk_updated_at,
         updated_at = now()
   where clerk_user_id = p_clerk_user_id
     and (clerk_updated_at is null or clerk_updated_at < p_clerk_updated_at);
  if found then
    return jsonb_build_object('outcome', 'updated');
  end if;

  select * into stored from public.users where clerk_user_id = p_clerk_user_id;
  if not found then
    return jsonb_build_object('outcome', 'missing');
  end if;

  return jsonb_build_object(
    'outcome', 'stale',
    'stored', jsonb_build_object(
      'first_name', stored.first_name,
      'last_name', stored.last_name,
      'email', stored.email,
      'phone_number', stored.phone_number,
      'login_method', stored.login_method,
      'clerk_updated_at', stored.clerk_updated_at
    )
  );
end;
$$;

-- Service role only (clerk-webhook). Functions are executable by PUBLIC by
-- default, so revoke that explicitly.
revoke all on function public.clerk_sync_user(text, text, text, text, text, public.login_method, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.clerk_sync_user(text, text, text, text, text, public.login_method, timestamptz, boolean)
  to service_role;
