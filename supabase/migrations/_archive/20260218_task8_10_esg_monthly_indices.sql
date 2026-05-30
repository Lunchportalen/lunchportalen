-- supabase/migrations/20260218_task8_10_esg_monthly_indices.sql
-- Task 8-10 minimal DB additions:
-- - esg_monthly aggregate table
-- - safe performance indexes (no outbox redesign, no rollup redefine)

begin;

create table if not exists public.esg_monthly (
  company_id uuid not null references public.companies (id) on update cascade on delete cascade,
  month date not null,
  delivered_meals integer not null default 0,
  canceled_meals integer not null default 0,
  delivery_rate numeric(8, 6) not null default 0,
  waste_estimate_kg numeric(14, 4) not null default 0,
  co2_estimate_kg numeric(14, 4) not null default 0,
  updated_at timestamptz not null default now(),
  constraint esg_monthly_month_start_ck check (month = date_trunc('month', month)::date),
  constraint esg_monthly_delivered_meals_ck check (delivered_meals >= 0),
  constraint esg_monthly_canceled_meals_ck check (canceled_meals >= 0),
  constraint esg_monthly_delivery_rate_ck check (delivery_rate >= 0 and delivery_rate <= 1),
  constraint esg_monthly_waste_estimate_ck check (waste_estimate_kg >= 0),
  constraint esg_monthly_co2_estimate_ck check (co2_estimate_kg >= 0)
);

create unique index if not exists esg_monthly_company_month_uniq
  on public.esg_monthly (company_id, month);

create index if not exists esg_monthly_month_idx
  on public.esg_monthly (month);

create index if not exists esg_monthly_company_month_idx
  on public.esg_monthly (company_id, month);

do $$
begin
  if to_regclass('public.outbox') is not null then
    execute 'create index if not exists outbox_status_attempts_idx on public.outbox (status, attempts)';
    execute 'create index if not exists outbox_locked_at_idx on public.outbox (locked_at)';
  end if;

  if to_regclass('public.companies') is not null then
    execute 'create index if not exists companies_orgnr_idx on public.companies (orgnr)';
  end if;

  if to_regclass('public.invoice_lines') is not null then
    execute 'create index if not exists invoice_lines_export_status_idx on public.invoice_lines (export_status)';
    execute 'create index if not exists invoice_lines_month_company_idx on public.invoice_lines (month, company_id)';
  end if;
end
$$;

commit;
