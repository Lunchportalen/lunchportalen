-- Minste tilgang: ingen bred SELECT for authenticated på operative sperredatoer.
-- Lesing skjer via service_role (server-only), med scope-filter i applikasjon.
begin;

drop policy if exists closed_dates_select_authenticated on public.closed_dates;

revoke select on public.closed_dates from authenticated;

commit;
