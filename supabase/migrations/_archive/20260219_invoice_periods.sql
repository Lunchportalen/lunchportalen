-- supabase/migrations/20260219_invoice_periods.sql
-- Enterprise invoice periods (fresh-DB safe, no hard dependency on invoice_lines)

begin;

create extension if not exists pgcrypto;

create table if not exists public.invoice_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on update cascade on delete cascade,
  period text not null,
  count_basis int not null default 0,
  count_luxus int not null default 0,
  total numeric(16,4) not null,
  unique_ref text not null,
  generated_at timestamptz not null default now(),
  tripletex_invoice_id text null,
  status text not null default 'PENDING',
  constraint invoice_periods_period_ck check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint invoice_periods_count_basis_ck check (count_basis >= 0),
  constraint invoice_periods_count_luxus_ck check (count_luxus >= 0),
  constraint invoice_periods_status_ck check (status in ('PENDING', 'SENT', 'FAILED', 'FAILED_PERMANENT')),
  constraint invoice_periods_company_period_uniq unique (company_id, period),
  constraint invoice_periods_unique_ref_uniq unique (unique_ref)
);

create index if not exists invoice_periods_period_idx
  on public.invoice_periods (period);

create index if not exists invoice_periods_status_idx
  on public.invoice_periods (status);

create index if not exists invoice_periods_generated_at_idx
  on public.invoice_periods (generated_at desc);

-- Optional best-effort migration from legacy invoice_lines.
-- This block never fails migration on fresh/unknown schema.
do $$
declare
  v_has_invoice_lines boolean := false;
  v_has_required_cols boolean := false;
  v_missing text[];
begin
  v_has_invoice_lines := to_regclass('public.invoice_lines') is not null;

  if not v_has_invoice_lines then
    raise notice 'invoice_lines does not exist, skipping invoice_periods backfill';
    return;
  end if;

  select array_agg(c) into v_missing
  from (
    select c
    from unnest(array[
      'company_id',
      'month',
      'product_tier',
      'quantity',
      'amount'
    ]) as c
    where not exists (
      select 1
      from information_schema.columns ic
      where ic.table_schema = 'public'
        and ic.table_name = 'invoice_lines'
        and ic.column_name = c
    )
  ) q;

  v_has_required_cols := coalesce(array_length(v_missing, 1), 0) = 0;

  if not v_has_required_cols then
    raise notice 'invoice_lines missing required columns for backfill, skipping: %', v_missing;
    return;
  end if;

  begin
    insert into public.invoice_periods (
      company_id,
      period,
      count_basis,
      count_luxus,
      total,
      unique_ref,
      generated_at,
      status
    )
    select
      il.company_id,
      to_char((il.month)::date, 'YYYY-MM') as period,
      sum(case when upper(coalesce(il.product_tier::text, '')) = 'BASIS' then greatest(coalesce(il.quantity, 0), 0) else 0 end)::int as count_basis,
      sum(case when upper(coalesce(il.product_tier::text, '')) = 'LUXUS' then greatest(coalesce(il.quantity, 0), 0) else 0 end)::int as count_luxus,
      round(sum(coalesce(il.amount, 0)::numeric), 4) as total,
      format('%s:%s', il.company_id::text, to_char((il.month)::date, 'YYYY-MM')) as unique_ref,
      now() as generated_at,
      'PENDING'::text as status
    from public.invoice_lines il
    where il.company_id is not null
      and il.month is not null
    group by il.company_id, to_char((il.month)::date, 'YYYY-MM')
    on conflict (company_id, period) do nothing;
  exception
    when others then
      raise notice 'invoice_periods best-effort backfill skipped due to incompatible invoice_lines data/schema: %', sqlerrm;
  end;
end
$$;

commit;
