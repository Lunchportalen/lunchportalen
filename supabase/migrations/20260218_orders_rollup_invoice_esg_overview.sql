-- supabase/migrations/20260218_orders_rollup_invoice_esg_overview.sql
-- Task 2: Orders partitioning + rollups + invoice/esg/export tables + lp_order_set v2

begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 0) Pre-flight assertions and schema-safe hardening
-- =========================================================
do $$
declare
  v_missing_orders text[];
  v_missing_profiles text[];
  v_missing_agreements text[];
  v_missing_outbox text[];
begin
  if to_regclass('public.orders') is null then
    raise exception 'required table missing: public.orders';
  end if;

  if to_regclass('public.profiles') is null then
    raise exception 'required table missing: public.profiles';
  end if;

  if to_regclass('public.agreements') is null then
    raise exception 'required table missing: public.agreements';
  end if;

  if to_regclass('public.outbox') is null then
    raise exception 'required table missing: public.outbox';
  end if;

  select array_agg(c) into v_missing_orders
  from (
    select c
    from unnest(array[
      'id',
      'user_id',
      'company_id',
      'location_id',
      'date',
      'status',
      'created_at',
      'updated_at',
      'slot'
    ]) as c
    where not exists (
      select 1
      from information_schema.columns ic
      where ic.table_schema = 'public'
        and ic.table_name = 'orders'
        and ic.column_name = c
    )
  ) q;

  if coalesce(array_length(v_missing_orders, 1), 0) > 0 then
    raise exception 'orders missing required columns: %', v_missing_orders;
  end if;

  select array_agg(c) into v_missing_profiles
  from (
    select c
    from unnest(array[
      'user_id',
      'role',
      'company_id',
      'location_id'
    ]) as c
    where not exists (
      select 1
      from information_schema.columns ic
      where ic.table_schema = 'public'
        and ic.table_name = 'profiles'
        and ic.column_name = c
    )
  ) q;

  if coalesce(array_length(v_missing_profiles, 1), 0) > 0 then
    raise exception 'profiles missing required columns: %', v_missing_profiles;
  end if;

  select array_agg(c) into v_missing_agreements
  from (
    select c
    from unnest(array[
      'company_id',
      'location_id',
      'status',
      'tier',
      'delivery_days',
      'starts_at',
      'slot_start',
      'slot_end'
    ]) as c
    where not exists (
      select 1
      from information_schema.columns ic
      where ic.table_schema = 'public'
        and ic.table_name = 'agreements'
        and ic.column_name = c
    )
  ) q;

  if coalesce(array_length(v_missing_agreements, 1), 0) > 0 then
    raise exception 'agreements missing required columns: %', v_missing_agreements;
  end if;

  -- Existing outbox baseline columns (payload is added below if missing)
  select array_agg(c) into v_missing_outbox
  from (
    select c
    from unnest(array[
      'event_key',
      'status',
      'attempts',
      'last_error',
      'locked_at',
      'locked_by'
    ]) as c
    where not exists (
      select 1
      from information_schema.columns ic
      where ic.table_schema = 'public'
        and ic.table_name = 'outbox'
        and ic.column_name = c
    )
  ) q;

  if coalesce(array_length(v_missing_outbox, 1), 0) > 0 then
    raise exception 'outbox missing required base columns: %', v_missing_outbox;
  end if;
end
$$;

-- Ensure outbox has all write columns we need for idempotent requeue
alter table public.outbox
  add column if not exists payload jsonb,
  add column if not exists next_retry_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists outbox_event_key_uniq
  on public.outbox (event_key);

create index if not exists outbox_status_attempts_created_idx
  on public.outbox (status, attempts, created_at);

-- =========================================================
-- 1) Orders partitioning helper (monthly range by date)
-- =========================================================
create or replace function public.lp_ensure_orders_partition(p_month date)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month)::date + interval '1 month')::date;
  v_part_name text := format('orders_y%sm%s', to_char(v_start, 'YYYY'), to_char(v_start, 'MM'));
  v_parent_partitioned boolean;
begin
  select exists (
    select 1
    from pg_partitioned_table pt
    join pg_class c on c.oid = pt.partrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'orders'
  ) into v_parent_partitioned;

  if not v_parent_partitioned then
    raise exception 'public.orders is not partitioned';
  end if;

  if to_regclass(format('public.%I', v_part_name)) is null then
    execute format(
      'create table public.%I partition of public.orders for values from (%L) to (%L)',
      v_part_name,
      v_start,
      v_end
    );
  end if;
end;
$$;

-- =========================================================
-- 1.1) Convert public.orders to partitioned table if needed
--      (schema-safe, keeps backup table for rollback)
-- SAFETY: Single atomic transaction. Holds ACCESS EXCLUSIVE on orders for
-- rename + create + copy. Run in maintenance window; ensure backup before run.
-- Not split into phases: atomicity avoids window where orders is empty.
-- =========================================================
do $$
declare
  v_is_partitioned boolean;
  v_backup text := format('orders_unpartitioned_backup_%s', to_char(clock_timestamp(), 'YYYYMMDDHH24MISS'));
  v_first date;
  v_last date;
  v_month date;
  v_until date;
  v_cols_no_generated text;
  v_has_slot boolean;
  v_has_rls boolean := false;
  v_force_rls boolean := false;
  r record;
  v_roles_sql text;
  v_using_sql text;
  v_check_sql text;
begin
  select exists (
    select 1
    from pg_partitioned_table pt
    join pg_class c on c.oid = pt.partrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'orders'
  ) into v_is_partitioned;

  if v_is_partitioned then
    return;
  end if;

  lock table public.orders in access exclusive mode;

  select relrowsecurity, relforcerowsecurity
    into v_has_rls, v_force_rls
  from pg_class
  where oid = 'public.orders'::regclass;

  execute format('alter table public.orders rename to %I', v_backup);

  execute format(
    'create table public.orders (like public.%I including defaults including generated including identity including storage including comments) partition by range (date)',
    v_backup
  );

  -- Recreate CHECK/FK constraints from backup table
  for r in
    select conname, contype, pg_get_constraintdef(oid, true) as condef
    from pg_constraint
    where conrelid = format('public.%I', v_backup)::regclass
      and contype in ('c', 'f')
  loop
    execute format('alter table public.orders add constraint %I %s', r.conname, r.condef);
  end loop;

  -- Copy RLS config + policies
  if v_has_rls then
    execute 'alter table public.orders enable row level security';
  end if;
  if v_force_rls then
    execute 'alter table public.orders force row level security';
  end if;

  for r in
    select policyname, permissive, roles, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename = v_backup
  loop
    select coalesce(string_agg(case when lower(x) = 'public' then 'public' else quote_ident(x) end, ', '), 'public')
      into v_roles_sql
    from unnest(r.roles) as x;

    v_using_sql := case
      when r.qual is null then ''
      else format(' using (%s)', r.qual)
    end;

    v_check_sql := case
      when r.with_check is null then ''
      else format(' with check (%s)', r.with_check)
    end;

    execute format(
      'create policy %I on public.orders as %s for %s to %s%s%s',
      r.policyname,
      case when upper(r.permissive) = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      lower(r.cmd),
      v_roles_sql,
      v_using_sql,
      v_check_sql
    );
  end loop;

  -- Copy grants from backup table
  for r in
    select distinct grantee, privilege_type, is_grantable
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = v_backup
  loop
    if lower(r.grantee) = 'public' then
      execute format(
        'grant %s on table public.orders to public%s',
        r.privilege_type,
        case when r.is_grantable = 'YES' then ' with grant option' else '' end
      );
    else
      execute format(
        'grant %s on table public.orders to %I%s',
        r.privilege_type,
        r.grantee,
        case when r.is_grantable = 'YES' then ' with grant option' else '' end
      );
    end if;
  end loop;

  -- Determine required partition range (existing data + current month + next 2 months)
  execute format('select min(date), max(date) from public.%I', v_backup) into v_first, v_last;

  v_month := date_trunc('month', coalesce(v_first, current_date))::date;
  v_until := date_trunc(
    'month',
    greatest(
      coalesce(v_last, current_date),
      (current_date + interval '2 month')::date
    )
  )::date;

  while v_month <= v_until loop
    perform public.lp_ensure_orders_partition(v_month);
    v_month := (v_month + interval '1 month')::date;
  end loop;

  -- Build column list for migration insert (exclude generated columns)
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
    into v_cols_no_generated
  from information_schema.columns
  where table_schema = 'public'
    and table_name = v_backup
    and is_generated = 'NEVER';

  if v_cols_no_generated is null or btrim(v_cols_no_generated) = '' then
    raise exception 'could not resolve column list for %', v_backup;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = v_backup
      and column_name = 'slot'
  ) into v_has_slot;

  -- Deduplicated copy during migration (idempotency-safe)
  if v_has_slot then
    execute format($sql$
      insert into public.orders (%1$s)
      select %1$s
      from (
        select %1$s,
               row_number() over (
                 partition by user_id, date, coalesce(slot, '')
                 order by coalesce(updated_at, created_at, now()) desc, id desc
               ) as lp_rn
        from public.%2$I
      ) s
      where s.lp_rn = 1
    $sql$, v_cols_no_generated, v_backup);
  else
    execute format($sql$
      insert into public.orders (%1$s)
      select %1$s
      from (
        select %1$s,
               row_number() over (
                 partition by user_id, date
                 order by coalesce(updated_at, created_at, now()) desc, id desc
               ) as lp_rn
        from public.%2$I
      ) s
      where s.lp_rn = 1
    $sql$, v_cols_no_generated, v_backup);
  end if;

  -- Recreate known order outbox trigger if function exists
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'lp_orders_outbox_trigger'
  ) then
    execute 'drop trigger if exists orders_outbox on public.orders';
    execute 'create trigger orders_outbox after insert or update of status, note, slot, date on public.orders for each row execute function public.lp_orders_outbox_trigger()';
  end if;

  -- Keep fast deterministic lookup key on (id, date)
  execute 'create unique index if not exists orders_id_date_uq on public.orders (id, date)';
end
$$;

-- Ensure partitions for current month + next 2 months always exist
DO $$
declare
  v_base date := date_trunc('month', current_date)::date;
  v_i int;
begin
  for v_i in 0..2 loop
    perform public.lp_ensure_orders_partition((v_base + (v_i || ' month')::interval)::date);
  end loop;
end
$$;

-- =========================================================
-- 1.2) Idempotency unique key + required indexes on orders
-- =========================================================
do $$
declare
  v_has_slot boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'slot'
  ) into v_has_slot;

  if v_has_slot then
    create unique index if not exists orders_user_date_slot_uq
      on public.orders (user_id, date, slot);
  else
    create unique index if not exists orders_user_date_uq
      on public.orders (user_id, date);
  end if;
end
$$;

create index if not exists orders_date_company_location_idx
  on public.orders (date, company_id, location_id);

create index if not exists orders_company_date_idx
  on public.orders (company_id, date);

create index if not exists orders_user_date_idx
  on public.orders (user_id, date);

create index if not exists orders_date_status_idx
  on public.orders (date, status);

-- =========================================================
-- 2) Rollup tables
-- =========================================================
create table if not exists public.daily_company_rollup (
  date date not null,
  company_id uuid not null,
  location_id uuid null,
  slot text null,
  location_key uuid generated always as (coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
  slot_key text generated always as (coalesce(slot, '')) stored,
  ordered_count int not null default 0,
  canceled_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.daily_company_rollup
  add column if not exists location_key uuid generated always as (coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
  add column if not exists slot_key text generated always as (coalesce(slot, '')) stored,
  add column if not exists ordered_count int not null default 0,
  add column if not exists canceled_count int not null default 0,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_company_rollup_unique'
      and conrelid = 'public.daily_company_rollup'::regclass
  ) then
    alter table public.daily_company_rollup
      add constraint daily_company_rollup_unique
      unique (date, company_id, location_key, slot_key);
  end if;
end
$$;

create index if not exists daily_company_rollup_date_company_idx
  on public.daily_company_rollup (date, company_id);

create index if not exists daily_company_rollup_company_month_idx
  on public.daily_company_rollup (company_id, date);

create table if not exists public.daily_employee_orders (
  date date not null,
  company_id uuid not null,
  location_id uuid null,
  slot text null,
  slot_key text generated always as (coalesce(slot, '')) stored,
  user_id uuid not null,
  status text not null,
  note text null,
  updated_at timestamptz not null default now()
);

alter table public.daily_employee_orders
  add column if not exists slot_key text generated always as (coalesce(slot, '')) stored,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_employee_orders_unique'
      and conrelid = 'public.daily_employee_orders'::regclass
  ) then
    alter table public.daily_employee_orders
      add constraint daily_employee_orders_unique
      unique (date, user_id, slot_key);
  end if;
end
$$;

create index if not exists daily_employee_orders_date_company_location_idx
  on public.daily_employee_orders (date, company_id, location_id);

create index if not exists daily_employee_orders_company_date_idx
  on public.daily_employee_orders (company_id, date);

-- =========================================================
-- 3) Invoice / export / ESG aggregate tables
-- =========================================================
create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  company_id uuid not null,
  month date not null,
  quantity int not null,
  unit_price numeric(14, 4) not null,
  amount numeric(16, 4) not null,
  currency text not null default 'NOK',
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoice_lines_reference_uniq unique (reference),
  constraint invoice_lines_month_start_ck check (month = date_trunc('month', month)::date),
  constraint invoice_lines_quantity_ck check (quantity >= 0),
  constraint invoice_lines_unit_price_ck check (unit_price >= 0),
  constraint invoice_lines_amount_ck check (amount >= 0)
);

create index if not exists invoice_lines_company_month_idx
  on public.invoice_lines (company_id, month);

create index if not exists invoice_lines_status_idx
  on public.invoice_lines (status);

create table if not exists public.invoice_exports (
  reference text not null,
  provider text not null,
  external_id text not null,
  exported_at timestamptz not null default now(),
  payload jsonb null,
  constraint invoice_exports_reference_uniq unique (reference),
  constraint invoice_exports_provider_ck check (provider in ('tripletex'))
);

create index if not exists invoice_exports_provider_exported_at_idx
  on public.invoice_exports (provider, exported_at desc);

create table if not exists public.esg_monthly (
  company_id uuid not null,
  month date not null,
  delivered_meals int not null default 0,
  canceled_meals int not null default 0,
  delivery_rate numeric(10, 6) not null default 0,
  waste_estimate_kg numeric(16, 6) not null default 0,
  co2_estimate_kg numeric(16, 6) not null default 0,
  updated_at timestamptz not null default now(),
  constraint esg_monthly_pk primary key (company_id, month),
  constraint esg_monthly_month_start_ck check (month = date_trunc('month', month)::date),
  constraint esg_monthly_counts_ck check (delivered_meals >= 0 and canceled_meals >= 0),
  constraint esg_monthly_rate_ck check (delivery_rate >= 0 and delivery_rate <= 1)
);

create index if not exists esg_monthly_month_idx
  on public.esg_monthly (month);

-- =========================================================
-- 4) Rollup rebuild function (idempotent per date)
-- =========================================================
drop function if exists public.lp_rollup_rebuild_for_date(date);

create or replace function public.lp_rollup_rebuild_for_date(p_date date)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_date is null then
    raise exception using errcode = 'P0001', message = 'DATE_REQUIRED';
  end if;

  delete from public.daily_company_rollup where date = p_date;

  insert into public.daily_company_rollup (
    date,
    company_id,
    location_id,
    slot,
    ordered_count,
    canceled_count,
    updated_at
  )
  select
    p_date as date,
    o.company_id,
    o.location_id,
    o.slot,
    sum(case when upper(o.status::text) in ('ACTIVE', 'ORDERED') then 1 else 0 end)::int as ordered_count,
    sum(case when upper(o.status::text) in ('CANCELLED', 'CANCELED') then 1 else 0 end)::int as canceled_count,
    now()
  from public.orders o
  where o.date = p_date
  group by o.company_id, o.location_id, o.slot;

  delete from public.daily_employee_orders where date = p_date;

  insert into public.daily_employee_orders (
    date,
    company_id,
    location_id,
    slot,
    user_id,
    status,
    note,
    updated_at
  )
  select
    p_date as date,
    o.company_id,
    o.location_id,
    o.slot,
    o.user_id,
    case
      when upper(o.status::text) in ('ACTIVE', 'ORDERED') then 'ORDERED'
      when upper(o.status::text) in ('CANCELLED', 'CANCELED') then 'CANCELED'
      else upper(o.status::text)
    end as status,
    o.note,
    now()
  from public.orders o
  where o.date = p_date;
end;
$$;

revoke all on function public.lp_rollup_rebuild_for_date(date) from public;
revoke all on function public.lp_rollup_rebuild_for_date(date) from anon;
grant execute on function public.lp_rollup_rebuild_for_date(date) to service_role;
grant execute on function public.lp_rollup_rebuild_for_date(date) to postgres;

-- =========================================================
-- 5) lp_order_set v2
--    Input: p_date, p_action('ORDER'|'CANCEL'), p_note, p_slot
--    Output JSON: { order_id, status, company_id, location_id, date, slot, receipt, rid }
-- =========================================================
drop function if exists public.lp_order_set(date, text, text, text);
drop function if exists public.lp_order_set(date, text, text);
drop function if exists public.lp_order_set(date, text);

create or replace function public.lp_order_set(
  p_date date,
  p_action text,
  p_note text default null,
  p_slot text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_agreement public.agreements%rowtype;

  v_action text := upper(trim(coalesce(p_action, '')));
  v_slot text := coalesce(nullif(trim(coalesce(p_slot, '')), ''), 'lunch');
  v_note text := nullif(trim(coalesce(p_note, '')), '');

  v_oslo_now timestamptz := timezone('Europe/Oslo', now());
  v_oslo_today date := (timezone('Europe/Oslo', now()))::date;
  v_oslo_time time := (timezone('Europe/Oslo', now()))::time;

  v_isodow int;
  v_day_key text;
  v_db_status text;

  v_order_id uuid;
  v_saved_status text;
  v_receipt timestamptz := clock_timestamp();
  v_rid text := format('rid_%s', replace(gen_random_uuid()::text, '-', ''));

  v_status_out text;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  if p_date is null then
    raise exception using errcode = 'P0001', message = 'DATE_REQUIRED';
  end if;

  if v_action not in ('ORDER', 'CANCEL') then
    raise exception using errcode = 'P0001', message = 'ACTION_INVALID';
  end if;

  select p.*
    into v_profile
  from public.profiles p
  where p.user_id = v_uid
  order by p.updated_at desc
  limit 1;

  if not found or v_profile.company_id is null or v_profile.location_id is null then
    raise exception using errcode = 'P0001', message = 'PROFILE_MISSING';
  end if;

  -- Cutoff 08:00 Europe/Oslo (today and past are blocked)
  if p_date < v_oslo_today then
    raise exception using errcode = 'P0001', message = 'CUTOFF_PASSED';
  end if;

  if p_date = v_oslo_today and v_oslo_time >= time '08:00' then
    raise exception using errcode = 'P0001', message = 'CUTOFF_PASSED';
  end if;

  -- ACTIVE agreement gate on company+location
  select a.*
    into v_agreement
  from public.agreements a
  where a.company_id = v_profile.company_id
    and a.location_id = v_profile.location_id
    and upper(a.status::text) = 'ACTIVE'
  order by coalesce(a.starts_at, '-infinity'::timestamptz) desc, a.updated_at desc
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'NO_ACTIVE_AGREEMENT';
  end if;

  if v_agreement.starts_at is not null and p_date < v_agreement.starts_at::date then
    raise exception using errcode = 'P0001', message = 'NO_ACTIVE_AGREEMENT';
  end if;

  v_isodow := extract(isodow from p_date)::int;
  v_day_key := case v_isodow
    when 1 then 'mon'
    when 2 then 'tue'
    when 3 then 'wed'
    when 4 then 'thu'
    when 5 then 'fri'
    else null
  end;

  if v_day_key is null then
    raise exception using errcode = 'P0001', message = 'OUTSIDE_DELIVERY_DAYS';
  end if;

  if not (
    (
      jsonb_typeof(v_agreement.delivery_days) = 'array'
      and exists (
        select 1
        from jsonb_array_elements(v_agreement.delivery_days) as d(v)
        where (
          jsonb_typeof(d.v) = 'string'
          and lower(trim(both '"' from d.v::text)) in (v_day_key, v_isodow::text)
        )
        or (
          jsonb_typeof(d.v) = 'number'
          and regexp_replace(d.v::text, '\\s', '', 'g') = v_isodow::text
        )
      )
    )
    or
    (
      jsonb_typeof(v_agreement.delivery_days) = 'object'
      and (
        v_agreement.delivery_days ? v_day_key
        or v_agreement.delivery_days ? v_isodow::text
      )
    )
    or
    (
      jsonb_typeof(v_agreement.delivery_days) = 'string'
      and exists (
        select 1
        from regexp_split_to_table(
          lower(trim(both '"' from v_agreement.delivery_days::text)),
          '[,\\s]+'
        ) as token(v)
        where token.v in (v_day_key, v_isodow::text)
      )
    )
  ) then
    raise exception using errcode = 'P0001', message = 'OUTSIDE_DELIVERY_DAYS';
  end if;

  v_db_status := case
    when v_action = 'ORDER' then 'ACTIVE'
    else 'CANCELLED'
  end;

  insert into public.orders (
    user_id,
    company_id,
    location_id,
    date,
    slot,
    status,
    note,
    updated_at
  )
  values (
    v_uid,
    v_profile.company_id,
    v_profile.location_id,
    p_date,
    v_slot,
    v_db_status::public.order_status,
    case when v_action = 'ORDER' then v_note else null end,
    now()
  )
  on conflict (user_id, date, slot)
  do update set
    company_id = excluded.company_id,
    location_id = excluded.location_id,
    status = excluded.status,
    note = excluded.note,
    updated_at = now()
  returning id, status::text into v_order_id, v_saved_status;

  insert into public.outbox (
    event_key,
    payload,
    status,
    attempts,
    last_error,
    locked_at,
    locked_by,
    next_retry_at,
    delivered_at,
    updated_at
  )
  values (
    format('order.set:%s:%s:%s', v_uid::text, p_date::text, coalesce(v_slot, '')),
    jsonb_build_object(
      'event', 'order.set',
      'action', v_action,
      'order_id', v_order_id,
      'company_id', v_profile.company_id,
      'location_id', v_profile.location_id,
      'user_id', v_uid,
      'date', p_date,
      'slot', v_slot,
      'status', v_saved_status,
      'receipt', v_receipt,
      'rid', v_rid
    ),
    'PENDING',
    0,
    null,
    null,
    null,
    null,
    null,
    now()
  )
  on conflict (event_key) do update
    set payload = excluded.payload,
        status = 'PENDING',
        attempts = 0,
        last_error = null,
        locked_at = null,
        locked_by = null,
        next_retry_at = null,
        delivered_at = null,
        updated_at = now();

  insert into public.outbox (
    event_key,
    payload,
    status,
    attempts,
    last_error,
    locked_at,
    locked_by,
    next_retry_at,
    delivered_at,
    updated_at
  )
  values (
    format('rollup.rebuild:%s', p_date::text),
    jsonb_build_object(
      'event', 'rollup.rebuild',
      'date', p_date,
      'company_id', v_profile.company_id,
      'rid', v_rid
    ),
    'PENDING',
    0,
    null,
    null,
    null,
    null,
    null,
    now()
  )
  on conflict (event_key) do update
    set payload = excluded.payload,
        status = 'PENDING',
        attempts = 0,
        last_error = null,
        locked_at = null,
        locked_by = null,
        next_retry_at = null,
        delivered_at = null,
        updated_at = now();

  v_status_out := case
    when upper(v_saved_status) in ('ACTIVE', 'ORDERED') then 'ORDERED'
    else 'CANCELED'
  end;

  return jsonb_build_object(
    'order_id', v_order_id,
    'status', v_status_out,
    'company_id', v_profile.company_id,
    'location_id', v_profile.location_id,
    'date', p_date,
    'slot', v_slot,
    'receipt', v_receipt,
    'rid', v_rid
  );
end;
$$;

revoke all on function public.lp_order_set(date, text, text, text) from public;
revoke all on function public.lp_order_set(date, text, text, text) from anon;
grant execute on function public.lp_order_set(date, text, text, text) to authenticated;
grant execute on function public.lp_order_set(date, text, text, text) to service_role;
grant execute on function public.lp_order_set(date, text, text, text) to postgres;

commit;


