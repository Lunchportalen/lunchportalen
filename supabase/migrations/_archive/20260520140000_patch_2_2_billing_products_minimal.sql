-- ═══════════════════════════════════════════════════════════════════
-- PATCH 2.2 — Kirurgisk billing-slice for staging+prod apply
--
-- Henter ut seksjon 1+2 fra 20260218_norwegian_standard_billing.sql
-- (aldri registrert som applied i prod; full fil har for stort scope).
--
-- Audit-funn (PROVIDER-AUDIT v1): billing_products mangler i prod og staging.
-- Seksjon 3-6 fra 20260218 er IKKE inkludert (separate concerns).
--
-- ENTERPRISE-tier er IKKE i CHECK (fail-closed, Patch 2.1). Patch 15 utvider.
-- ═══════════════════════════════════════════════════════════════════

-- Seksjon 1: billing_tax_codes (fra 20260218, uendret)
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

-- Seksjon 2: billing_products (fra 20260218, uendret)
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
