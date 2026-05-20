-- Patch 7 (Phase E.7) — lifecycle_audit_log INSERT + order_status.PAUSED (separate TX before RPC migration)
-- UPDATE/DELETE: no policies (immutable). SELECT remains superadmin-only (Patch 4).

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'PAUSED';

DROP POLICY IF EXISTS lifecycle_audit_log_insert_via_rpc ON public.lifecycle_audit_log;

CREATE POLICY lifecycle_audit_log_insert_via_rpc ON public.lifecycle_audit_log
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR public.is_platform_admin());
