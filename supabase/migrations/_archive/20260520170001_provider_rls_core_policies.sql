-- Patch 6 (Phase E.6) — Provider-scoped RLS on 7 core tables (PROVIDER-PLAN-V1 §7.2)
-- ADDITIV: parallel CREATE POLICY; existing company-scope policies unchanged.

-- 1. providers (extend Patch 4 baseline)
DROP POLICY IF EXISTS providers_select_member ON public.providers;
CREATE POLICY providers_select_member ON public.providers
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_access_provider(id));

DROP POLICY IF EXISTS providers_update_admin ON public.providers;
CREATE POLICY providers_update_admin ON public.providers
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.provider_id = providers.id
        AND pm.role = 'provider_admin'::public.provider_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.provider_id = providers.id
        AND pm.role = 'provider_admin'::public.provider_role
    )
  );

-- 2. provider_memberships (extend Patch 4 baseline)
DROP POLICY IF EXISTS provider_memberships_select_admin ON public.provider_memberships;
CREATE POLICY provider_memberships_select_admin ON public.provider_memberships
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_access_provider(provider_id));

DROP POLICY IF EXISTS provider_memberships_insert_admin ON public.provider_memberships;
CREATE POLICY provider_memberships_insert_admin ON public.provider_memberships
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.provider_id = provider_memberships.provider_id
        AND pm.role = 'provider_admin'::public.provider_role
    )
  );

DROP POLICY IF EXISTS provider_memberships_delete_admin ON public.provider_memberships;
CREATE POLICY provider_memberships_delete_admin ON public.provider_memberships
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.provider_id = provider_memberships.provider_id
        AND pm.role = 'provider_admin'::public.provider_role
    )
  );

-- 3. companies
DROP POLICY IF EXISTS companies_select_provider_scope ON public.companies;
CREATE POLICY companies_select_provider_scope ON public.companies
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_access_provider(provider_id));

DROP POLICY IF EXISTS companies_update_provider_scope ON public.companies;
CREATE POLICY companies_update_provider_scope ON public.companies
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.can_access_provider(provider_id))
  WITH CHECK (public.can_access_provider(provider_id));

-- 4. agreements
DROP POLICY IF EXISTS agreements_select_provider_scope ON public.agreements;
CREATE POLICY agreements_select_provider_scope ON public.agreements
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_access_provider(provider_id));

DROP POLICY IF EXISTS agreements_update_provider_scope ON public.agreements;
CREATE POLICY agreements_update_provider_scope ON public.agreements
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.can_access_provider(provider_id))
  WITH CHECK (public.can_access_provider(provider_id));

-- 5. orders (SELECT only — cutoff / guard_order_mutation unchanged)
DROP POLICY IF EXISTS orders_select_provider_scope ON public.orders;
CREATE POLICY orders_select_provider_scope ON public.orders
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_access_provider(provider_id));

-- 6. menu_service_days
DROP POLICY IF EXISTS menu_service_days_select_provider_scope ON public.menu_service_days;
CREATE POLICY menu_service_days_select_provider_scope ON public.menu_service_days
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_access_provider(provider_id));

DROP POLICY IF EXISTS menu_service_days_update_provider_scope ON public.menu_service_days;
CREATE POLICY menu_service_days_update_provider_scope ON public.menu_service_days
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (public.can_access_provider(provider_id))
  WITH CHECK (public.can_access_provider(provider_id));

-- 7. company_registrations
DROP POLICY IF EXISTS company_registrations_select_provider_scope ON public.company_registrations;
CREATE POLICY company_registrations_select_provider_scope ON public.company_registrations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (provider_id IS NOT NULL AND public.can_access_provider(provider_id));

DROP POLICY IF EXISTS company_registrations_update_provider_scope ON public.company_registrations;
CREATE POLICY company_registrations_update_provider_scope ON public.company_registrations
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (provider_id IS NOT NULL AND public.can_access_provider(provider_id))
  WITH CHECK (provider_id IS NOT NULL AND public.can_access_provider(provider_id));

DO $$
DECLARE
  actual_new_policies int;
BEGIN
  SELECT count(*) INTO actual_new_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'providers',
      'provider_memberships',
      'companies',
      'agreements',
      'orders',
      'menu_service_days',
      'company_registrations'
    )
    AND policyname LIKE '%provider%';

  IF actual_new_policies < 13 THEN
    RAISE WARNING 'Expected at least 13 new provider-scope policies, found %', actual_new_policies;
  END IF;
END
$$;
