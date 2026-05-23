-- DC-018: Enable RLS on billing_products + billing_tax_codes
-- Reference: docs/audit/repo-state-2026-05-23-deep-crawl.md
-- Decision Q3: catalog data, SELECT for authenticated,
--              write only service_role.
-- Idempotent: kan kjøres gjentatte ganger.

-- ============================================
-- billing_products
-- ============================================
ALTER TABLE public.billing_products
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_products_authenticated_select
  ON public.billing_products;

CREATE POLICY billing_products_authenticated_select
  ON public.billing_products
  FOR SELECT
  TO authenticated
  USING (true);

-- Write-tilgang: ingen policy = ingen non-service_role kan skrive.
-- service_role bypasser RLS automatisk.

GRANT SELECT ON TABLE public.billing_products TO authenticated;

-- ============================================
-- billing_tax_codes
-- ============================================
ALTER TABLE public.billing_tax_codes
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_tax_codes_authenticated_select
  ON public.billing_tax_codes;

CREATE POLICY billing_tax_codes_authenticated_select
  ON public.billing_tax_codes
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON TABLE public.billing_tax_codes TO authenticated;
