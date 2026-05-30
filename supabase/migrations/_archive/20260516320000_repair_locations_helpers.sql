-- Repair: private.can_access_location og private.can_manage_location
-- refererte til public.locations som ble droppet i
-- 20260515120000_consolidate_locations_to_company_locations.sql.
-- Funksjonene krasjet med 42P01 i prod (verifisert 2026-05-17
-- i FASE 13.5-FIX-1-DIAGNOSE). RLS-policies på delivery_runs,
-- location_closed_dates, location_policies, menu_service_days,
-- orders, standing_orders kaller disse direkte for authenticated.
--
-- Erstatter join til public.company_locations. Idempotent
-- (CREATE OR REPLACE FUNCTION). Ingen tilsiktet semantikk-endring.
--
-- Merk: Forespurt filnavn 20260516220000_* var allerede tatt av
-- 20260516220000_company_admin_aggregate_rpc.sql — derfor 20260516320000.

BEGIN;

create or replace function private.can_access_location(_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    (select private.has_platform_role(array[
      'platform_admin'::public.platform_role,
      'platform_ops'::public.platform_role,
      'kitchen'::public.platform_role,
      'courier'::public.platform_role,
      'finance_internal'::public.platform_role
    ]))
    or exists (
      select 1
      from public.company_memberships cm
      join public.company_locations l
        on l.company_id = cm.company_id
      where l.id = _location_id
        and cm.user_id = (select auth.uid())
        and coalesce(cm.status::text, '') = 'active'
        and (cm.location_id is null or cm.location_id = _location_id)
    );
$function$;

create or replace function private.can_manage_location(_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select
    (select private.has_platform_role(array[
      'platform_admin'::public.platform_role,
      'platform_ops'::public.platform_role
    ]))
    or exists (
      select 1
      from public.company_memberships cm
      join public.company_locations l
        on l.company_id = cm.company_id
      where l.id = _location_id
        and cm.user_id = (select auth.uid())
        and coalesce(cm.status::text, '') = 'active'
        and (select private.role_is_location_manager(cm.role::text))
        and (cm.location_id is null or cm.location_id = _location_id)
    );
$function$;

COMMIT;
