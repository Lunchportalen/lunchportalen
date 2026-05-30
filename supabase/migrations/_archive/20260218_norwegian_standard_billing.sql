-- supabase/migrations/20260218_norwegian_standard_billing.sql
-- Minimal scope hardening for Norwegian-standard billing.
-- Includes only:
-- - billing_tax_codes
-- - billing_products
-- - companies billing fields
-- - invoice_lines export fields
-- - invoice_exports (reference dedupe)
-- - tripletex_customers
-- - preflight checks for outbox + daily_company_rollup (no redesign)

begin;

create extension if not exists pgcrypto;

-- =========================================================
-- 0) Preflight (fail-closed): required base tables/columns.
--    No outbox redesign. No daily_company_rollup redefine.
-- =========================================================
do $$
declare
  v_missing text[];
begin
  if to_regclass('public.companies') is null then
    raise exception 'required table missing: public.companies';
  end if;
  if to_regclass('public.outbox') is null then
    raise exception 'required table missing: public.outbox';
  end if;
  if to_regclass('public.orders') is null then
    raise exception 'required table missing: public.orders';
  end if;
  if to_regclass('public.daily_company_rollup') is null then
    raise exception 'required table missing: public.daily_company_rollup';
  end if;

  select array_agg(c) into v_missing
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

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'outbox missing required columns: %', v_missing;
  end if;

  select array_agg(c) into v_missing
  from (
    select c
    from unnest(array[
      'date',
      'company_id',
      'ordered_count',
      'canceled_count'
    ]) as c
    where not exists (
      select 1
      from information_schema.columns ic
      where ic.table_schema = 'public'
        and ic.table_name = 'daily_company_rollup'
        and ic.column_name = c
    )
  ) q;

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'daily_company_rollup missing required columns: %', v_missing;
  end if;
end
$$;

-- Add payload only if missing (no schema redesign).
do $$
begin
  if not exists (
    select 1
    from information_schema.columns ic
    where ic.table_schema = 'public'
      and ic.table_name = 'outbox'
      and ic.column_name = 'payload'
  ) then
    alter table public.outbox add column payload jsonb;
  end if;
end
$$;

-- =========================================================
-- 1) VAT catalog (Tripletex VAT code intentionally nullable)
-- =========================================================
create table if not exists public.billing_tax_codes (
  id text primary key,
  rate numeric(6, 4) not null check (rate >= 0 and rate <= 1),
  tripletex_vat_code text null,
  description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.billing_tax_codes (id, rate, tripletex_vat_code, description)
values
  ('MVA_0', 0.0000, null, 'Outgoing VAT 0%'),
  ('MVA_12', 0.1200, null, 'Outgoing VAT 12%'),
  ('MVA_15', 0.1500, null, 'Outgoing VAT 15%'),
  ('MVA_25', 0.2500, null, 'Outgoing VAT 25%')
on conflict (id) do update
set rate = excluded.rate,
    description = excluded.description,
    updated_at = now();

-- =========================================================
-- 2) Product/account mapping per tier
-- =========================================================
create table if not exists public.billing_products (
  tier text primary key check (tier in ('BASIS', 'LUXUS')),
  product_name text not null,
  tripletex_product_id text null,
  revenue_account text null,
  tax_code_id text not null references public.billing_tax_codes(id) on update cascade on delete restrict,
  unit text not null default 'stk',
  updated_at timestamptz not null default now()
);

insert into public.billing_products (tier, product_name, tripletex_product_id, revenue_account, tax_code_id, unit)
values
  ('BASIS', 'Firmalunsj BASIS', null, null, 'MVA_15', 'stk'),
  ('LUXUS', 'Firmalunsj LUXUS', null, null, 'MVA_15', 'stk')
on conflict (tier) do update
set product_name = excluded.product_name,
    tax_code_id = excluded.tax_code_id,
    unit = excluded.unit,
    updated_at = now();

do $$
begin
  if not exists (select 1 from public.billing_products where tier = 'BASIS') then
    raise exception 'billing_products missing BASIS seed';
  end if;
  if not exists (select 1 from public.billing_products where tier = 'LUXUS') then
    raise exception 'billing_products missing LUXUS seed';
  end if;
  if exists (select 1 from public.billing_products where tax_code_id is null) then
    raise exception 'billing_products has null tax_code_id';
  end if;
end
$$;

-- =========================================================
-- 3) Companies: billing profile fields
-- =========================================================
alter table public.companies
  add column if not exists legal_name text,
  add column if not exists billing_email text,
  add column if not exists billing_address text,
  add column if not exists billing_postcode text,
  add column if not exists billing_city text,
  add column if not exists billing_country text not null default 'NO',
  add column if not exists ehf_enabled boolean not null default false,
  add column if not exists ehf_endpoint text;

update public.companies
set legal_name = coalesce(nullif(legal_name, ''), nullif(name, ''))
where legal_name is null or legal_name = '';

update public.companies
set billing_email = coalesce(nullif(billing_email, ''), nullif(contact_email, ''))
where billing_email is null or billing_email = '';

update public.companies
set billing_address = coalesce(nullif(billing_address, ''), nullif(address, ''))
where billing_address is null or billing_address = '';

-- =========================================================
-- 4) Invoice lines: bookkeeping/export fields only
-- =========================================================
create table if not exists public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  company_id uuid not null,
  month date not null,
  quantity integer not null,
  unit_price numeric(14, 4) not null,
  amount numeric(16, 4) not null,
  currency text not null default 'NOK',
  status text not null default 'PENDING',
  tax_code_id text null,
  tripletex_vat_code text null,
  product_tier text null,
  product_name text null,
  revenue_account text null,
  unit text not null default 'stk',
  locked boolean not null default false,
  exported_at timestamptz null,
  export_status text not null default 'PENDING_EXPORT',
  export_last_error text null
);

alter table public.invoice_lines
  add column if not exists tax_code_id text,
  add column if not exists tripletex_vat_code text,
  add column if not exists product_tier text,
  add column if not exists product_name text,
  add column if not exists revenue_account text,
  add column if not exists unit text not null default 'stk',
  add column if not exists locked boolean not null default false,
  add column if not exists exported_at timestamptz,
  add column if not exists export_status text not null default 'PENDING_EXPORT',
  add column if not exists export_last_error text;

update public.invoice_lines
set export_status = 'PENDING_EXPORT'
where export_status is null;

update public.invoice_lines
set locked = false
where locked is null;

update public.invoice_lines
set unit = 'stk'
where unit is null or unit = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoice_lines_tax_code_fk'
      and conrelid = 'public.invoice_lines'::regclass
  ) then
    alter table public.invoice_lines
      add constraint invoice_lines_tax_code_fk
      foreign key (tax_code_id) references public.billing_tax_codes(id)
      on update cascade
      on delete restrict;
  end if;
end
$$;

-- =========================================================
-- 5) Invoice export log (strict dedupe on reference)
-- =========================================================
create table if not exists public.invoice_exports (
  reference text not null,
  provider text not null default 'tripletex',
  external_id text not null,
  payload jsonb null,
  exported_at timestamptz not null default now()
);

alter table public.invoice_exports
  add column if not exists provider text not null default 'tripletex',
  add column if not exists external_id text,
  add column if not exists payload jsonb,
  add column if not exists exported_at timestamptz not null default now();

update public.invoice_exports
set provider = 'tripletex'
where provider is null;

do $$
begin
  if exists (
    select 1
    from public.invoice_exports e
    group by e.reference
    having count(*) > 1
  ) then
    raise exception 'cannot enforce invoice_exports.reference unique: duplicates detected';
  end if;
end
$$;

create unique index if not exists invoice_exports_reference_uniq
  on public.invoice_exports (reference);

-- =========================================================
-- 6) Tripletex customer mapping
-- =========================================================
create table if not exists public.tripletex_customers (
  company_id uuid primary key,
  tripletex_customer_id text not null,
  orgnr text null,
  legal_name text null,
  billing_email text null,
  billing_address text null,
  billing_postcode text null,
  billing_city text null,
  billing_country text not null default 'NO',
  ehf_enabled boolean not null default false,
  ehf_endpoint text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tripletex_customers
  add column if not exists orgnr text,
  add column if not exists legal_name text,
  add column if not exists billing_email text,
  add column if not exists billing_address text,
  add column if not exists billing_postcode text,
  add column if not exists billing_city text,
  add column if not exists billing_country text not null default 'NO',
  add column if not exists ehf_enabled boolean not null default false,
  add column if not exists ehf_endpoint text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists tripletex_customers_tripletex_customer_id_uniq
  on public.tripletex_customers (tripletex_customer_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tripletex_customers_company_fk'
      and conrelid = 'public.tripletex_customers'::regclass
  ) then
    alter table public.tripletex_customers
      add constraint tripletex_customers_company_fk
      foreign key (company_id) references public.companies(id)
      on update cascade
      on delete cascade;
  end if;
end
$$;

commit;
