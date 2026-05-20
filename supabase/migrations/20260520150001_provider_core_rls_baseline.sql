-- Patch 4 (Phase E.4) — Provider core RLS baseline (superadmin only via is_platform_admin)
-- Patch 6 adds provider-scope policies (can_access_provider). Patch 7 adds lifecycle_audit_log INSERT.

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifecycle_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS providers_superadmin_all ON public.providers;
CREATE POLICY providers_superadmin_all ON public.providers
  FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS provider_memberships_superadmin_all ON public.provider_memberships;
CREATE POLICY provider_memberships_superadmin_all ON public.provider_memberships
  FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS provider_service_areas_superadmin_all ON public.provider_service_areas;
CREATE POLICY provider_service_areas_superadmin_all ON public.provider_service_areas
  FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS lifecycle_audit_log_superadmin_select ON public.lifecycle_audit_log;
CREATE POLICY lifecycle_audit_log_superadmin_select ON public.lifecycle_audit_log
  FOR SELECT
  USING (public.is_platform_admin());

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'providers') < 1 THEN
    RAISE EXCEPTION 'providers RLS policies missing';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'provider_memberships') < 1 THEN
    RAISE EXCEPTION 'provider_memberships RLS policies missing';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'provider_service_areas') < 1 THEN
    RAISE EXCEPTION 'provider_service_areas RLS policies missing';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'lifecycle_audit_log') < 1 THEN
    RAISE EXCEPTION 'lifecycle_audit_log RLS policies missing';
  END IF;
END
$$;
