-- supabase/migrations/20260218_invoice_lines_generator_point7.sql
-- Task 7: invoice_lines hardening for deterministic monthly generator

begin;

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.companies') is null then
    raise exception 'required table missing: public.companies';
  end if;
  if to_regclass('public.agreements') is null then
    raise exception 'required table missing: public.agreements';
  end if;
  if to_regclass('public.invoice_lines') is null then
    create table public.invoice_lines (
      id uuid primary key default gen_random_uuid(),
      reference text not null,
      company_id uuid not null,
      month date not null,
      agreement_id uuid null,
      quantity int not null,
      unit_price numeric(14, 4) not null,
      amount numeric(16, 4) not null,
      currency text not null default 'NOK',
      status text not null default 'PENDING',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end
$$;

alter table public.invoice_lines
  add column if not exists agreement_id uuid,
  add column if not exists currency text not null default 'NOK',
  add column if not exists status text not null default 'PENDING',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.invoice_lines
  alter column reference set not null,
  alter column company_id set not null,
  alter column month set not null,
  alter column quantity set not null,
  alter column unit_price set not null,
  alter column amount set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoice_lines_month_start_ck'
      and conrelid = 'public.invoice_lines'::regclass
  ) then
    alter table public.invoice_lines
      add constraint invoice_lines_month_start_ck
      check (month = date_trunc('month', month)::date);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoice_lines_quantity_ck'
      and conrelid = 'public.invoice_lines'::regclass
  ) then
    alter table public.invoice_lines
      add constraint invoice_lines_quantity_ck
      check (quantity >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoice_lines_unit_price_ck'
      and conrelid = 'public.invoice_lines'::regclass
  ) then
    alter table public.invoice_lines
      add constraint invoice_lines_unit_price_ck
      check (unit_price >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoice_lines_amount_ck'
      and conrelid = 'public.invoice_lines'::regclass
  ) then
    alter table public.invoice_lines
      add constraint invoice_lines_amount_ck
      check (amount >= 0);
  end if;
end
$$;

create unique index if not exists invoice_lines_reference_uniq
  on public.invoice_lines (reference);

create index if not exists invoice_lines_company_month_idx
  on public.invoice_lines (company_id, month);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoice_lines_company_fk'
      and conrelid = 'public.invoice_lines'::regclass
  ) then
    alter table public.invoice_lines
      add constraint invoice_lines_company_fk
      foreign key (company_id) references public.companies (id)
      on update cascade
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'invoice_lines_agreement_fk'
      and conrelid = 'public.invoice_lines'::regclass
  ) then
    alter table public.invoice_lines
      add constraint invoice_lines_agreement_fk
      foreign key (agreement_id) references public.agreements (id)
      on update cascade
      on delete set null;
  end if;
end
$$;

commit;
