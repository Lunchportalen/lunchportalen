-- DC-019: Enable RLS on invoice_periods, tripletex_exports, company_deletions
-- Reference: docs/audit/repo-state-2026-05-23-deep-crawl.md
-- Pattern:
--   * invoice_periods = tenant-scoped SELECT (agreements/can_access_company)
--   * tripletex_exports = tenant-scoped via unique_ref join (no company_id column)
--   * company_deletions = superadmin-only SELECT (is_platform_admin)
--   * Writes via service_role only (ingen write-policy)
-- Idempotent: kan kjøres gjentatte ganger.

-- ============================================
-- invoice_periods (tenant-scoped)
-- ============================================
ALTER TABLE public.invoice_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_periods_tenant_select
  ON public.invoice_periods;

CREATE POLICY invoice_periods_tenant_select
  ON public.invoice_periods
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin()
    OR public.can_access_company(company_id)
  );

GRANT SELECT ON TABLE public.invoice_periods TO authenticated;

-- ============================================
-- tripletex_exports (tenant-scoped via unique_ref joins)
-- Note: table has no company_id — dedupe map keyed by unique_ref.
-- ============================================
ALTER TABLE public.tripletex_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tripletex_exports_tenant_select
  ON public.tripletex_exports;

CREATE POLICY tripletex_exports_tenant_select
  ON public.tripletex_exports
  FOR SELECT
  TO authenticated
  USING (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.invoice_periods ip
      WHERE ip.unique_ref = tripletex_exports.unique_ref
        AND public.can_access_company(ip.company_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.agreement_invoices ai
      WHERE tripletex_exports.unique_ref = ('lp_agreement:' || ai.id::text)
        AND public.can_access_company(ai.company_id)
    )
    OR (
      tripletex_exports.unique_ref LIKE 'lp_bw:%'
      AND public.can_access_company((split_part(tripletex_exports.unique_ref, ':', 2))::uuid)
    )
  );

GRANT SELECT ON TABLE public.tripletex_exports TO authenticated;

-- ============================================
-- company_deletions (superadmin-only)
-- ============================================
ALTER TABLE public.company_deletions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_deletions_superadmin_select
  ON public.company_deletions;

CREATE POLICY company_deletions_superadmin_select
  ON public.company_deletions
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

GRANT SELECT ON TABLE public.company_deletions TO authenticated;
