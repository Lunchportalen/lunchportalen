-- Phase 16NO.2 — Norway legal clickwrap enforcement columns + immutability.
-- Additive. Does not enable other countries. Does not forge LEGAL_APPROVED.

BEGIN;

ALTER TABLE public.legal_acceptances
  ADD COLUMN IF NOT EXISTS organization_id uuid NULL;
ALTER TABLE public.legal_acceptances
  ADD COLUMN IF NOT EXISTS actor_user_id uuid NULL;
ALTER TABLE public.legal_acceptances
  ADD COLUMN IF NOT EXISTS client_ip text NULL;
ALTER TABLE public.legal_acceptances
  ADD COLUMN IF NOT EXISTS user_agent text NULL;

CREATE INDEX IF NOT EXISTS legal_acceptances_org_idx
  ON public.legal_acceptances (organization_id, document_type);
CREATE INDEX IF NOT EXISTS legal_acceptances_actor_idx
  ON public.legal_acceptances (actor_user_id);

CREATE OR REPLACE FUNCTION public.trg_legal_acceptances_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'LEGAL_ACCEPTANCE_IMMUTABLE';
END;
$$;

DROP TRIGGER IF EXISTS legal_acceptances_no_update ON public.legal_acceptances;
CREATE TRIGGER legal_acceptances_no_update
  BEFORE UPDATE ON public.legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.trg_legal_acceptances_immutable();

DROP TRIGGER IF EXISTS legal_acceptances_no_delete ON public.legal_acceptances;
CREATE TRIGGER legal_acceptances_no_delete
  BEFORE DELETE ON public.legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.trg_legal_acceptances_immutable();

-- Tighten read policy: own actor rows only (service_role bypasses RLS).
DROP POLICY IF EXISTS legal_acceptances_read ON public.legal_acceptances;
CREATE POLICY legal_acceptances_read ON public.legal_acceptances
  FOR SELECT TO authenticated
  USING (actor_user_id IS NOT NULL AND actor_user_id = auth.uid());

COMMENT ON TABLE public.legal_acceptances IS
  '16NO.2 immutable clickwrap acceptances. Owner-approved Norway docs; not LEGAL_APPROVED.';

-- Pending clickwrap payloads from public registration (no actor yet).
-- Materialized into legal_acceptances only when an authenticated actor persists acceptance.
ALTER TABLE public.company_registrations
  ADD COLUMN IF NOT EXISTS norway_legal_pending jsonb NULL;
ALTER TABLE public.provider_registrations
  ADD COLUMN IF NOT EXISTS norway_legal_pending jsonb NULL;

COMMENT ON COLUMN public.company_registrations.norway_legal_pending IS
  '16NO.2 validated clickwrap batch awaiting actor materialization. Not an acceptance record.';
COMMENT ON COLUMN public.provider_registrations.norway_legal_pending IS
  '16NO.2 validated clickwrap batch awaiting actor materialization. Not an acceptance record.';

COMMIT;
