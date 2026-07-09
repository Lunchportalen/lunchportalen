-- Global Billing Engine phase: retry/grace-period policy for failed Stripe payments.
--
-- Scope:
-- - Machine-readable recovery status and policy fields.
-- - No automatic retry executor, no invoice sending, no provider suspension, no UI.

BEGIN;

ALTER TABLE public.provider_commission_invoices
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retry_count integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS grace_period_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_payment_error_code text NULL,
  ADD COLUMN IF NOT EXISTS last_payment_error_message_safe text NULL,
  ADD COLUMN IF NOT EXISTS payment_blocked_reason text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'provider_commission_invoices_retry_count_chk'
  ) THEN
    ALTER TABLE public.provider_commission_invoices
      ADD CONSTRAINT provider_commission_invoices_retry_count_chk CHECK (
        retry_count >= 0 AND max_retry_count >= 0 AND retry_count <= max_retry_count
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS provider_commission_invoices_recovery_idx
  ON public.provider_commission_invoices (payment_status, next_retry_at, grace_period_until)
  WHERE payment_status IN ('failed', 'action_required', 'processing');

COMMENT ON COLUMN public.provider_commission_invoices.retry_count IS
  'Number of failed automated charge attempts recorded for recovery policy. Does not trigger retry by itself.';
COMMENT ON COLUMN public.provider_commission_invoices.next_retry_at IS
  'Earliest future retry eligibility timestamp. No automatic retry executor exists in this phase.';
COMMENT ON COLUMN public.provider_commission_invoices.grace_period_until IS
  'Provider grace-period end for failed/action-required payments. No automatic suspension in this phase.';

CREATE OR REPLACE FUNCTION public.lp_billing_apply_payment_recovery_policy(
  p_provider_invoice_id uuid,
  p_payment_status text,
  p_failure_code text DEFAULT NULL,
  p_failure_message_safe text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_status text := lower(trim(coalesce(p_payment_status, '')));
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'PAYMENT_RECOVERY_POLICY_FORBIDDEN';
  END IF;

  IF p_provider_invoice_id IS NULL THEN
    RAISE EXCEPTION 'PROVIDER_INVOICE_ID_REQUIRED';
  END IF;

  IF v_status = 'failed' THEN
    UPDATE public.provider_commission_invoices
    SET
      retry_count = least(retry_count + 1, max_retry_count),
      next_retry_at = CASE
        WHEN retry_count + 1 >= max_retry_count THEN NULL
        ELSE now() + make_interval(days => 3)
      END,
      grace_period_until = coalesce(grace_period_until, now() + make_interval(days => 14)),
      last_payment_error_code = nullif(trim(coalesce(p_failure_code, '')), ''),
      last_payment_error_message_safe = left(nullif(trim(coalesce(p_failure_message_safe, '')), ''), 300),
      payment_blocked_reason = CASE
        WHEN retry_count + 1 >= max_retry_count THEN 'max_retries_reached'
        ELSE 'payment_failed'
      END
    WHERE id = p_provider_invoice_id;
  ELSIF v_status = 'action_required' THEN
    UPDATE public.provider_commission_invoices
    SET
      next_retry_at = NULL,
      grace_period_until = coalesce(grace_period_until, now() + make_interval(days => 14)),
      last_payment_error_code = coalesce(nullif(trim(coalesce(p_failure_code, '')), ''), 'authentication_required'),
      last_payment_error_message_safe = left(nullif(trim(coalesce(p_failure_message_safe, '')), ''), 300),
      payment_blocked_reason = 'payment_method_action_required'
    WHERE id = p_provider_invoice_id;
  ELSIF v_status = 'processing' THEN
    UPDATE public.provider_commission_invoices
    SET
      next_retry_at = NULL,
      payment_blocked_reason = 'payment_processing'
    WHERE id = p_provider_invoice_id;
  ELSIF v_status = 'paid' THEN
    UPDATE public.provider_commission_invoices
    SET
      next_retry_at = NULL,
      grace_period_until = NULL,
      last_payment_error_code = NULL,
      last_payment_error_message_safe = NULL,
      payment_blocked_reason = NULL
    WHERE id = p_provider_invoice_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_billing_payment_recovery_status(
  p_provider_invoice_id uuid
)
RETURNS TABLE (
  provider_invoice_id uuid,
  provider_id uuid,
  organization_id uuid,
  payment_status text,
  latest_attempt_status text,
  retry_count integer,
  max_retry_count integer,
  next_retry_at timestamptz,
  grace_period_until timestamptz,
  retry_eligible boolean,
  requires_payment_method_update boolean,
  payment_method_status text,
  blocking_reason text,
  missing_requirements text[],
  can_retry_now boolean,
  should_notify_provider boolean,
  should_suspend boolean,
  safe_failure_code text,
  safe_failure_message text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  WITH invoice AS (
    SELECT pci.*
    FROM public.provider_commission_invoices pci
    WHERE pci.id = p_provider_invoice_id
      AND (
        auth.role() = 'service_role'
        OR public.is_platform_admin()
        OR public.lp_billing_can_access_provider(pci.provider_id)
      )
  ),
  attempt AS (
    SELECT bpa.*
    FROM public.billing_payment_attempts bpa
    JOIN invoice i ON i.id = bpa.provider_invoice_id
    ORDER BY bpa.created_at DESC
    LIMIT 1
  ),
  method AS (
    SELECT pm.status
    FROM invoice i
    JOIN public.organization_billing_profiles obp ON obp.organization_id = i.provider_id
    LEFT JOIN public.payment_methods pm ON pm.id = obp.default_payment_method_id
    LIMIT 1
  ),
  missing AS (
    SELECT ARRAY(
      SELECT req
      FROM (
        SELECT 'invoice_paid' AS req FROM invoice WHERE payment_status = 'paid'
        UNION ALL SELECT 'invoice_void' FROM invoice WHERE payment_status = 'void'
        UNION ALL SELECT 'payment_processing' FROM invoice WHERE payment_status = 'processing'
        UNION ALL SELECT 'payment_method_update_required'
          FROM invoice, method
          WHERE payment_status = 'action_required'
             OR coalesce(method.status, '') IN ('expired', 'failed', 'detached')
        UNION ALL SELECT 'max_retries_reached'
          FROM invoice
          WHERE retry_count >= max_retry_count
        UNION ALL SELECT 'retry_not_due'
          FROM invoice
          WHERE next_retry_at IS NOT NULL AND next_retry_at > now()
      ) r
    ) AS requirements
  )
  SELECT
    i.id,
    i.provider_id,
    i.organization_id,
    i.payment_status,
    a.status,
    i.retry_count,
    i.max_retry_count,
    i.next_retry_at,
    i.grace_period_until,
    (
      i.payment_status = 'failed'
      AND i.retry_count < i.max_retry_count
      AND (i.next_retry_at IS NULL OR i.next_retry_at <= now())
      AND coalesce(m.status, '') IN ('active', 'verified', 'chargeable')
    ) AS retry_eligible,
    (
      i.payment_status = 'action_required'
      OR coalesce(m.status, '') IN ('expired', 'failed', 'detached')
    ) AS requires_payment_method_update,
    m.status,
    i.payment_blocked_reason,
    missing.requirements,
    (
      i.payment_status = 'failed'
      AND i.retry_count < i.max_retry_count
      AND (i.next_retry_at IS NULL OR i.next_retry_at <= now())
      AND coalesce(m.status, '') IN ('active', 'verified', 'chargeable')
    ) AS can_retry_now,
    i.payment_status IN ('failed', 'action_required') AS should_notify_provider,
    (
      i.grace_period_until IS NOT NULL
      AND now() > i.grace_period_until
      AND i.payment_status IN ('failed', 'action_required')
      AND i.retry_count >= i.max_retry_count
    ) AS should_suspend,
    i.last_payment_error_code,
    i.last_payment_error_message_safe
  FROM invoice i
  LEFT JOIN attempt a ON true
  LEFT JOIN method m ON true
  CROSS JOIN missing;
$$;

COMMENT ON FUNCTION public.lp_billing_payment_recovery_status(uuid) IS
  'Read-only payment recovery policy status. No Stripe call, no retry execution, no email, no invoice mutation.';

GRANT EXECUTE ON FUNCTION public.lp_billing_apply_payment_recovery_policy(uuid, text, text, text)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lp_billing_payment_recovery_status(uuid)
  TO authenticated, service_role;

COMMIT;
