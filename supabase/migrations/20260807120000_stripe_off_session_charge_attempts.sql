-- Global Billing Engine phase: actual Stripe off-session charge for one internal invoice.
--
-- Scope:
-- - Minimal payment attempt ledger for one-provider-invoice charge attempts.
-- - No batch charging, no invoice sending, no retry/grace-period engine, no webhook accounting.

BEGIN;

CREATE TABLE IF NOT EXISTS public.billing_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_invoice_id uuid NOT NULL REFERENCES public.provider_commission_invoices (id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  payment_provider text NOT NULL,
  provider_payment_intent_id text NULL,
  provider_customer_id_reference text NULL,
  amount_minor bigint NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  failure_code text NULL,
  failure_message_safe text NULL,
  requires_action boolean NOT NULL DEFAULT false,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_payment_attempts_provider_chk CHECK (payment_provider IN ('stripe')),
  CONSTRAINT billing_payment_attempts_amount_chk CHECK (amount_minor > 0),
  CONSTRAINT billing_payment_attempts_currency_chk CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT billing_payment_attempts_status_chk CHECK (
    status IN ('processing', 'succeeded', 'failed', 'requires_action')
  ),
  CONSTRAINT billing_payment_attempts_idempotency_key_uniq UNIQUE (idempotency_key),
  CONSTRAINT billing_payment_attempts_provider_pi_uniq UNIQUE (payment_provider, provider_payment_intent_id)
);

COMMENT ON TABLE public.billing_payment_attempts IS
  'One row per Stripe off-session provider commission invoice charge attempt. Stores references and safe failure metadata only; no raw Stripe payload, card PAN, CVV/CVC, webhook secret, or provider secret.';

CREATE INDEX IF NOT EXISTS billing_payment_attempts_invoice_created_idx
  ON public.billing_payment_attempts (provider_invoice_id, created_at DESC);

CREATE INDEX IF NOT EXISTS billing_payment_attempts_provider_status_idx
  ON public.billing_payment_attempts (provider_id, status, created_at DESC);

DROP TRIGGER IF EXISTS billing_payment_attempts_set_updated_at ON public.billing_payment_attempts;
CREATE TRIGGER billing_payment_attempts_set_updated_at
  BEFORE UPDATE ON public.billing_payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_set_updated_at();

ALTER TABLE public.billing_payment_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_payment_attempts_platform_select ON public.billing_payment_attempts;
CREATE POLICY billing_payment_attempts_platform_select
  ON public.billing_payment_attempts
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS billing_payment_attempts_service_role_all ON public.billing_payment_attempts;
CREATE POLICY billing_payment_attempts_service_role_all
  ON public.billing_payment_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.billing_payment_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.billing_payment_attempts TO authenticated;
GRANT ALL ON TABLE public.billing_payment_attempts TO service_role;

COMMIT;
