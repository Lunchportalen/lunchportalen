-- supabase/migrations/20260217_enterprise_outbox_worker_rpc.sql
-- Production-compatible hardening for schemas using:
--   public.outbox
--   public.idempotency
-- No RPC signatures are changed in this migration.

begin;

-- 1) Orders uniqueness law
create unique index if not exists orders_user_date_slot_uq
  on public.orders (user_id, date, slot);

-- Remove conflicting non-primary unique indexes on orders.
do $$
declare
  r record;
begin
  for r in
    select
      i.indexrelid::regclass as idx_name,
      array_agg(a.attname order by k.ord) as cols
    from pg_index i
    join pg_class t on t.oid = i.indrelid
    join pg_namespace n on n.oid = t.relnamespace
    join lateral unnest(i.indkey) with ordinality as k(attnum, ord) on true
    join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
    where n.nspname = 'public'
      and t.relname = 'orders'
      and i.indisunique = true
      and i.indisprimary = false
    group by i.indexrelid
  loop
    if r.cols <> array['user_id','date','slot'] then
      execute format('drop index if exists %s', r.idx_name);
    end if;
  end loop;
end $$;

-- 2) Idempotency uniqueness law
create unique index if not exists idempotency_scope_key_uq
  on public.idempotency (scope, key);

-- 3) Outbox status law + worker lock columns
alter table if exists public.outbox
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text;

alter table if exists public.outbox
  drop constraint if exists outbox_status_check;

alter table if exists public.outbox
  add constraint outbox_status_check
  check (status in ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'FAILED_PERMANENT'));

create index if not exists outbox_claim_idx
  on public.outbox (status, attempts, created_at);

-- 4) Trigger: enqueue outbox event on order insert/update (enum-safe status handling)
create or replace function public.lp_orders_outbox_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_status text;
  v_kind text;
  v_event_key text;
begin
  -- enum-safe: cast enum to text, do not coalesce enum with empty string
  v_status := upper(trim(new.status::text));

  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status
       and new.note is not distinct from old.note
       and new.slot is not distinct from old.slot
       and new.date is not distinct from old.date then
      return new;
    end if;
  end if;

  if v_status not in ('ACTIVE', 'CANCELLED') then
    return new;
  end if;

  v_kind := case when v_status = 'CANCELLED' then 'cancel' else 'set' end;
  v_event_key := format(
    'order:%s:%s:%s:%s',
    v_kind,
    new.user_id::text,
    new.date::text,
    coalesce(new.slot, 'unknown')
  );

  insert into public.outbox (event_key, payload, status, attempts)
  values (
    v_event_key,
    jsonb_build_object(
      'eventType', case when v_kind = 'cancel' then 'ORDER_CANCELLED' else 'ORDER_PLACED' end,
      'eventKey', v_event_key,
      'userId', new.user_id,
      'companyId', new.company_id,
      'locationId', new.location_id,
      'date', new.date,
      'slot', new.slot,
      'status', v_status,
      'orderId', new.id,
      'timestampISO', now()
    ),
    'PENDING',
    0
  )
  on conflict (event_key) do nothing;

  return new;
end;
$$;

drop trigger if exists orders_outbox on public.orders;
create trigger orders_outbox
after insert or update of status, note, slot, date on public.orders
for each row
execute function public.lp_orders_outbox_trigger();

alter table public.orders enable trigger orders_outbox;

-- 5) Keep existing SECURITY DEFINER RPC signatures; harden search_path on current overloads.
do $$
declare
  r record;
begin
  for r in
    select
      n.nspname,
      p.proname,
      oidvectortypes(p.proargtypes) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'lp_order_set',
        'lp_order_cancel',
        'lp_outbox_claim',
        'lp_outbox_mark_sent',
        'lp_outbox_mark_failed',
        'lp_outbox_reset_stale'
      )
      and p.prosecdef = true
  loop
    execute format(
      'alter function %I.%I(%s) set search_path = public, pg_catalog',
      r.nspname,
      r.proname,
      r.args
    );
  end loop;
end $$;

-- 6) Privileges: no PUBLIC/anon execute; allow authenticated/service_role/postgres.
--    Apply to all existing overloads without changing signatures.
do $$
declare
  r record;
begin
  for r in
    select
      n.nspname,
      p.proname,
      oidvectortypes(p.proargtypes) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'lp_order_set',
        'lp_order_cancel',
        'lp_outbox_claim',
        'lp_outbox_mark_sent',
        'lp_outbox_mark_failed',
        'lp_outbox_reset_stale'
      )
  loop
    execute format('revoke all on function %I.%I(%s) from public', r.nspname, r.proname, r.args);
    execute format('revoke all on function %I.%I(%s) from anon', r.nspname, r.proname, r.args);

    execute format('grant execute on function %I.%I(%s) to authenticated', r.nspname, r.proname, r.args);
    execute format('grant execute on function %I.%I(%s) to service_role', r.nspname, r.proname, r.args);
    execute format('grant execute on function %I.%I(%s) to postgres', r.nspname, r.proname, r.args);
  end loop;
end $$;

commit;
