-- Global Billing Engine phase: payment readiness + invoice/credit-note policy readiness.
--
-- Scope:
-- - Machine-readable provider payment readiness.
-- - Invoice-period readiness policy checks.
-- - Credit-note policy metadata for already-closed/invoiced corrections.
-- - Payment-method metadata hardening.
--
-- Out of scope: Stripe setup intents, card charges, refunds, invoice sending, UI.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Payment-method metadata hardening
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_methods_status_chk'
      AND conrelid = 'public.payment_methods'::regclass
  ) THEN
    ALTER TABLE public.payment_methods
      DROP CONSTRAINT payment_methods_status_chk;
  END IF;
END
$$;

ALTER TABLE public.payment_methods
  ADD CONSTRAINT payment_methods_status_chk CHECK (
    status IN ('active', 'verified', 'chargeable', 'replaced', 'expired', 'failed', 'detached')
  );

COMMENT ON TABLE public.payment_methods IS
  'Payment-method metadata only: provider reference, brand, last4, expiry, status. No PAN, CVV/CVC, raw payment payload, magnetic stripe data, webhook secrets, or provider secrets.';

-- ---------------------------------------------------------------------------
-- 2) Blocking readiness events
-- ---------------------------------------------------------------------------
ALTER TABLE public.billing_readiness_events
  ADD COLUMN IF NOT EXISTS is_blocking boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS billing_readiness_events_blocking_provider_idx
  ON public.billing_readiness_events (provider_id, is_blocking, created_at DESC)
  WHERE provider_id IS NOT NULL AND resolved_at IS NULL;

COMMENT ON COLUMN public.billing_readiness_events.is_blocking IS
  'True when the event blocks billing/payment cutover until resolved or superseded.';

-- ---------------------------------------------------------------------------
-- 3) Payment + invoice-period readiness RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_billing_payment_readiness(
  p_provider_id uuid DEFAULT NULL,
  p_period_start date DEFAULT NULL,
  p_period_end date DEFAULT NULL,
  p_currency text DEFAULT NULL
)
RETURNS TABLE (
  provider_id uuid,
  provider_name text,
  organization_id uuid,
  market_id uuid,
  market_slug text,
  locale text,
  billing_currency text,
  billing_timezone text,
  legal_country_code text,
  tax_country_code text,
  has_billing_profile boolean,
  has_billing_email boolean,
  has_verified_admin_email boolean,
  has_payment_provider_customer boolean,
  has_default_payment_method boolean,
  default_payment_method_status text,
  has_raw_card_data boolean,
  snapshot_ready boolean,
  ledger_ready boolean,
  invoice_ready boolean,
  payment_setup_ready boolean,
  payment_charge_ready boolean,
  invoice_period_ready boolean,
  missing_requirements text[],
  blocking_readiness_events_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, private
AS $$
  WITH base AS (
    SELECT
      br.provider_id,
      br.provider_name,
      br.organization_id,
      br.market_id,
      br.market_slug,
      br.locale,
      br.country_code AS legal_country_code,
      br.tax_country_code,
      br.billing_currency,
      br.billing_timezone,
      br.has_billing_profile,
      br.has_billing_email,
      br.has_verified_admin_email,
      br.snapshot_ready,
      br.ledger_ready,
      br.invoice_ready AS recipient_ready,
      br.missing_requirements AS base_missing,
      obp.payment_provider_customer_id,
      obp.default_payment_method_id,
      pm.status AS payment_method_status,
      m.default_currency AS market_currency,
      (
        SELECT count(*)::integer
        FROM public.billing_readiness_events bre
        WHERE bre.provider_id = br.provider_id
          AND bre.is_blocking = true
          AND bre.resolved_at IS NULL
      ) AS blocking_events
    FROM public.lp_billing_provider_readiness(p_provider_id) br
    LEFT JOIN public.organization_billing_profiles obp
      ON obp.organization_id = br.provider_id
    LEFT JOIN public.payment_methods pm
      ON pm.id = obp.default_payment_method_id
     AND pm.organization_id = obp.organization_id
    LEFT JOIN public.markets m
      ON m.id = br.market_id
  ),
  period AS (
    SELECT
      b.provider_id,
      coalesce(count(cl.id), 0)::integer AS ledger_count,
      coalesce(count(DISTINCT cl.currency), 0)::integer AS currency_count,
      min(cl.currency) AS ledger_currency,
      bool_or(cl.event_type IN ('ORDER_CANCELLED', 'ORDER_REFUNDED', 'ORDER_CORRECTED', 'CREDIT_NOTE')) AS has_negative_events,
      EXISTS (
        SELECT 1
        FROM public.commission_periods cp
        WHERE cp.provider_id = b.provider_id
          AND cp.period_start = p_period_start
          AND cp.period_end = p_period_end
          AND (p_currency IS NULL OR cp.currency = upper(trim(p_currency)))
          AND cp.status IN ('closed', 'invoiced', 'paid')
      ) AS already_closed_or_invoiced
    FROM base b
    LEFT JOIN public.commission_ledger cl
      ON cl.provider_id = b.provider_id
     AND p_period_start IS NOT NULL
     AND p_period_end IS NOT NULL
     AND cl.billing_period = to_char(p_period_start, 'YYYY-MM')
     AND (p_currency IS NULL OR cl.currency = upper(trim(p_currency)))
    GROUP BY b.provider_id
  ),
  enriched AS (
    SELECT
      b.*,
      p.ledger_count,
      p.currency_count,
      p.ledger_currency,
      coalesce(p.has_negative_events, false) AS has_negative_events,
      coalesce(p.already_closed_or_invoiced, false) AS already_closed_or_invoiced,
      nullif(trim(coalesce(b.payment_provider_customer_id, '')), '') IS NOT NULL AS has_payment_provider_customer,
      b.default_payment_method_id IS NOT NULL
        AND b.payment_method_status IN ('active', 'verified', 'chargeable') AS has_default_payment_method,
      false AS has_raw_card_data
    FROM base b
    LEFT JOIN period p ON p.provider_id = b.provider_id
  ),
  requirements AS (
    SELECT
      e.*,
      ARRAY(
        SELECT DISTINCT req
        FROM unnest(e.base_missing) req
        WHERE req NOT IN ('payment_customer_missing', 'payment_method_missing')
        UNION ALL
        SELECT 'payment_customer_missing'
        WHERE NOT e.has_payment_provider_customer
        UNION ALL
        SELECT 'payment_method_missing'
        WHERE NOT e.has_default_payment_method
        UNION ALL
        SELECT 'payment_method_not_chargeable'
        WHERE e.default_payment_method_id IS NOT NULL
          AND coalesce(e.payment_method_status, '') NOT IN ('active', 'verified', 'chargeable')
        UNION ALL
        SELECT 'billing_currency_not_market_currency'
        WHERE e.billing_currency IS NOT NULL
          AND e.market_currency IS NOT NULL
          AND e.billing_currency <> e.market_currency
        UNION ALL
        SELECT 'blocking_readiness_events'
        WHERE e.blocking_events > 0
        UNION ALL
        SELECT 'period_required'
        WHERE p_period_start IS NULL OR p_period_end IS NULL
        UNION ALL
        SELECT 'period_ledger_empty'
        WHERE p_period_start IS NOT NULL AND p_period_end IS NOT NULL AND coalesce(e.ledger_count, 0) = 0
        UNION ALL
        SELECT 'period_mixed_currency'
        WHERE p_period_start IS NOT NULL AND p_period_end IS NOT NULL AND coalesce(e.currency_count, 0) > 1
        UNION ALL
        SELECT 'period_already_closed_or_invoiced'
        WHERE p_period_start IS NOT NULL AND p_period_end IS NOT NULL AND e.already_closed_or_invoiced
        UNION ALL
        SELECT 'credit_note_policy_required'
        WHERE p_period_start IS NOT NULL
          AND p_period_end IS NOT NULL
          AND e.has_negative_events
          AND e.already_closed_or_invoiced
      ) AS all_requirements
    FROM enriched e
  )
  SELECT
    provider_id,
    provider_name,
    organization_id,
    market_id,
    market_slug,
    locale,
    billing_currency,
    billing_timezone,
    legal_country_code,
    tax_country_code,
    has_billing_profile,
    has_billing_email,
    has_verified_admin_email,
    has_payment_provider_customer,
    has_default_payment_method,
    payment_method_status AS default_payment_method_status,
    has_raw_card_data,
    snapshot_ready,
    ledger_ready,
    (
      snapshot_ready
      AND ledger_ready
      AND (has_billing_email OR has_verified_admin_email)
    ) AS invoice_ready,
    (
      snapshot_ready
      AND ledger_ready
      AND (has_billing_email OR has_verified_admin_email)
      AND has_raw_card_data = false
    ) AS payment_setup_ready,
    (
      snapshot_ready
      AND ledger_ready
      AND (has_billing_email OR has_verified_admin_email)
      AND has_payment_provider_customer
      AND has_default_payment_method
      AND billing_currency = market_currency
      AND has_raw_card_data = false
      AND blocking_events = 0
    ) AS payment_charge_ready,
    (
      p_period_start IS NOT NULL
      AND p_period_end IS NOT NULL
      AND snapshot_ready
      AND ledger_ready
      AND (has_billing_email OR has_verified_admin_email)
      AND ledger_count > 0
      AND currency_count = 1
      AND already_closed_or_invoiced = false
    ) AS invoice_period_ready,
    coalesce(all_requirements, '{}'::text[]) AS missing_requirements,
    blocking_events AS blocking_readiness_events_count
  FROM requirements
  ORDER BY provider_name, provider_id;
$$;

COMMENT ON FUNCTION public.lp_billing_payment_readiness(uuid, date, date, text) IS
  'Read-only payment/invoice-period readiness. Exposes booleans and missing requirements only; no card PAN, CVV, raw payload, provider payment method id, secrets, or webhook secrets.';

GRANT EXECUTE ON FUNCTION public.lp_billing_payment_readiness(uuid, date, date, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) Policy anchors for future invoice/credit-note implementation
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.commission_periods IS
  'Commission periods close immutable ledger totals per provider/currency. Open periods may include positive and negative ledger events; closed/invoiced/paid periods are not rewritten.';

COMMENT ON TABLE public.provider_commission_invoices IS
  'Commission invoice snapshots are immutable. Recipient snapshot is locked at invoice creation; later billing/admin email changes affect future invoices only. Corrections after invoice issue require credit-note or next-period negative-ledger policy, not historical invoice mutation.';

COMMENT ON FUNCTION public.lp_billing_close_commission_period(uuid, date, date, text, text) IS
  'Closes a provider/currency period from append-only commission ledger. No payment provider call. Future implementation must reject mixed-currency invoice periods and handle post-invoice corrections through credit note or next-period negative ledger.';

COMMIT;
