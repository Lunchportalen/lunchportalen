-- supabase/migrations/20260221_step6_10_fasit_periods_esg.sql
-- RC fail-closed migration:
-- - Create/harden public.invoice_periods (period billing truth table)
-- - Create public.tripletex_exports (dedupe map)
-- - Create/validate public.esg_monthly with month text (YYYY-MM)

begin;

create extension if not exists pgcrypto;

create table if not exists public.invoice_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  period text not null,
  count_basis int not null default 0,
  count_luxus int not null default 0,
  unit_price_basis numeric(16,4) not null,
  unit_price_luxus numeric(16,4) not null,
  total numeric(16,4) not null,
  unique_ref text not null,
  status text not null default 'PENDING',
  tripletex_invoice_id text null,
  last_error text null,
  generated_at timestamptz not null default now(),
  constraint invoice_periods_period_ck check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint invoice_periods_count_basis_ck check (count_basis >= 0),
  constraint invoice_periods_count_luxus_ck check (count_luxus >= 0),
  constraint invoice_periods_unit_price_basis_ck check (unit_price_basis > 0),
  constraint invoice_periods_unit_price_luxus_ck check (unit_price_luxus > 0),
  constraint invoice_periods_total_ck check (total >= 0),
  constraint invoice_periods_status_ck check (status in ('PENDING', 'READY', 'SENT', 'FAILED', 'FAILED_PERMANENT')),
  constraint invoice_periods_unique_ref_match_ck check (unique_ref = company_id::text || ':' || period),
  constraint invoice_periods_company_period_uniq unique (company_id, period),
  constraint invoice_periods_unique_ref_uniq unique (unique_ref)
);

alter table public.invoice_periods
  add column if not exists company_id uuid references public.companies (id) on delete cascade,
  add column if not exists period text,
  add column if not exists count_basis int default 0,
  add column if not exists count_luxus int default 0,
  add column if not exists unit_price_basis numeric(16,4),
  add column if not exists unit_price_luxus numeric(16,4),
  add column if not exists total numeric(16,4),
  add column if not exists unique_ref text,
  add column if not exists status text default 'PENDING',
  add column if not exists tripletex_invoice_id text,
  add column if not exists last_error text,
  add column if not exists generated_at timestamptz default now();

alter table public.invoice_periods
  alter column count_basis set default 0,
  alter column count_luxus set default 0,
  alter column status set default 'PENDING',
  alter column generated_at set default now();

do $$
declare
  v_missing text[];
  v_invalid boolean;
begin
  select array_agg(x.col) into v_missing
  from (
    select req.col
    from (values
      ('id'),
      ('company_id'),
      ('period'),
      ('count_basis'),
      ('count_luxus'),
      ('unit_price_basis'),
      ('unit_price_luxus'),
      ('total'),
      ('unique_ref'),
      ('status'),
      ('tripletex_invoice_id'),
      ('last_error'),
      ('generated_at')
    ) as req(col)
    where not exists (
      select 1
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.table_name = 'invoice_periods'
        and c.column_name = req.col
    )
  ) x;

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'FAIL_CLOSED: public.invoice_periods missing required columns: %', v_missing;
  end if;

  select exists (select 1 from public.invoice_periods where company_id is null)
    into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.company_id contains NULL values';
  end if;

  select exists (select 1 from public.invoice_periods where period is null)
    into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.period contains NULL values';
  end if;

  select exists (
    select 1
    from public.invoice_periods
    where period !~ '^\d{4}-(0[1-9]|1[0-2])$'
  ) into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.period has invalid format (expected YYYY-MM)';
  end if;

  select exists (select 1 from public.invoice_periods where count_basis is null)
    into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.count_basis contains NULL values';
  end if;

  select exists (select 1 from public.invoice_periods where count_basis < 0)
    into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.count_basis contains negative values';
  end if;

  select exists (select 1 from public.invoice_periods where count_luxus is null)
    into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.count_luxus contains NULL values';
  end if;

  select exists (select 1 from public.invoice_periods where count_luxus < 0)
    into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.count_luxus contains negative values';
  end if;

  select exists (select 1 from public.invoice_periods where unit_price_basis is null)
    into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.unit_price_basis contains NULL values';
  end if;

  select exists (select 1 from public.invoice_periods where unit_price_basis <= 0)
    into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.unit_price_basis must be > 0';
  end if;

  select exists (select 1 from public.invoice_periods where unit_price_luxus is null)
    into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.unit_price_luxus contains NULL values';
  end if;

  select exists (select 1 from public.invoice_periods where unit_price_luxus <= 0)
    into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.unit_price_luxus must be > 0';
  end if;

  select exists (select 1 from public.invoice_periods where total is null)
    into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.total contains NULL values';
  end if;

  select exists (select 1 from public.invoice_periods where total < 0)
    into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.total contains negative values';
  end if;

  select exists (
    select 1
    from public.invoice_periods
    where unique_ref is null or btrim(unique_ref) = ''
  ) into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.unique_ref contains NULL or empty values';
  end if;

  select exists (
    select 1
    from public.invoice_periods
    where unique_ref <> company_id::text || ':' || period
  ) into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.unique_ref must equal company_id:period';
  end if;

  select exists (select 1 from public.invoice_periods where status is null)
    into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.status contains NULL values';
  end if;

  select exists (
    select 1
    from public.invoice_periods
    where status not in ('PENDING', 'READY', 'SENT', 'FAILED', 'FAILED_PERMANENT')
  ) into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.status has values outside allowlist';
  end if;

  select exists (select 1 from public.invoice_periods where generated_at is null)
    into v_invalid;
  if v_invalid then
    raise exception 'FAIL_CLOSED: public.invoice_periods.generated_at contains NULL values';
  end if;

  alter table public.invoice_periods
    alter column company_id set not null,
    alter column period set not null,
    alter column count_basis set not null,
    alter column count_luxus set not null,
    alter column unit_price_basis set not null,
    alter column unit_price_luxus set not null,
    alter column total set not null,
    alter column unique_ref set not null,
    alter column status set not null,
    alter column generated_at set not null;

  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_periods_period_ck'
      and conrelid = 'public.invoice_periods'::regclass
  ) then
    alter table public.invoice_periods
      add constraint invoice_periods_period_ck
      check (period ~ '^\d{4}-(0[1-9]|1[0-2])$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_periods_count_basis_ck'
      and conrelid = 'public.invoice_periods'::regclass
  ) then
    alter table public.invoice_periods
      add constraint invoice_periods_count_basis_ck
      check (count_basis >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_periods_count_luxus_ck'
      and conrelid = 'public.invoice_periods'::regclass
  ) then
    alter table public.invoice_periods
      add constraint invoice_periods_count_luxus_ck
      check (count_luxus >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_periods_unit_price_basis_ck'
      and conrelid = 'public.invoice_periods'::regclass
  ) then
    alter table public.invoice_periods
      add constraint invoice_periods_unit_price_basis_ck
      check (unit_price_basis > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_periods_unit_price_luxus_ck'
      and conrelid = 'public.invoice_periods'::regclass
  ) then
    alter table public.invoice_periods
      add constraint invoice_periods_unit_price_luxus_ck
      check (unit_price_luxus > 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_periods_total_ck'
      and conrelid = 'public.invoice_periods'::regclass
  ) then
    alter table public.invoice_periods
      add constraint invoice_periods_total_ck
      check (total >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_periods_status_ck'
      and conrelid = 'public.invoice_periods'::regclass
  ) then
    alter table public.invoice_periods
      add constraint invoice_periods_status_ck
      check (status in ('PENDING', 'READY', 'SENT', 'FAILED', 'FAILED_PERMANENT'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'invoice_periods_unique_ref_match_ck'
      and conrelid = 'public.invoice_periods'::regclass
  ) then
    alter table public.invoice_periods
      add constraint invoice_periods_unique_ref_match_ck
      check (unique_ref = company_id::text || ':' || period);
  end if;
end
$$;

create unique index if not exists invoice_periods_company_period_uniq
  on public.invoice_periods (company_id, period);

create unique index if not exists invoice_periods_unique_ref_uniq
  on public.invoice_periods (unique_ref);

create index if not exists invoice_periods_period_idx
  on public.invoice_periods (period);

create index if not exists invoice_periods_status_idx
  on public.invoice_periods (status);

create table if not exists public.tripletex_exports (
  unique_ref text primary key,
  tripletex_invoice_id text not null,
  created_at timestamptz not null default now()
);

do $$
declare
  v_exists boolean := to_regclass('public.esg_monthly') is not null;
  v_month_type text;
begin
  if not v_exists then
    create table public.esg_monthly (
      id uuid primary key default gen_random_uuid(),
      company_id uuid not null references public.companies (id) on delete cascade,
      month text not null,
      delivered_count int not null default 0,
      cancelled_count int not null default 0,
      delivery_rate numeric(6,3) not null default 0,
      waste_estimate_kg numeric(16,4) not null default 0,
      co2_estimate_kg numeric(16,4) not null default 0,
      generated_at timestamptz not null default now(),
      constraint esg_monthly_month_ck check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
      constraint esg_monthly_delivered_count_ck check (delivered_count >= 0),
      constraint esg_monthly_cancelled_count_ck check (cancelled_count >= 0),
      constraint esg_monthly_delivery_rate_ck check (delivery_rate >= 0 and delivery_rate <= 1),
      constraint esg_monthly_waste_ck check (waste_estimate_kg >= 0),
      constraint esg_monthly_co2_ck check (co2_estimate_kg >= 0),
      constraint esg_monthly_company_month_uniq unique (company_id, month)
    );
  else
    select c.data_type
      into v_month_type
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'esg_monthly'
      and c.column_name = 'month';

    if coalesce(v_month_type, '') not in ('text', 'character varying') then
      raise exception 'FAIL_CLOSED: public.esg_monthly.month must be text (YYYY-MM), found type=%', coalesce(v_month_type, '<missing>');
    end if;
  end if;
end
$$;

create unique index if not exists esg_monthly_company_month_uniq
  on public.esg_monthly (company_id, month);

create index if not exists esg_monthly_month_idx
  on public.esg_monthly (month);

commit;
