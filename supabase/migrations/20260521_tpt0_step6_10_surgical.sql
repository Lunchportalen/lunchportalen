-- TPT-0 surgical apply: invoice_periods + tripletex_exports from 20260221_step6_10_fasit_periods_esg.sql
-- ESG block skipped: live esg_monthly uses month_start (date), not month text — full file would FAIL_CLOSED.

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
  if to_regclass('public.invoice_periods') is null then
    raise exception 'FAIL_CLOSED: public.invoice_periods missing';
  end if;

  select array_agg(x.col) into v_missing
  from (
    select req.col
    from (values
      ('id'), ('company_id'), ('period'), ('count_basis'), ('count_luxus'),
      ('unit_price_basis'), ('unit_price_luxus'), ('total'), ('unique_ref'),
      ('status'), ('tripletex_invoice_id'), ('last_error'), ('generated_at')
    ) as req(col)
    where not exists (
      select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'invoice_periods' and c.column_name = req.col
    )
  ) x;

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'FAIL_CLOSED: public.invoice_periods missing required columns: %', v_missing;
  end if;

  if exists (select 1 from public.invoice_periods limit 1) then
    select exists (select 1 from public.invoice_periods where company_id is null) into v_invalid;
    if v_invalid then raise exception 'FAIL_CLOSED: invoice_periods.company_id NULL'; end if;
    select exists (select 1 from public.invoice_periods where period is null) into v_invalid;
    if v_invalid then raise exception 'FAIL_CLOSED: invoice_periods.period NULL'; end if;
    select exists (select 1 from public.invoice_periods where unit_price_basis is null or unit_price_basis <= 0) into v_invalid;
    if v_invalid then raise exception 'FAIL_CLOSED: invoice_periods.unit_price_basis invalid'; end if;
    select exists (select 1 from public.invoice_periods where unit_price_luxus is null or unit_price_luxus <= 0) into v_invalid;
    if v_invalid then raise exception 'FAIL_CLOSED: invoice_periods.unit_price_luxus invalid'; end if;
  end if;
end
$$;

create unique index if not exists invoice_periods_company_period_uniq on public.invoice_periods (company_id, period);
create unique index if not exists invoice_periods_unique_ref_uniq on public.invoice_periods (unique_ref);
create index if not exists invoice_periods_period_idx on public.invoice_periods (period);
create index if not exists invoice_periods_status_idx on public.invoice_periods (status);

create table if not exists public.tripletex_exports (
  unique_ref text primary key,
  tripletex_invoice_id text not null,
  created_at timestamptz not null default now()
);

commit;
