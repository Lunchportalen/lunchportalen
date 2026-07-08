-- Global Billing Engine phase: Stripe charge dry-run / PaymentIntent preview.
--
-- Scope:
-- - Read-only preview for a future Stripe off-session charge.
-- - No PaymentIntent creation, no confirmation, no capture, no card charge,
--   no invoice delivery, no email, no invoice status mutation.

BEGIN;

CREATE OR REPLACE FUNCTION public.lp_billing_stripe_charge_dry_run(
  p_provider_invoice_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE (
  provider_invoice_id uuid,
  provider_id uuid,
  organization_id uuid,
  commission_period_id uuid,
  currency text,
  amount_minor bigint,
  payment_provider text,
  payment_provider_customer_id_present boolean,
  default_payment_method_present boolean,
  default_payment_method_status text,
  payment_charge_ready boolean,
  invoice_payment_status text,
  can_create_payment_intent boolean,
  can_confirm_charge boolean,
  missing_requirements text[],
  stripe_preview_metadata jsonb,
  idempotency_key text,
  created_new boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, private
AS $$
DECLARE
  v_invoice public.provider_commission_invoices%rowtype;
  v_period public.commission_periods%rowtype;
  v_profile public.organization_billing_profiles%rowtype;
  v_method public.payment_methods%rowtype;
  v_payment_ready boolean := false;
  v_missing text[] := '{}'::text[];
  v_idem text;
BEGIN
  IF NOT public.is_platform_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'STRIPE_CHARGE_DRY_RUN_FORBIDDEN';
  END IF;

  IF p_provider_invoice_id IS NULL THEN
    RAISE EXCEPTION 'PROVIDER_INVOICE_ID_REQUIRED';
  END IF;

  SELECT *
  INTO v_invoice
  FROM public.provider_commission_invoices pci
  WHERE pci.id = p_provider_invoice_id;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'PROVIDER_COMMISSION_INVOICE_NOT_FOUND';
  END IF;

  SELECT *
  INTO v_period
  FROM public.commission_periods cp
  WHERE cp.id = v_invoice.commission_period_id;

  SELECT *
  INTO v_profile
  FROM public.organization_billing_profiles obp
  WHERE obp.organization_id = v_invoice.provider_id;

  IF v_profile.organization_id IS NOT NULL AND v_profile.default_payment_method_id IS NOT NULL THEN
    SELECT *
    INTO v_method
    FROM public.payment_methods pm
    WHERE pm.id = v_profile.default_payment_method_id
      AND pm.organization_id = v_profile.organization_id;
  END IF;

  SELECT coalesce(pr.payment_charge_ready, false)
  INTO v_payment_ready
  FROM public.lp_billing_payment_readiness(v_invoice.provider_id, NULL, NULL, NULL) pr
  LIMIT 1;

  v_idem := coalesce(
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    concat('stripe-charge-preview:', v_invoice.id)
  );

  v_missing := ARRAY(
    SELECT DISTINCT req
    FROM (
      SELECT 'billing_profile_missing' AS req
      WHERE v_profile.organization_id IS NULL
      UNION ALL SELECT 'payment_provider_not_stripe'
      WHERE coalesce(v_profile.payment_provider, '') <> 'stripe'
      UNION ALL SELECT 'payment_customer_missing'
      WHERE nullif(trim(coalesce(v_profile.payment_provider_customer_id, '')), '') IS NULL
      UNION ALL SELECT 'payment_method_missing'
      WHERE v_profile.default_payment_method_id IS NULL OR v_method.id IS NULL
      UNION ALL SELECT 'payment_method_not_chargeable'
      WHERE v_method.id IS NOT NULL
        AND coalesce(v_method.status, '') NOT IN ('active', 'verified', 'chargeable')
      UNION ALL SELECT 'invoice_already_paid'
      WHERE v_invoice.payment_status = 'paid'
      UNION ALL SELECT 'invoice_payment_in_progress'
      WHERE v_invoice.payment_status = 'processing'
      UNION ALL SELECT 'invoice_void'
      WHERE v_invoice.payment_status = 'void'
      UNION ALL SELECT 'amount_not_positive'
      WHERE coalesce(v_invoice.total_amount_minor, 0) <= 0
      UNION ALL SELECT 'currency_missing'
      WHERE nullif(trim(coalesce(v_invoice.currency, '')), '') IS NULL
      UNION ALL SELECT 'currency_mismatch_billing_profile'
      WHERE v_profile.organization_id IS NOT NULL
        AND nullif(trim(coalesce(v_profile.billing_currency, '')), '') IS NOT NULL
        AND v_invoice.currency <> v_profile.billing_currency
      UNION ALL SELECT 'payment_charge_readiness_failed'
      WHERE NOT coalesce(v_payment_ready, false)
    ) requirements
    WHERE req IS NOT NULL
    ORDER BY req
  );

  RETURN QUERY
  SELECT
    v_invoice.id,
    v_invoice.provider_id,
    v_invoice.organization_id,
    v_invoice.commission_period_id,
    v_invoice.currency,
    v_invoice.total_amount_minor,
    coalesce(v_profile.payment_provider, 'stripe'),
    nullif(trim(coalesce(v_profile.payment_provider_customer_id, '')), '') IS NOT NULL,
    v_profile.default_payment_method_id IS NOT NULL AND v_method.id IS NOT NULL,
    v_method.status,
    coalesce(v_payment_ready, false),
    v_invoice.payment_status,
    cardinality(v_missing) = 0,
    false,
    v_missing,
    jsonb_build_object(
      'provider_invoice_id', v_invoice.id,
      'provider_id', v_invoice.provider_id,
      'organization_id', v_invoice.organization_id,
      'commission_period_id', v_invoice.commission_period_id,
      'billing_period_start', v_period.period_start,
      'billing_period_end', v_period.period_end,
      'currency', lower(v_invoice.currency),
      'amount_minor', v_invoice.total_amount_minor,
      'idempotency_key', v_idem,
      'purpose', 'lunchportalen_commission_invoice'
    ),
    v_idem,
    false;
END;
$$;

COMMENT ON FUNCTION public.lp_billing_stripe_charge_dry_run(uuid, text) IS
  'Read-only Stripe charge preview for provider commission invoices. Does not create PaymentIntent, confirm, capture, charge, send invoice, or mutate invoice/payment status.';

GRANT EXECUTE ON FUNCTION public.lp_billing_stripe_charge_dry_run(uuid, text)
  TO authenticated, service_role;

COMMIT;
