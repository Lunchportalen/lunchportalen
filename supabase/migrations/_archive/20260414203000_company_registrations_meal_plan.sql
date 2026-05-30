-- Canonical operative registration: BASIS/Luxus per ukedag + leveringsvindu + binding/oppsigelse.
-- Superadmin avtaleutkast leser disse feltene (ikke antatte standarder).

begin;

alter table if exists public.company_registrations
  add column if not exists weekday_meal_tiers jsonb null;

alter table if exists public.company_registrations
  add column if not exists delivery_window_from text null;

alter table if exists public.company_registrations
  add column if not exists delivery_window_to text null;

alter table if exists public.company_registrations
  add column if not exists terms_binding_months integer null;

alter table if exists public.company_registrations
  add column if not exists terms_notice_months integer null;

commit;
