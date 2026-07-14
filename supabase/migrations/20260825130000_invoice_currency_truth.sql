-- PHASE 10 — currency truth for fakturabygging (0 hardkodede NOK-antakelser
-- i fakturerings-/skattebeslutninger).
--
-- Root cause: lp_invoice_build_draft falt tilbake til 'NOK' når ordre manglet
-- currency_code, og agreement_invoices/agreement_invoice_lines hadde 'NOK'
-- som kolonne-default. Currency skal komme fra providerens billingprofil
-- (markedssannhet) — aldri fra en hardkodet fallback.
--
-- Fix:
--   1. Re-emit lp_invoice_build_draft: currency = provider billing profile
--      (fail-closed hvis profil mangler — samme krav som markedsgaten).
--   2. Kolonne-defaultene beholdes KUN for de legacy-norske Tripletex-
--      generatorene (eksplisitt NO-scopet adapterflyt, ikke en global
--      antakelse) og dokumenteres som legacy. Den kanoniske globale
--      skrivebanen setter alltid currency eksplisitt.

BEGIN;

CREATE OR REPLACE FUNCTION public.lp_invoice_build_draft(
  p_provider_id uuid,
  p_company_id uuid,
  p_period_start date,
  p_period_end date,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_agreement_id uuid;
  v_location_id uuid;
  v_invoice_id uuid;
  v_lines integer;
  v_billing_currency text;
BEGIN
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end < p_period_start THEN
    RAISE EXCEPTION 'PERIOD_INVALID' USING errcode = 'P0001';
  END IF;

  -- Tenant law: provider must own the company (fail-closed).
  IF NOT EXISTS (
    SELECT 1 FROM public.companies c WHERE c.id = p_company_id AND c.provider_id = p_provider_id
  ) THEN
    RAISE EXCEPTION 'COMPANY_NOT_OWNED_BY_PROVIDER' USING errcode = 'P0001';
  END IF;

  -- Currency truth: provider billing profile (market), aldri hardkodet fallback.
  SELECT nullif(trim(coalesce(obp.billing_currency, '')), '')
  INTO v_billing_currency
  FROM public.organization_billing_profiles obp
  WHERE obp.organization_id = p_provider_id;

  IF v_billing_currency IS NULL THEN
    RAISE EXCEPTION 'BILLING_PROFILE_CURRENCY_MISSING' USING errcode = 'P0001';
  END IF;

  SELECT a.id, a.location_id INTO v_agreement_id, v_location_id
  FROM public.agreements a
  WHERE a.company_id = p_company_id AND a.provider_id = p_provider_id
  ORDER BY CASE WHEN upper(a.status::text) = 'ACTIVE' THEN 0 ELSE 1 END, a.created_at DESC
  LIMIT 1;
  IF v_agreement_id IS NULL THEN
    RAISE EXCEPTION 'AGREEMENT_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  -- One invoice per (provider, company, period): DRAFT is rebuilt; a finalized
  -- non-VOID invoice blocks a duplicate build for the same exact period.
  SELECT id INTO v_invoice_id
  FROM public.agreement_invoices
  WHERE provider_id = p_provider_id AND company_id = p_company_id
    AND invoice_period_start = p_period_start AND invoice_period_end = p_period_end
    AND kind = 'INVOICE' AND status <> 'VOID'
  LIMIT 1;

  IF v_invoice_id IS NOT NULL THEN
    IF (SELECT status FROM public.agreement_invoices WHERE id = v_invoice_id) <> 'DRAFT' THEN
      RAISE EXCEPTION 'PERIOD_ALREADY_INVOICED' USING errcode = 'P0001';
    END IF;
    DELETE FROM public.agreement_invoice_lines WHERE invoice_id = v_invoice_id;
  ELSE
    INSERT INTO public.agreement_invoices (
      agreement_id, provider_id, company_id, location_id,
      invoice_period_start, invoice_period_end, billing_cycle,
      amount_net, amount_tax, amount_total, status, kind, payment_terms_days, currency
    ) VALUES (
      v_agreement_id, p_provider_id, p_company_id, v_location_id,
      p_period_start, p_period_end, 'monthly',
      0, 0, 0, 'DRAFT', 'INVOICE', 14, v_billing_currency
    )
    RETURNING id INTO v_invoice_id;
  END IF;

  -- Basis: ONLY DELIVERED (chargeable) order lines, immutable snapshots from
  -- order_items — and never an order already on another non-VOID invoice.
  INSERT INTO public.agreement_invoice_lines (
    invoice_id, product_key, description, quantity, unit_price, line_amount,
    vat_rate, vat_amount, tax_code_id, order_id, location_id, source, currency, service_date
  )
  SELECT
    v_invoice_id,
    CASE WHEN upper(coalesce(o.tier::text, '')) IN ('BASIS', 'LUXUS', 'ENTERPRISE')
         THEN upper(o.tier::text) ELSE 'CUSTOM' END,
    coalesce(oi.product_name_snapshot, 'Lunsj') || ' · ' || to_char(o.date, 'DD.MM.YYYY'),
    greatest(oi.quantity, 1),
    round(oi.unit_price_cents_ex_vat::numeric / 100, 2),
    round(oi.line_subtotal_cents_ex_vat::numeric / 100, 2),
    coalesce(oi.vat_rate_snapshot, 0),
    round(oi.line_vat_cents::numeric / 100, 2),
    private.lp_invoice_tax_code_for_rate(coalesce(oi.vat_rate_snapshot, 0)),
    o.id,
    o.location_id,
    'ORDER',
    coalesce(nullif(trim(o.currency_code), ''), v_billing_currency),
    o.date
  FROM public.orders o
  JOIN public.order_items oi ON oi.order_id = o.id
  WHERE o.provider_id = p_provider_id
    AND o.company_id = p_company_id
    AND o.date >= p_period_start AND o.date <= p_period_end
    AND o.status = 'DELIVERED'::public.order_status
    AND NOT EXISTS (
      SELECT 1
      FROM public.agreement_invoice_lines l
      JOIN public.agreement_invoices i ON i.id = l.invoice_id
      WHERE l.order_id = o.id
        AND l.source = 'ORDER'
        AND i.kind = 'INVOICE'
        AND i.status <> 'VOID'
        AND i.id <> v_invoice_id
    )
  ORDER BY o.date, o.id;

  GET DIAGNOSTICS v_lines = ROW_COUNT;
  IF v_lines = 0 THEN
    DELETE FROM public.agreement_invoices WHERE id = v_invoice_id AND status = 'DRAFT';
    RAISE EXCEPTION 'NO_CHARGEABLE_ORDERS' USING errcode = 'P0001';
  END IF;

  PERFORM private.lp_invoice_recompute_totals(v_invoice_id);
  PERFORM private.lp_invoice_audit(v_invoice_id, p_actor_user_id, 'invoice.draft_built', 'DELIVERED-basis rebuilt');

  RETURN jsonb_build_object('ok', true, 'invoice_id', v_invoice_id, 'lines', v_lines, 'status', 'DRAFT');
END;
$$;

-- Defaultene er LEGACY-scopet (norsk Tripletex-generator): kanonisk global
-- skrivebane setter currency eksplisitt fra providerens billingprofil.
COMMENT ON COLUMN public.agreement_invoices.currency IS
  'Invoice currency. Canonical path (lp_invoice_build_draft) sets this explicitly from the provider billing profile. The NOK default exists ONLY for the legacy Norwegian Tripletex generators and must not be relied on by global flows.';
COMMENT ON COLUMN public.agreement_invoice_lines.currency IS
  'Line currency. Canonical path sets this explicitly (order currency, else provider billing currency). NOK default is legacy-Norwegian-generator scope only.';

COMMIT;
