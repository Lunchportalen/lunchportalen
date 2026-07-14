-- FASE 9 hotfix: lp_billing_create_commission_invoice feilet med 42702
-- ("column reference provider_id is ambiguous") ved første reelle kjøring.
--
-- Root cause: RETURNS TABLE-out-parametre (provider_id, currency, ...)
-- kolliderer med kolonnenavn i ON CONFLICT-målet i plpgsql.
-- Fix: re-emit identisk funksjon med #variable_conflict use_column.
-- Alle variabelreferanser i kroppen er allerede prefikset (v_dry./v_period./
-- v_invoice.), så use_column er semantisk trygt.
--
-- I tillegg: ON CONFLICT-målet for fakturainnsettingen matcher nå den
-- partielle unike indeksen (kind = 'COMMISSION') fra 20260824120000,
-- slik at kreditfakturaer kan referere samme periode.

BEGIN;

CREATE OR REPLACE FUNCTION public.lp_billing_create_commission_invoice(
  p_provider_id uuid,
  p_period_start date,
  p_period_end date,
  p_currency text,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE (
  provider_id uuid,
  organization_id uuid,
  commission_period_id uuid,
  provider_invoice_id uuid,
  period_start date,
  period_end date,
  currency text,
  ledger_rows_count integer,
  net_basis_amount_minor bigint,
  net_commission_amount_exact numeric,
  rounded_commission_amount_minor bigint,
  rounding_adjustment_minor numeric,
  recipient_emails_snapshot jsonb,
  invoice_status text,
  payment_status text,
  can_charge boolean,
  idempotency_key text,
  created_new boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
#variable_conflict use_column
DECLARE
  v_dry record;
  v_period public.commission_periods%rowtype;
  v_invoice public.provider_commission_invoices%rowtype;
  v_idem text;
  v_created boolean := false;
BEGIN
  IF NOT public.is_platform_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'COMMISSION_INVOICE_CREATE_FORBIDDEN';
  END IF;

  IF p_provider_id IS NULL OR p_period_start IS NULL OR p_period_end IS NULL OR nullif(trim(coalesce(p_currency, '')), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT';
  END IF;

  v_idem := coalesce(
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    concat('commission-invoice:', p_provider_id, ':', p_period_start, ':', p_period_end, ':', upper(trim(p_currency)))
  );

  -- Retry-safe idempotens (krav 6/20): finnes allerede lukket/fakturert
  -- periode med kommisjonsfaktura, returner den — aldri duplikat, aldri feil.
  SELECT cp.* INTO v_period
  FROM public.commission_periods cp
  WHERE cp.provider_id = p_provider_id
    AND cp.period_start = p_period_start
    AND cp.period_end = p_period_end
    AND cp.currency = upper(trim(p_currency))
    AND cp.status IN ('closed', 'invoiced', 'paid');

  IF v_period.id IS NOT NULL THEN
    SELECT pci.* INTO v_invoice
    FROM public.provider_commission_invoices pci
    WHERE pci.commission_period_id = v_period.id
      AND pci.kind = 'COMMISSION';

    IF v_invoice.id IS NOT NULL THEN
      RETURN QUERY
      SELECT
        v_period.provider_id,
        v_period.organization_id,
        v_period.id,
        v_invoice.id,
        v_period.period_start,
        v_period.period_end,
        v_period.currency,
        0,
        v_period.total_basis_amount_minor,
        v_period.total_commission_exact,
        v_period.rounded_commission_minor,
        v_period.rounding_adjustment_minor::numeric,
        v_invoice.sent_to_emails_snapshot,
        v_period.status,
        v_invoice.payment_status,
        false,
        v_idem,
        false;
      RETURN;
    END IF;
  END IF;

  SELECT *
  INTO v_dry
  FROM public.lp_billing_invoice_close_dry_run(
    p_provider_id,
    p_period_start,
    p_period_end,
    upper(trim(p_currency))
  )
  LIMIT 1;

  IF v_dry.provider_id IS NULL THEN
    RAISE EXCEPTION 'DRY_RUN_NOT_AVAILABLE';
  END IF;

  IF NOT coalesce(v_dry.can_close, false) THEN
    RAISE EXCEPTION 'COMMISSION_INVOICE_NOT_READY: %', array_to_string(coalesce(v_dry.missing_requirements, '{}'::text[]), ',');
  END IF;

  IF jsonb_array_length(coalesce(v_dry.recipient_emails_snapshot_preview, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'COMMISSION_INVOICE_NO_RECIPIENTS';
  END IF;

  INSERT INTO public.commission_periods (
    provider_id,
    organization_id,
    period_start,
    period_end,
    billing_timezone,
    currency,
    status,
    total_basis_amount_minor,
    total_commission_exact,
    rounded_commission_minor,
    rounding_adjustment_minor,
    closed_at,
    idempotency_key
  )
  SELECT
    v_dry.provider_id,
    v_dry.organization_id,
    v_dry.period_start,
    v_dry.period_end,
    obp.billing_timezone,
    v_dry.currency,
    'invoiced',
    v_dry.net_basis_amount_minor,
    v_dry.net_commission_amount_exact,
    v_dry.rounded_commission_amount_minor,
    v_dry.rounding_adjustment_minor::bigint,
    now(),
    v_idem
  FROM public.organization_billing_profiles obp
  WHERE obp.organization_id = v_dry.provider_id
  ON CONFLICT (provider_id, period_start, period_end, currency) DO NOTHING
  RETURNING * INTO v_period;

  IF v_period.id IS NOT NULL THEN
    v_created := true;
  ELSE
    SELECT *
    INTO v_period
    FROM public.commission_periods cp
    WHERE cp.provider_id = v_dry.provider_id
      AND cp.period_start = v_dry.period_start
      AND cp.period_end = v_dry.period_end
      AND cp.currency = v_dry.currency;
  END IF;

  IF v_period.id IS NULL THEN
    RAISE EXCEPTION 'COMMISSION_PERIOD_CREATE_FAILED';
  END IF;

  INSERT INTO public.provider_commission_invoices (
    provider_id,
    organization_id,
    commission_period_id,
    amount_ex_tax_minor,
    tax_amount_minor,
    total_amount_minor,
    currency,
    billing_email_snapshot,
    admin_email_snapshot,
    sent_to_emails_snapshot,
    payment_status,
    issued_at
  )
  SELECT
    v_dry.provider_id,
    v_dry.organization_id,
    v_period.id,
    v_dry.rounded_commission_amount_minor,
    0,
    v_dry.rounded_commission_amount_minor,
    v_dry.currency,
    lower(nullif(trim(obp.billing_email_current), '')),
    (
      SELECT coalesce(jsonb_agg(DISTINCT lower(u.email)) FILTER (WHERE u.email IS NOT NULL), '[]'::jsonb)
      FROM public.provider_memberships pm
      JOIN auth.users u ON u.id = pm.user_id
      WHERE pm.provider_id = v_dry.provider_id
        AND pm.role = 'provider_admin'::public.provider_role
        AND u.email IS NOT NULL
        AND u.email_confirmed_at IS NOT NULL
    ),
    v_dry.recipient_emails_snapshot_preview,
    'pending',
    now()
  FROM public.organization_billing_profiles obp
  WHERE obp.organization_id = v_dry.provider_id
  ON CONFLICT (commission_period_id) WHERE kind = 'COMMISSION' DO NOTHING
  RETURNING * INTO v_invoice;

  IF v_invoice.id IS NULL THEN
    SELECT *
    INTO v_invoice
    FROM public.provider_commission_invoices pci
    WHERE pci.commission_period_id = v_period.id
      AND pci.kind = 'COMMISSION';
  END IF;

  IF v_invoice.id IS NULL THEN
    RAISE EXCEPTION 'PROVIDER_COMMISSION_INVOICE_CREATE_FAILED';
  END IF;

  IF v_created THEN
    INSERT INTO public.billing_audit_log (
      organization_id,
      actor_user_id,
      action,
      after_json,
      reason
    )
    VALUES (
      v_dry.provider_id,
      auth.uid(),
      'provider_commission_invoice.final_created',
      jsonb_build_object(
        'commission_period_id', v_period.id,
        'provider_invoice_id', v_invoice.id,
        'period_start', v_dry.period_start,
        'period_end', v_dry.period_end,
        'currency', v_dry.currency,
        'rounded_commission_amount_minor', v_dry.rounded_commission_amount_minor
      ),
      'final internal invoice creation; no charge and no send'
    );
  END IF;

  RETURN QUERY
  SELECT
    v_dry.provider_id,
    v_dry.organization_id,
    v_period.id,
    v_invoice.id,
    v_dry.period_start,
    v_dry.period_end,
    v_dry.currency,
    v_dry.ledger_rows_count,
    v_dry.net_basis_amount_minor,
    v_dry.net_commission_amount_exact,
    v_dry.rounded_commission_amount_minor,
    v_dry.rounding_adjustment_minor,
    v_invoice.sent_to_emails_snapshot,
    v_period.status,
    v_invoice.payment_status,
    v_dry.can_charge,
    v_idem,
    v_created;
END;
$$;

COMMENT ON FUNCTION public.lp_billing_create_commission_invoice(uuid, date, date, text, text) IS
  'Final internal commission invoice creation (invoice-only). Uses dry-run result, closes period as invoiced, creates provider_commission_invoices snapshot. variable_conflict=use_column fixes 42702 on ON CONFLICT target.';

COMMIT;
