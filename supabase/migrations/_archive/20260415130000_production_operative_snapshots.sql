-- Canonical frozen operative order-id set per company per delivery date (materialisert fra samme filter som kjøkken/driver).
-- orders forblir sannhetskilde; denne tabellen er kun låst produksjonsgrunnlag for lesing etter materialisering.

create table if not exists public.production_operative_snapshots (
  id uuid primary key default gen_random_uuid(),
  delivery_date date not null,
  company_id uuid not null references public.companies (id) on delete cascade,
  order_ids uuid[] not null default '{}',
  frozen_at timestamptz not null default now(),
  constraint production_operative_snapshots_delivery_company_key unique (delivery_date, company_id)
);

create index if not exists production_operative_snapshots_delivery_date_idx
  on public.production_operative_snapshots (delivery_date);

alter table public.production_operative_snapshots enable row level security;

revoke all on public.production_operative_snapshots from public;
revoke all on public.production_operative_snapshots from anon;
revoke all on public.production_operative_snapshots from authenticated;
grant select, insert, update, delete on public.production_operative_snapshots to service_role;

comment on table public.production_operative_snapshots is
  'Låst sett operative ordre-id (canonical operative modell) per firma og leveringsdato. Leses av kjøkken/sjåfør når rad finnes.';
