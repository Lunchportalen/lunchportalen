-- scripts/sql/verify_enterprise_hardening.sql
-- Run in psql against target DB.

-- 1) Required tables/views exist for this production schema
select
  to_regclass('public.orders') as orders,
  to_regclass('public.idempotency') as idempotency,
  to_regclass('public.outbox') as outbox;

-- 2) Orders unique index law: exactly one non-primary unique index on (user_id,date,slot)
with idx as (
  select
    i.relname as index_name,
    ix.indisunique as is_unique,
    ix.indisprimary as is_primary,
    array_agg(a.attname order by x.n) as cols
  from pg_class t
  join pg_index ix on t.oid = ix.indrelid
  join pg_class i on i.oid = ix.indexrelid
  join lateral unnest(ix.indkey) with ordinality as x(attnum, n) on true
  join pg_attribute a on a.attrelid = t.oid and a.attnum = x.attnum
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'orders'
  group by i.relname, ix.indisunique, ix.indisprimary
)
select *
from idx
where is_unique = true
order by is_primary desc, index_name;

select
  count(*) as non_primary_unique_indexes_on_orders
from (
  select ix.indexrelid
  from pg_class t
  join pg_index ix on t.oid = ix.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'orders'
    and ix.indisunique = true
    and ix.indisprimary = false
) q;

-- 3) Idempotency uniqueness law
select
  i.relname as index_name,
  ix.indisunique as is_unique,
  array_agg(a.attname order by x.n) as cols
from pg_class t
join pg_index ix on t.oid = ix.indrelid
join pg_class i on i.oid = ix.indexrelid
join lateral unnest(ix.indkey) with ordinality as x(attnum, n) on true
join pg_attribute a on a.attrelid = t.oid and a.attnum = x.attnum
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'idempotency'
  and ix.indisunique = true
group by i.relname, ix.indisunique
order by i.relname;

-- 4) Outbox status check includes PROCESSING + FAILED_PERMANENT
select conname, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'outbox'
  and c.conname = 'outbox_status_check';

-- 5) Trigger exists and enabled
select
  tg.tgname,
  tg.tgenabled,
  pg_get_triggerdef(tg.oid) as trigger_def
from pg_trigger tg
join pg_class t on t.oid = tg.tgrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'orders'
  and tg.tgname = 'orders_outbox'
  and tg.tgisinternal = false;

-- 6) SECURITY DEFINER + search_path lock on existing RPCs
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  p.prosecdef as security_definer,
  p.proconfig as proconfig
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
order by p.proname, args;

-- 7) Routine privileges: PUBLIC/anon must not have execute
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in (
    'lp_order_set',
    'lp_order_cancel',
    'lp_outbox_claim',
    'lp_outbox_mark_sent',
    'lp_outbox_mark_failed',
    'lp_outbox_reset_stale'
  )
  and grantee in ('PUBLIC', 'anon')
order by routine_name, grantee;

-- 8) Expected grants present
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in (
    'lp_order_set',
    'lp_order_cancel',
    'lp_outbox_claim',
    'lp_outbox_mark_sent',
    'lp_outbox_mark_failed',
    'lp_outbox_reset_stale'
  )
  and grantee in ('authenticated', 'service_role', 'postgres')
order by routine_name, grantee;

-- 9) Duplicate risk checks
select user_id, date, slot, count(*) as n
from public.orders
group by user_id, date, slot
having count(*) > 1;

select scope, key, count(*) as n
from public.idempotency
group by scope, key
having count(*) > 1;

-- 10) Outbox pipeline simulation (id-based claim flow)
begin;

select * from public.lp_order_set(current_date, 'lunch', 'smoke-note');

-- reset stale processing first
select * from public.lp_outbox_reset_stale(10);

-- claim one row
select * from public.lp_outbox_claim(1);

-- mark latest claimed row as sent (id-based signature expected)
with c as (
  select id from public.outbox where status = 'PROCESSING' order by locked_at desc nulls last limit 1
)
select * from public.lp_outbox_mark_sent((select id from c), null);

-- force permanent-fail path for one row and verify terminal status
with row_to_fail as (
  select id from public.outbox order by created_at desc limit 1
)
update public.outbox
   set status = 'PROCESSING',
       attempts = 10,
       locked_at = now(),
       locked_by = 'verify-script'
 where id = (select id from row_to_fail);

select * from public.lp_outbox_mark_failed((select id from row_to_fail), 'forced_test_error');
select id, status, attempts from public.outbox where id = (select id from row_to_fail);

rollback;
