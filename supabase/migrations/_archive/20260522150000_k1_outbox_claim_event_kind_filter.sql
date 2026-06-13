-- K1 — Outbox race fix: event_kind-aware claim for SMTP worker.
-- Adds optional p_exclude_prefixes to lp_outbox_claim so workers skip keys they cannot handle.
-- Reversible via DOWN block at end of file.

begin;

-- Replace 2-arg overload with 3-arg event_kind-aware signature.
drop function if exists public.lp_outbox_claim(integer, text);

create or replace function public.lp_outbox_claim(
  p_limit integer default 25,
  p_worker text default null,
  p_exclude_prefixes text[] default null
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
      and (
        coalesce(array_length(p_exclude_prefixes, 1), 0) = 0
        or not exists (
          select 1
          from unnest(p_exclude_prefixes) as ex(prefix)
          where prefix is not null
            and btrim(prefix) <> ''
            and o.event_key like ex.prefix || '%'
        )
      )
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

revoke all on function public.lp_outbox_claim(integer, text, text[]) from public;
revoke all on function public.lp_outbox_claim(integer, text, text[]) from anon;
revoke all on function public.lp_outbox_claim(integer, text, text[]) from authenticated;
grant execute on function public.lp_outbox_claim(integer, text, text[]) to service_role;
grant execute on function public.lp_outbox_claim(integer, text, text[]) to postgres;

commit;

-- DOWN (manual rollback):
-- begin;
-- drop function if exists public.lp_outbox_claim(integer, text, text[]);
-- create or replace function public.lp_outbox_claim(p_limit integer default 25, p_worker text default null)
-- returns setof public.outbox language plpgsql security definer set search_path = public, pg_catalog as $$
-- ... restore body from 20260219_outbox_worker_rpc_primitives.sql ...
-- $$;
-- grant execute on function public.lp_outbox_claim(integer, text) to service_role;
-- grant execute on function public.lp_outbox_claim(integer, text) to postgres;
-- commit;
