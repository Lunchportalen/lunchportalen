-- TPT-B-7b-polish-5 — Repair companies billing profile columns (20260218 §3)
--
-- Prod + staging were baseline-rerolled from schema dump (B3a) without
-- 20260218_norwegian_standard_billing companies ALTER. Worker customer-sync
-- SELECTs legal_name, billing_address, … → PostgREST 42703.
--
-- Idempotent: IF NOT EXISTS + backfill only where null/empty.

begin;

alter table public.companies
  add column if not exists legal_name text,
  add column if not exists billing_address text,
  add column if not exists billing_postcode text,
  add column if not exists billing_city text,
  add column if not exists ehf_enabled boolean not null default false,
  add column if not exists ehf_endpoint text;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'billing_country'
  ) then
    alter table public.companies
      add column billing_country text not null default 'NO';
  end if;
end
$$;

-- billing_email may already exist from earlier schema; add only if missing
alter table public.companies
  add column if not exists billing_email text;

update public.companies
set legal_name = coalesce(nullif(btrim(legal_name), ''), nullif(btrim(name), ''))
where legal_name is null or btrim(legal_name) = '';

update public.companies
set billing_email = coalesce(nullif(btrim(billing_email::text), ''), nullif(btrim(contact_email), ''))
where billing_email is null or btrim(billing_email::text) = '';

update public.companies
set billing_address = coalesce(nullif(btrim(billing_address), ''), nullif(btrim(address), ''))
where billing_address is null or btrim(billing_address) = '';

update public.companies
set billing_country = coalesce(nullif(btrim(billing_country), ''), 'NO')
where billing_country is null or btrim(billing_country) = '';

commit;
