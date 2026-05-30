-- supabase/migrations/20260219_outbox_worker_rpc_primitives.sql
-- Adds missing outbox worker RPC primitives expected by processOutboxBatch.
-- Schema-safe and idempotent.

begin;

create or replace function public.lp_outbox_reset_stale(
  p_stale_minutes integer default 10
)
returns table(reset_count integer)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_minutes integer := greatest(1, least(coalesce(p_stale_minutes, 10), 120));
begin
  update public.outbox
     set status = 'PENDING',
         locked_at = null,
         locked_by = null,
         updated_at = now()
   where status = 'PROCESSING'
     and locked_at is not null
     and locked_at < now() - make_interval(mins => v_minutes);

  get diagnostics reset_count = row_count;
  return query select reset_count;
end
$$;

create or replace function public.lp_outbox_claim(
  p_limit integer default 25,
  p_worker text default null
)
returns setof public.outbox
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 200));
  v_worker text := coalesce(
    nullif(btrim(coalesce(p_worker, '')), ''),
    format('worker:%s', replace(gen_random_uuid()::text, '-', ''))
  );
begin
  return query
  with candidates as (
    select o.id
    from public.outbox o
    where o.status = 'PENDING'
      and (o.next_retry_at is null or o.next_retry_at <= now())
    order by o.created_at asc
    limit v_limit
    for update skip locked
  ),
  claimed as (
    update public.outbox o
       set status = 'PROCESSING',
           locked_at = now(),
           locked_by = v_worker,
           updated_at = now()
      from candidates c
     where o.id = c.id
     returning o.*
  )
  select *
  from claimed
  order by created_at asc;
end
$$;

create or replace function public.lp_outbox_mark_sent(
  p_id uuid,
  p_message_id text default null
)
returns setof public.outbox
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  return query
  update public.outbox o
     set status = 'SENT',
         delivered_at = now(),
         last_error = null,
         locked_at = null,
         locked_by = null,
         next_retry_at = null,
         updated_at = now()
   where o.id = p_id
     and o.status in ('PROCESSING', 'PENDING', 'FAILED')
  returning o.*;

  if not found then
    return query
    select *
    from public.outbox o
    where o.id = p_id;
  end if;
end
$$;

create or replace function public.lp_outbox_mark_failed(
  p_id uuid,
  p_error text
)
returns table(
  id uuid,
  status text,
  attempts integer,
  last_error text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  return query
  with updated as (
    update public.outbox o
       set attempts = coalesce(o.attempts, 0) + 1,
           last_error = left(coalesce(nullif(btrim(coalesce(p_error, '')), ''), 'unknown_error'), 2000),
           status = case
             when coalesce(o.attempts, 0) + 1 >= 10 then 'FAILED_PERMANENT'
             else 'FAILED'
           end,
           locked_at = null,
           locked_by = null,
           next_retry_at = case
             when coalesce(o.attempts, 0) + 1 >= 10 then null
             else now() + make_interval(mins => least(60, greatest(1, cast(power(2::numeric, least(coalesce(o.attempts, 0), 6)) as integer))))
           end,
           updated_at = now()
     where o.id = p_id
       and o.status in ('PROCESSING', 'PENDING', 'FAILED')
     returning o.id, o.status, o.attempts, o.last_error
  )
  select u.id, u.status, u.attempts, u.last_error
  from updated u;

  if not found then
    return query
    select o.id, o.status, o.attempts, o.last_error
    from public.outbox o
    where o.id = p_id;
  end if;
end
$$;

revoke all on function public.lp_outbox_claim(integer, text) from public;
revoke all on function public.lp_outbox_claim(integer, text) from anon;
revoke all on function public.lp_outbox_claim(integer, text) from authenticated;
grant execute on function public.lp_outbox_claim(integer, text) to service_role;
grant execute on function public.lp_outbox_claim(integer, text) to postgres;

revoke all on function public.lp_outbox_mark_sent(uuid, text) from public;
revoke all on function public.lp_outbox_mark_sent(uuid, text) from anon;
revoke all on function public.lp_outbox_mark_sent(uuid, text) from authenticated;
grant execute on function public.lp_outbox_mark_sent(uuid, text) to service_role;
grant execute on function public.lp_outbox_mark_sent(uuid, text) to postgres;

revoke all on function public.lp_outbox_mark_failed(uuid, text) from public;
revoke all on function public.lp_outbox_mark_failed(uuid, text) from anon;
revoke all on function public.lp_outbox_mark_failed(uuid, text) from authenticated;
grant execute on function public.lp_outbox_mark_failed(uuid, text) to service_role;
grant execute on function public.lp_outbox_mark_failed(uuid, text) to postgres;

revoke all on function public.lp_outbox_reset_stale(integer) from public;
revoke all on function public.lp_outbox_reset_stale(integer) from anon;
revoke all on function public.lp_outbox_reset_stale(integer) from authenticated;
grant execute on function public.lp_outbox_reset_stale(integer) to service_role;
grant execute on function public.lp_outbox_reset_stale(integer) to postgres;

alter table public.outbox enable row level security;

revoke all on table public.outbox from public;
revoke all on table public.outbox from anon;
revoke all on table public.outbox from authenticated;
grant all on table public.outbox to service_role;
grant all on table public.outbox to postgres;
commit;

