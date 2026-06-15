-- Agreement change requests: controlled lifecycle for per-day package overrides and future change types.
-- Does NOT mutate active agreements directly; approved requests are materialized by resolver only.

CREATE TABLE IF NOT EXISTS public.agreement_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  agreement_id uuid NOT NULL REFERENCES public.agreements(id) ON DELETE RESTRICT,
  requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_role text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING_PROVIDER_APPROVAL',
  effective_from date NOT NULL,
  effective_to date,
  change_type text NOT NULL,
  requested_change jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agreement_change_requests_status_check CHECK (
    status = ANY (ARRAY[
      'DRAFT',
      'PENDING_PROVIDER_APPROVAL',
      'PENDING_SUPERADMIN_APPROVAL',
      'APPROVED',
      'REJECTED',
      'CANCELLED'
    ]::text[])
  ),
  CONSTRAINT agreement_change_requests_change_type_check CHECK (
    change_type = ANY (ARRAY[
      'PACKAGE_BY_DAY',
      'DELIVERY_DAYS',
      'PRICE',
      'LOCATION'
    ]::text[])
  ),
  CONSTRAINT agreement_change_requests_effective_range_check CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  )
);

CREATE INDEX IF NOT EXISTS agreement_change_requests_company_id_idx
  ON public.agreement_change_requests (company_id);

CREATE INDEX IF NOT EXISTS agreement_change_requests_agreement_id_idx
  ON public.agreement_change_requests (agreement_id);

CREATE INDEX IF NOT EXISTS agreement_change_requests_provider_id_idx
  ON public.agreement_change_requests (provider_id);

CREATE INDEX IF NOT EXISTS agreement_change_requests_status_effective_idx
  ON public.agreement_change_requests (company_id, status, effective_from);

CREATE OR REPLACE FUNCTION public.trg_agreement_change_requests_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agreement_change_requests_set_updated_at ON public.agreement_change_requests;

CREATE TRIGGER trg_agreement_change_requests_set_updated_at
  BEFORE UPDATE ON public.agreement_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_agreement_change_requests_set_updated_at();

ALTER TABLE public.agreement_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agreement_change_requests_tenant_select ON public.agreement_change_requests;

CREATE POLICY agreement_change_requests_tenant_select
  ON public.agreement_change_requests
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin()
    OR public.can_access_company(company_id)
  );

GRANT SELECT ON TABLE public.agreement_change_requests TO authenticated;
