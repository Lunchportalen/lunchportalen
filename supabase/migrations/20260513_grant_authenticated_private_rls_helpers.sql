-- Gir authenticated EXECUTE på private RLS-helper-funksjoner.
--
-- KONTEKST:
-- Disse funksjonene brukes INNI RLS-policyer på public-tabeller som
-- companies, locations, orders, profiles og operative tenant-tabeller.
-- Når en authenticated bruker spør en slik tabell, kjører PostgreSQL
-- RLS-policyen, som kaller en av disse funksjonene.
--
-- Uten EXECUTE krasjer policyen med 42501 permission denied for function.
-- Dette resulterte i 503 Service Unavailable på /api/admin/people,
-- /api/admin/locations, /api/admin/orders, /api/admin/insights og
-- /api/order/window for company_admin-brukere som Inger.
--
-- SIKKERHET:
-- Grant av EXECUTE utvider IKKE brukerens rettigheter. Funksjonene
-- selv returnerer true/false basert på auth.uid() og firma-/lokasjon-
-- tilhørighet. Vi grant'er KUN boolean RLS-helpers; ingen DDL-
-- funksjoner eller funksjoner som endrer data på tvers av tenants.
--
-- Idempotent: kan kjøres flere ganger trygt.

-- Company access helpers
grant execute on function private.can_access_company(uuid) to authenticated;
grant execute on function private.can_manage_company(uuid) to authenticated;
grant execute on function private.can_finance_company(uuid) to authenticated;

-- Location access helpers
grant execute on function private.can_access_location(uuid) to authenticated;
grant execute on function private.can_manage_location(uuid) to authenticated;

-- Order access helpers
grant execute on function private.can_view_order(uuid) to authenticated;
grant execute on function private.can_edit_order(uuid) to authenticated;

-- Delivery/menu access helpers
grant execute on function private.can_access_delivery_run(uuid) to authenticated;
grant execute on function private.can_operate_delivery_run(uuid) to authenticated;
grant execute on function private.can_access_menu_day(uuid) to authenticated;
grant execute on function private.can_manage_menu_day(uuid) to authenticated;

-- Role checks
grant execute on function private.has_platform_role(public.platform_role[]) to authenticated;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.role_is_company_finance(text) to authenticated;
grant execute on function private.role_is_company_manager(text) to authenticated;
grant execute on function private.role_is_location_manager(text) to authenticated;
