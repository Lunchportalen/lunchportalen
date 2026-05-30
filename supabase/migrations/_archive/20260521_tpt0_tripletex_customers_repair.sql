-- TPT-0 (R9) — Align public.tripletex_customers with kanonisk kode + 20260218_norwegian_standard_billing
--
-- Begrunnelse:
--   Live staging/prod ble baseline-rerollet fra prod schema dump (20260520) med
--   external_customer_id. Repo-kode (lib/integrations/tripletex/client.ts) og
--   20260218-migrasjon forventer tripletex_customer_id + billing profile columns.
--
-- Referanser:
--   TRIPLETEX-PLAN-V1 v3.1 (R9), Q7-discovery 2026-05-20, commit d9215d42
--
-- Idempotent: safe to re-run (information_schema guards).

begin;

-- ---------------------------------------------------------------------------
-- 1) external_customer_id → tripletex_customer_id
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tripletex_customers'
      and column_name = 'external_customer_id'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tripletex_customers'
      and column_name = 'tripletex_customer_id'
  ) then
    alter table public.tripletex_customers
      rename column external_customer_id to tripletex_customer_id;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tripletex_customers'
      and column_name = 'external_customer_id'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tripletex_customers'
      and column_name = 'tripletex_customer_id'
  ) then
    update public.tripletex_customers
       set tripletex_customer_id = external_customer_id
     where tripletex_customer_id is null
       and external_customer_id is not null;

    alter table public.tripletex_customers
      drop column external_customer_id;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2) Billing profile columns (20260218 §6)
-- ---------------------------------------------------------------------------
alter table public.tripletex_customers
  add column if not exists orgnr text,
  add column if not exists legal_name text,
  add column if not exists billing_email text,
  add column if not exists billing_address text,
  add column if not exists billing_postcode text,
  add column if not exists billing_city text,
  add column if not exists ehf_endpoint text;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tripletex_customers'
      and column_name = 'billing_country'
  ) then
    alter table public.tripletex_customers
      add column billing_country text not null default 'NO';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tripletex_customers'
      and column_name = 'ehf_enabled'
  ) then
    alter table public.tripletex_customers
      add column ehf_enabled boolean not null default false;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 3) Constraints / indexes (preserve baseline id PK if present)
-- ---------------------------------------------------------------------------
create unique index if not exists tripletex_customers_tripletex_customer_id_uniq
  on public.tripletex_customers (tripletex_customer_id);

create unique index if not exists tripletex_customers_company_id_key
  on public.tripletex_customers (company_id);

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
      foreign key (company_id) references public.companies (id)
      on update cascade
      on delete cascade;
  end if;
end
$$;

-- Drop legacy index name from baseline dump if it lingers on renamed column
drop index if exists public.tripletex_customers_external_customer_id_uq;

commit;
