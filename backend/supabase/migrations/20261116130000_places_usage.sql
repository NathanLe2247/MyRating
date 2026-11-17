-- Google Places usage counter (#106): court-photo must never cost money, so
-- every Google call it makes is reserved here first, against a hard monthly
-- cap per billing SKU that sits under Google's free monthly usage
-- (PLACES_SKUS / PLACES_MONTHLY_CAPS in shared/src/court-photo.ts). Over the
-- cap, court-photo skips Google and answers 404 as if there were no photo.
--
-- Months are calendar months in UTC. Only the service role (court-photo)
-- touches this: RLS on with no policies, no grants to anon/authenticated.

create table public.places_usage (
  -- First day of the UTC calendar month.
  month date not null check (month = date_trunc('month', month)::date),
  -- Keep in sync with PLACES_SKUS.
  sku text not null check (sku in ('place_details', 'place_photo')),
  calls integer not null default 0 check (calls >= 0),
  primary key (month, sku)
);

comment on table public.places_usage is
  'Google Places calls made by court-photo per UTC calendar month and billing SKU, for the free-tier cap. Service role only.';

alter table public.places_usage enable row level security;

revoke all on public.places_usage from anon, authenticated;
grant select, insert, update, delete on public.places_usage to service_role;

-- Reserves one call of p_sku in the current UTC month if fewer than p_cap
-- have been reserved, and says whether the call may be made. Atomic: the
-- upsert takes the row lock, so concurrent callers can't both take the last
-- slot. A refused call isn't counted. p_now is for tests only.
create function public.places_reserve_call(
  p_sku text,
  p_cap integer,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  reserved boolean;
begin
  if p_cap is null or p_cap < 1 then
    return false;
  end if;

  insert into public.places_usage as u (month, sku, calls)
  values (date_trunc('month', p_now at time zone 'utc')::date, p_sku, 1)
  on conflict (month, sku) do update
    set calls = u.calls + 1
    where u.calls < p_cap
  returning true into reserved;

  return coalesce(reserved, false);
end;
$$;

comment on function public.places_reserve_call(text, integer, timestamptz) is
  'Reserves one Google Places call of p_sku this UTC month if under p_cap; true if the call may be made. Service role only (court-photo).';

revoke execute on function public.places_reserve_call(text, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.places_reserve_call(text, integer, timestamptz) to service_role;
