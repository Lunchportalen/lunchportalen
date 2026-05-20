-- Patch 10 (Phase E.10) — provider-scoped SELECT on lifecycle_audit_log
-- Fixes empty dashboard activity for provider-admins (Patch 9 gap).

DROP POLICY IF EXISTS lifecycle_audit_log_select_provider_scope ON public.lifecycle_audit_log;

CREATE POLICY lifecycle_audit_log_select_provider_scope ON public.lifecycle_audit_log
  FOR SELECT
  USING (
    (entity_type = 'provider' AND public.can_access_provider(entity_id))
    OR (
      entity_type = 'company'
      AND EXISTS (
        SELECT 1
        FROM public.companies c
        WHERE c.id = lifecycle_audit_log.entity_id
          AND public.can_access_provider(c.provider_id)
      )
    )
    OR (
      entity_type = 'user'
      AND EXISTS (
        SELECT 1
        FROM public.company_memberships cm
        JOIN public.companies c ON c.id = cm.company_id
        WHERE cm.user_id = lifecycle_audit_log.entity_id
          AND public.can_access_provider(c.provider_id)
      )
    )
  );

COMMENT ON POLICY lifecycle_audit_log_select_provider_scope ON public.lifecycle_audit_log IS
'Provider admins read lifecycle events for their provider, scoped companies, and company members.';
