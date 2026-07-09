-- Global Billing Engine phase: Stripe SetupIntent / payment method onboarding.
--
-- Scope:
-- - Idempotency ledger for Stripe setup webhooks.
-- - No Stripe charge, no invoice sending, no payment/refund execution, no UI.

BEGIN;

CREATE TABLE IF NOT EXISTS public.stripe_billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL,
  event_type text NOT NULL,
  organization_id uuid NULL REFERENCES public.organizations (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'processed',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_billing_webhook_events_event_id_uniq UNIQUE (stripe_event_id),
  CONSTRAINT stripe_billing_webhook_events_status_chk CHECK (
    status IN ('processed', 'ignored', 'failed')
  ),
  CONSTRAINT stripe_billing_webhook_events_event_type_chk CHECK (
    event_type IN (
      'checkout.session.completed',
      'setup_intent.succeeded',
      'payment_method.attached',
      'customer.updated'
    )
  )
);

COMMENT ON TABLE public.stripe_billing_webhook_events IS
  'Idempotency ledger for provider billing Stripe setup events. No raw Stripe payload, card PAN, CVV, webhook secret, or payment provider secret is stored.';

CREATE INDEX IF NOT EXISTS stripe_billing_webhook_events_org_created_idx
  ON public.stripe_billing_webhook_events (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

ALTER TABLE public.stripe_billing_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stripe_billing_webhook_events_platform_select ON public.stripe_billing_webhook_events;
CREATE POLICY stripe_billing_webhook_events_platform_select
  ON public.stripe_billing_webhook_events
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS stripe_billing_webhook_events_service_role_all ON public.stripe_billing_webhook_events;
CREATE POLICY stripe_billing_webhook_events_service_role_all
  ON public.stripe_billing_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.stripe_billing_webhook_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.stripe_billing_webhook_events TO authenticated;
GRANT ALL ON TABLE public.stripe_billing_webhook_events TO service_role;

COMMIT;
