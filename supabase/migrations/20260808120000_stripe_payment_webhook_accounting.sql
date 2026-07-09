-- Global Billing Engine phase: Stripe paid/failed webhook accounting.
--
-- Scope:
-- - Extend Stripe billing webhook idempotency ledger to PaymentIntent/Charge events.
-- - No retry, no invoice sending, no batch charge, no UI, no raw Stripe payload storage.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stripe_billing_webhook_events_event_type_chk'
      AND conrelid = 'public.stripe_billing_webhook_events'::regclass
  ) THEN
    ALTER TABLE public.stripe_billing_webhook_events
      DROP CONSTRAINT stripe_billing_webhook_events_event_type_chk;
  END IF;
END
$$;

ALTER TABLE public.stripe_billing_webhook_events
  ADD CONSTRAINT stripe_billing_webhook_events_event_type_chk CHECK (
    event_type IN (
      'checkout.session.completed',
      'setup_intent.succeeded',
      'payment_method.attached',
      'customer.updated',
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'payment_intent.processing',
      'payment_intent.requires_action',
      'charge.succeeded',
      'charge.failed'
    )
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stripe_billing_webhook_events_status_chk'
      AND conrelid = 'public.stripe_billing_webhook_events'::regclass
  ) THEN
    ALTER TABLE public.stripe_billing_webhook_events
      DROP CONSTRAINT stripe_billing_webhook_events_status_chk;
  END IF;
END
$$;

ALTER TABLE public.stripe_billing_webhook_events
  ADD CONSTRAINT stripe_billing_webhook_events_status_chk CHECK (
    status IN ('processed', 'ignored', 'unmatched', 'failed')
  );

COMMENT ON TABLE public.stripe_billing_webhook_events IS
  'Idempotency ledger for provider billing Stripe setup and PaymentIntent accounting events. No raw Stripe payload, card PAN, CVV, webhook secret, or provider secret is stored.';

COMMIT;
