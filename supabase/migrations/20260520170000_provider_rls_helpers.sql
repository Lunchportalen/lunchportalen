-- Patch 6 (Phase E.6) — can_access_provider helper (PROVIDER-PLAN-V1 §7.1)
-- Mirror public.can_access_company pattern: SECURITY DEFINER, search_path SET, STABLE.

CREATE OR REPLACE FUNCTION public.can_access_provider(p_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.provider_memberships pm
    WHERE pm.user_id = auth.uid()
      AND pm.provider_id = p_provider_id
  )
  OR public.is_platform_admin();
$$;

COMMENT ON FUNCTION public.can_access_provider(uuid) IS
'True when auth.uid() has provider_membership for p_provider_id, or is platform admin. Mirror of can_access_company().';

GRANT EXECUTE ON FUNCTION public.can_access_provider(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'can_access_provider'
      AND prosecdef = true
  ) THEN
    RAISE EXCEPTION 'can_access_provider not created or not SECURITY DEFINER';
  END IF;
END
$$;
