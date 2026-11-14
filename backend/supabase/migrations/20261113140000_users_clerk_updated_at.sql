-- Ordering and deletion guarantees for Clerk-owned columns of public.users.
--
-- Svix doesn't guarantee delivery order or exactly-once delivery, so the
-- clerk-webhook edge function can see an older user.updated after a newer one,
-- user.updated before user.created, or any of them after user.deleted.
--
-- * `users.clerk_updated_at` stores Clerk's own `updated_at` for the Clerk
--   data last written. `clerk_sync_user` only writes when the incoming value
--   is strictly newer. Null = no stamped write yet (rows from before this
--   migration), which anything beats.
-- * `deleted_clerk_users` is a tombstone per deleted Clerk user (no PII).
--   `clerk_delete_user` records it and deletes the row in one transaction, and
--   `clerk_sync_user` refuses to recreate a tombstoned user. Clerk never
--   reuses user ids, so a tombstone never needs to be cleared.
--
-- Both writers of Clerk-owned columns (clerk-webhook and player-profile) go
-- through clerk_sync_user. Internal bookkeeping: not part of a shape in
-- shared/.

alter table public.users
  add column clerk_updated_at timestamptz;

comment on column public.users.clerk_updated_at is
  'Clerk user.updated_at of the Clerk data last written (via clerk_sync_user). Older or equal writes are skipped.';

create table public.deleted_clerk_users (
  clerk_user_id text primary key,
  deleted_at timestamptz not null default now()
);

comment on table public.deleted_clerk_users is
  'Tombstones for Clerk users deleted via the clerk-webhook user.deleted event. Stops late events from recreating the user. No PII.';

-- Server-side only: RLS on with no policies, and no client grants.
alter table public.deleted_clerk_users enable row level security;
revoke all on public.deleted_clerk_users from anon, authenticated;
grant select, insert on public.deleted_clerk_users to service_role;

-- Serializes clerk_sync_user and clerk_delete_user per Clerk user, so a sync
-- racing a delete can't slip an insert in after the delete commits.
create function public.lock_clerk_user(p_clerk_user_id text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('clerk_user:' || p_clerk_user_id, 0));
$$;

-- Insert the user, or update their Clerk-owned columns if the incoming
-- Clerk updated_at is newer than the stored one. Returns {"outcome": ...}:
--   inserted  no row existed; one was inserted (user.created, or a
--             user.updated that arrived first)
--   updated   the row existed and the incoming data was newer
--   stale     the stored clerk_updated_at is >= the incoming one; nothing
--             written. Also returns "stored": the row's current Clerk-owned
--             columns, so the caller can log what would have changed.
--   deleted   the user is tombstoned; nothing written
create function public.clerk_sync_user(
  p_clerk_user_id text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone_number text,
  p_login_method public.login_method,
  p_clerk_updated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stored public.users%rowtype;
begin
  perform public.lock_clerk_user(p_clerk_user_id);

  if exists (select 1 from public.deleted_clerk_users where clerk_user_id = p_clerk_user_id) then
    return jsonb_build_object('outcome', 'deleted');
  end if;

  insert into public.users (clerk_user_id, first_name, last_name, email, phone_number, login_method, clerk_updated_at)
  values (p_clerk_user_id, p_first_name, p_last_name, p_email, p_phone_number, p_login_method, p_clerk_updated_at)
  on conflict (clerk_user_id) do nothing;
  if found then
    return jsonb_build_object('outcome', 'inserted');
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

  select * into strict stored from public.users where clerk_user_id = p_clerk_user_id;
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

-- Hard delete (see backend/CLAUDE.md): tombstone the Clerk id and delete the
-- users row in one transaction. player_ratings goes with it (ON DELETE
-- CASCADE), as must anything else referencing users.id. Idempotent; returns
-- {"deleted_rows": 0|1}.
create function public.clerk_delete_user(p_clerk_user_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_rows integer;
begin
  perform public.lock_clerk_user(p_clerk_user_id);

  insert into public.deleted_clerk_users (clerk_user_id) values (p_clerk_user_id)
  on conflict (clerk_user_id) do nothing;

  delete from public.users where clerk_user_id = p_clerk_user_id;
  get diagnostics deleted_rows = row_count;

  return jsonb_build_object('deleted_rows', deleted_rows);
end;
$$;

-- Service role only (clerk-webhook, player-profile). Functions are executable
-- by PUBLIC by default, so revoke that explicitly.
revoke all on function public.lock_clerk_user(text) from public, anon, authenticated;
revoke all on function public.clerk_sync_user(text, text, text, text, text, public.login_method, timestamptz)
  from public, anon, authenticated;
revoke all on function public.clerk_delete_user(text) from public, anon, authenticated;
grant execute on function public.lock_clerk_user(text) to service_role;
grant execute on function public.clerk_sync_user(text, text, text, text, text, public.login_method, timestamptz)
  to service_role;
grant execute on function public.clerk_delete_user(text) to service_role;
