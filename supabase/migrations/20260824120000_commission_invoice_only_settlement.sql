-- PHASE 9 — PLATFORM COMMISSION INVOICE-ONLY SETTLEMENT (additive).
--
-- Kanonisk regel: Lunchportalen tar 5 % (LP_GLOBAL_5P, 500 bps — allerede
-- seedet) av providerens NETTO lunsjsalg ekskl. MVA. Alt i integer minor
-- units (aldri float), valuta bevart per provider, append-only ledger.
--
-- Denne migrasjonen fullfører oppgjøret UTEN Stripe:
--   - forfallsdato + manuelle bankbetalinger (idempotent import-grense)
--   - partially_paid / overdue / credited i betalingsmodellen
--   - kreditfaktura (negativ speiling, der det er juridisk tillatt)
--   - sekvensiell fakturanummerering for plattformens juridiske enhet
--   - LUKKET PERIODE ER IMMUTABEL: sene posteringer/korrigeringer
--     omdirigeres deterministisk til inneværende (åpen) periode.
-- Stripe-kolonnene (payment_provider_*) forblir DORMANTE — ingen kodesti
-- her leser eller skriver dem.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) provider_commission_invoices: oppgjørsfelter (additivt) + utvidet modell.
-- ---------------------------------------------------------------------------
ALTER TABLE public.provider_commission_invoices
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS payment_terms_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS amount_paid_minor bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'COMMISSION',
  ADD COLUMN IF NOT EXISTS credit_of_invoice_id uuid REFERENCES public.provider_commission_invoices(id),
  ADD COLUMN IF NOT EXISTS credited_by_invoice_id uuid REFERENCES public.provider_commission_invoices(id);

ALTER TABLE public.provider_commission_invoices
  DROP CONSTRAINT IF EXISTS provider_commission_invoices_kind_chk;
ALTER TABLE public.provider_commission_invoices
  ADD CONSTRAINT provider_commission_invoices_kind_chk CHECK (kind IN ('COMMISSION', 'CREDIT'));

ALTER TABLE public.provider_commission_invoices
  DROP CONSTRAINT IF EXISTS provider_commission_invoices_payment_status_chk;
ALTER TABLE public.provider_commission_invoices
  ADD CONSTRAINT provider_commission_invoices_payment_status_chk CHECK (
    payment_status IN (
      'draft', 'pending', 'processing', 'partially_paid', 'paid',
      'overdue', 'credited', 'failed', 'action_required', 'void'
    )
  );

-- Kreditfakturaer er negative speilinger — fortegn styres av kind.
ALTER TABLE public.provider_commission_invoices
  DROP CONSTRAINT IF EXISTS provider_commission_invoices_amount_chk;
ALTER TABLE public.provider_commission_invoices
  ADD CONSTRAINT provider_commission_invoices_amount_chk CHECK (
    (kind = 'COMMISSION' AND amount_ex_tax_minor >= 0 AND tax_amount_minor >= 0 AND total_amount_minor >= 0)
    OR
    (kind = 'CREDIT' AND amount_ex_tax_minor <= 0 AND tax_amount_minor <= 0 AND total_amount_minor <= 0)
  );

-- Én KOMMISJONS-faktura per periode; kreditfakturaer refererer samme periode.
ALTER TABLE public.provider_commission_invoices
  DROP CONSTRAINT IF EXISTS provider_commission_invoices_period_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS provider_commission_invoices_period_commission_uidx
  ON public.provider_commission_invoices (commission_period_id)
  WHERE kind = 'COMMISSION';

-- ---------------------------------------------------------------------------
-- 2) Manuelle bankbetalinger — idempotent avstemmings-grense (minor units).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commission_invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.provider_commission_invoices(id) ON DELETE CASCADE,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  paid_at timestamptz NOT NULL,
  method text NOT NULL DEFAULT 'BANK' CHECK (method IN ('BANK', 'MANUAL', 'OTHER')),
  reference text,
  idempotency_key text NOT NULL UNIQUE,
  registered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commission_invoice_payments_invoice_idx
  ON public.commission_invoice_payments (invoice_id);
ALTER TABLE public.commission_invoice_payments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3) Sekvensiell nummerering for plattformens juridiske enhet (global per år).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commission_invoice_sequences (
  year integer PRIMARY KEY,
  next_number integer NOT NULL DEFAULT 1
);
ALTER TABLE public.commission_invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.lp_commission_invoice_next_number(p_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_year integer := extract(year from current_date)::integer;
  v_n integer;
BEGIN
  INSERT INTO public.commission_invoice_sequences (year, next_number)
  VALUES (v_year, 2)
  ON CONFLICT (year) DO UPDATE SET next_number = public.commission_invoice_sequences.next_number + 1
  RETURNING CASE WHEN xmax = 0 THEN 1 ELSE next_number - 1 END INTO v_n;

  RETURN format('%s-%s-%s', CASE WHEN p_kind = 'CREDIT' THEN 'LPKN' ELSE 'LPK' END, v_year, lpad(v_n::text, 4, '0'));
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Lukket periode er immutabel: sene posteringer → inneværende periode.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.lp_billing_effective_period(
  p_provider_id uuid,
  p_currency text,
  p_natural_period text
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_tz text;
  v_current text;
BEGIN
  -- Naturlig periode brukes med mindre den allerede er lukket/fakturert/betalt
  -- for provider+valuta — da går posteringen til inneværende periode (krav 9–10).
  IF p_natural_period IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.commission_periods cp
    WHERE cp.provider_id = p_provider_id
      AND cp.currency = upper(trim(coalesce(p_currency, '')))
      AND to_char(cp.period_start, 'YYYY-MM') = p_natural_period
      AND cp.status IN ('closed', 'invoiced', 'paid')
  ) THEN
    RETURN p_natural_period;
  END IF;

  SELECT obp.billing_timezone INTO v_tz
  FROM public.organization_billing_profiles obp
  WHERE obp.organization_id = p_provider_id;

  v_current := to_char(now() AT TIME ZONE coalesce(nullif(trim(v_tz), ''), 'UTC'), 'YYYY-MM');
  RETURN v_current;
END;
$$;

-- 4a) ORDER_COMPLETED-postering (leverte ordre) med perioderedirect.
CREATE OR REPLACE FUNCTION private.lp_billing_post_delivered_commission_unchecked(
  p_order_id uuid,
  p_actor_user_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'order delivered'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
DECLARE
  v_snapshot record;
  v_inserted integer := 0;
  v_rows integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.status = 'DELIVERED'::public.order_status
  ) THEN
    RAISE EXCEPTION 'ORDER_NOT_DELIVERED';
  END IF;

  FOR v_snapshot IN
    SELECT s.*
    FROM public.order_line_commercial_snapshots s
    JOIN public.order_items oi
      ON oi.id = s.order_line_id
     AND oi.order_id = s.order_id
    WHERE s.order_id = p_order_id
    ORDER BY s.order_line_id
  LOOP
    INSERT INTO public.commission_ledger (
      provider_id,
      organization_id,
      order_id,
      order_line_id,
      event_type,
      commission_rule_id,
      commission_rate_bps,
      market_id,
      country_code,
      tax_country_code,
      currency,
      commission_basis_amount_minor,
      commission_amount_exact,
      billing_period,
      idempotency_key,
      reason,
      created_by
    )
    VALUES (
      v_snapshot.provider_id,
      v_snapshot.organization_id,
      v_snapshot.order_id,
      v_snapshot.order_line_id,
      'ORDER_COMPLETED',
      v_snapshot.commission_rule_id,
      v_snapshot.commission_rate_bps,
      v_snapshot.market_id,
      v_snapshot.country_code,
      v_snapshot.tax_country_code,
      v_snapshot.currency,
      v_snapshot.line_subtotal_ex_tax_minor,
      (v_snapshot.line_subtotal_ex_tax_minor::numeric * v_snapshot.commission_rate_bps::numeric) / 10000,
      private.lp_billing_effective_period(
        v_snapshot.provider_id,
        v_snapshot.currency,
        (
          SELECT to_char(v_snapshot.ordered_at AT TIME ZONE obp.billing_timezone, 'YYYY-MM')
          FROM public.organization_billing_profiles obp
          WHERE obp.organization_id = v_snapshot.provider_id
        )
      ),
      concat('commission:ORDER_COMPLETED:', v_snapshot.order_id, ':', v_snapshot.order_line_id),
      p_reason,
      p_actor_user_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_inserted := v_inserted + v_rows;
  END LOOP;

  RETURN v_inserted;
END;
$$;

-- 4b) Negative korrigeringer (kansellering/refusjon) med perioderedirect:
--     sen korrigering går til NESTE (inneværende) periode når originalen er lukket.
CREATE OR REPLACE FUNCTION public.lp_billing_post_negative_commission_for_order(
  p_order_id uuid,
  p_event_type text,
  p_reason text,
  p_reference_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
DECLARE
  v_event_type text := upper(trim(coalesce(p_event_type, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_reference_id text := nullif(trim(coalesce(p_reference_id, '')), '');
  v_completed record;
  v_inserted integer := 0;
  v_rows integer := 0;
  v_provider_id uuid;
  v_idempotency_key text;
BEGIN
  IF NOT public.is_platform_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'COMMISSION_CORRECTION_FORBIDDEN';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_ID_REQUIRED';
  END IF;

  IF v_event_type NOT IN ('ORDER_CANCELLED', 'ORDER_REFUNDED', 'ORDER_CORRECTED', 'CREDIT_NOTE') THEN
    RAISE EXCEPTION 'NEGATIVE_COMMISSION_EVENT_UNSUPPORTED';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'NEGATIVE_COMMISSION_REASON_REQUIRED';
  END IF;

  IF v_event_type IN ('ORDER_REFUNDED', 'ORDER_CORRECTED', 'CREDIT_NOTE')
     AND v_reference_id IS NULL THEN
    RAISE EXCEPTION 'NEGATIVE_COMMISSION_REFERENCE_REQUIRED';
  END IF;

  SELECT cl.provider_id
  INTO v_provider_id
  FROM public.commission_ledger cl
  WHERE cl.order_id = p_order_id
    AND cl.event_type = 'ORDER_COMPLETED'
  ORDER BY cl.created_at ASC
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    SELECT o.provider_id INTO v_provider_id
    FROM public.orders o
    WHERE o.id = p_order_id;

    PERFORM private.lp_billing_record_ledger_skip_unchecked(
      v_provider_id,
      p_order_id,
      v_event_type,
      v_reason,
      v_reference_id
    );

    RETURN 0;
  END IF;

  FOR v_completed IN
    SELECT cl.*
    FROM public.commission_ledger cl
    WHERE cl.order_id = p_order_id
      AND cl.event_type = 'ORDER_COMPLETED'
    ORDER BY cl.order_line_id
  LOOP
    v_idempotency_key := CASE
      WHEN v_event_type = 'ORDER_CANCELLED' THEN
        concat('commission:ORDER_CANCELLED:', v_completed.order_id, ':', v_completed.order_line_id)
      WHEN v_event_type = 'ORDER_REFUNDED' THEN
        concat('commission:ORDER_REFUNDED:', v_completed.order_id, ':', v_completed.order_line_id, ':', v_reference_id)
      WHEN v_event_type = 'ORDER_CORRECTED' THEN
        concat('commission:ORDER_CORRECTED:', v_completed.order_id, ':', v_completed.order_line_id, ':', v_reference_id)
      WHEN v_event_type = 'CREDIT_NOTE' THEN
        concat('commission:CREDIT_NOTE:', v_reference_id, ':', v_completed.order_id, ':', v_completed.order_line_id)
      ELSE
        NULL
    END;

    INSERT INTO public.commission_ledger (
      provider_id,
      organization_id,
      order_id,
      order_line_id,
      event_type,
      commission_rule_id,
      commission_rate_bps,
      market_id,
      country_code,
      tax_country_code,
      currency,
      commission_basis_amount_minor,
      commission_amount_exact,
      billing_period,
      idempotency_key,
      reason,
      created_by
    )
    VALUES (
      v_completed.provider_id,
      v_completed.organization_id,
      v_completed.order_id,
      v_completed.order_line_id,
      v_event_type,
      v_completed.commission_rule_id,
      v_completed.commission_rate_bps,
      v_completed.market_id,
      v_completed.country_code,
      v_completed.tax_country_code,
      v_completed.currency,
      -abs(v_completed.commission_basis_amount_minor),
      -abs(v_completed.commission_amount_exact),
      private.lp_billing_effective_period(
        v_completed.provider_id,
        v_completed.currency,
        v_completed.billing_period
      ),
      v_idempotency_key,
      v_reason,
      auth.uid()
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_inserted := v_inserted + v_rows;
  END LOOP;

  IF v_inserted > 0 THEN
    INSERT INTO public.billing_audit_log (
      organization_id,
      actor_user_id,
      action,
      after_json,
      reason
    )
    VALUES (
      v_provider_id,
      auth.uid(),
      'commission_ledger.negative_event_posted',
      jsonb_build_object(
        'order_id', p_order_id,
        'event_type', v_event_type,
        'reference_id', v_reference_id,
        'inserted', v_inserted
      ),
      v_reason
    );
  END IF;

  RETURN v_inserted;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) RPC: utsted (nummer + forfall) — idempotent.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_commission_invoice_issue(
  p_invoice_id uuid,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_inv public.provider_commission_invoices%rowtype;
  v_number text;
BEGIN
  SELECT * INTO v_inv FROM public.provider_commission_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'COMMISSION_INVOICE_NOT_FOUND' USING errcode = 'P0002'; END IF;
  IF v_inv.invoice_number IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'invoice_number', v_inv.invoice_number, 'due_date', v_inv.due_date);
  END IF;
  IF v_inv.payment_status NOT IN ('pending', 'draft') THEN
    RAISE EXCEPTION 'COMMISSION_INVOICE_NOT_ISSUABLE' USING errcode = 'P0001';
  END IF;

  v_number := private.lp_commission_invoice_next_number(v_inv.kind);

  UPDATE public.provider_commission_invoices
  SET invoice_number = v_number,
      payment_status = CASE WHEN payment_status = 'draft' THEN 'pending' ELSE payment_status END,
      due_date = coalesce(due_date, (coalesce(issued_at, now())::date + payment_terms_days)),
      updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO public.billing_audit_log (organization_id, actor_user_id, action, after_json, reason)
  VALUES (v_inv.provider_id, p_actor_user_id, 'provider_commission_invoice.issued',
          jsonb_build_object('invoice_id', p_invoice_id, 'invoice_number', v_number), 'invoice-only issue');

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'invoice_number', v_number);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) RPC: manuell bankbetaling (idempotent, minor units, valuta-vokter).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_commission_invoice_register_payment(
  p_invoice_id uuid,
  p_amount_minor bigint,
  p_paid_at timestamptz,
  p_method text,
  p_reference text,
  p_idempotency_key text,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_inv public.provider_commission_invoices%rowtype;
  v_inserted integer;
  v_paid bigint;
  v_new_status text;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN RAISE EXCEPTION 'PAYMENT_AMOUNT_INVALID' USING errcode = 'P0001'; END IF;
  IF coalesce(trim(p_idempotency_key), '') = '' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING errcode = 'P0001'; END IF;

  SELECT * INTO v_inv FROM public.provider_commission_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'COMMISSION_INVOICE_NOT_FOUND' USING errcode = 'P0002'; END IF;
  IF v_inv.kind <> 'COMMISSION' THEN RAISE EXCEPTION 'COMMISSION_INVOICE_NOT_PAYABLE' USING errcode = 'P0001'; END IF;
  IF v_inv.payment_status NOT IN ('pending', 'partially_paid', 'overdue') THEN
    RAISE EXCEPTION 'COMMISSION_INVOICE_NOT_PAYABLE' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.commission_invoice_payments (invoice_id, amount_minor, currency, paid_at, method, reference, idempotency_key, registered_by)
  VALUES (
    p_invoice_id, p_amount_minor, v_inv.currency, coalesce(p_paid_at, now()),
    CASE WHEN upper(coalesce(p_method, 'BANK')) IN ('BANK', 'MANUAL', 'OTHER') THEN upper(coalesce(p_method, 'BANK')) ELSE 'BANK' END,
    nullif(trim(coalesce(p_reference, '')), ''), trim(p_idempotency_key), p_actor_user_id
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT coalesce(sum(amount_minor), 0) INTO v_paid FROM public.commission_invoice_payments WHERE invoice_id = p_invoice_id;
  v_new_status := CASE WHEN v_paid >= v_inv.total_amount_minor THEN 'paid' ELSE 'partially_paid' END;

  UPDATE public.provider_commission_invoices
  SET amount_paid_minor = v_paid,
      payment_status = v_new_status,
      paid_at = CASE WHEN v_new_status = 'paid' THEN coalesce(p_paid_at, now()) ELSE paid_at END,
      updated_at = now()
  WHERE id = p_invoice_id;

  IF v_inserted > 0 THEN
    INSERT INTO public.billing_audit_log (organization_id, actor_user_id, action, after_json, reason)
    VALUES (v_inv.provider_id, p_actor_user_id, 'provider_commission_invoice.payment_registered',
            jsonb_build_object('invoice_id', p_invoice_id, 'amount_minor', p_amount_minor, 'paid_total_minor', v_paid, 'status', v_new_status),
            coalesce(p_reference, 'manual bank payment'));
  END IF;

  RETURN jsonb_build_object('ok', true, 'idempotent', v_inserted = 0, 'amount_paid_minor', v_paid, 'payment_status', v_new_status);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) RPC: forfalls-oppdatering (retry-safe, set-basert).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_commission_invoice_refresh_overdue()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.provider_commission_invoices
  SET payment_status = 'overdue', updated_at = now()
  WHERE kind = 'COMMISSION'
    AND payment_status IN ('pending', 'partially_paid')
    AND due_date IS NOT NULL AND due_date < current_date;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'marked_overdue', v_count);
END;
$$;

-- ---------------------------------------------------------------------------
-- 8) RPC: kreditfaktura (negativ speiling; original merkes credited).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_commission_invoice_create_credit(
  p_invoice_id uuid,
  p_reason text,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_inv public.provider_commission_invoices%rowtype;
  v_credit_id uuid;
  v_number text;
BEGIN
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'REASON_REQUIRED' USING errcode = 'P0001'; END IF;

  SELECT * INTO v_inv FROM public.provider_commission_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'COMMISSION_INVOICE_NOT_FOUND' USING errcode = 'P0002'; END IF;
  IF v_inv.kind <> 'COMMISSION' THEN RAISE EXCEPTION 'NOT_A_COMMISSION_INVOICE' USING errcode = 'P0001'; END IF;
  IF v_inv.payment_status NOT IN ('pending', 'partially_paid', 'overdue', 'paid') THEN
    RAISE EXCEPTION 'COMMISSION_INVOICE_NOT_CREDITABLE' USING errcode = 'P0001';
  END IF;

  v_number := private.lp_commission_invoice_next_number('CREDIT');

  INSERT INTO public.provider_commission_invoices (
    provider_id, organization_id, commission_period_id, invoice_number,
    amount_ex_tax_minor, tax_amount_minor, total_amount_minor, currency,
    billing_email_snapshot, admin_email_snapshot, sent_to_emails_snapshot,
    payment_status, issued_at, kind, credit_of_invoice_id, payment_terms_days, due_date
  ) VALUES (
    v_inv.provider_id, v_inv.organization_id, v_inv.commission_period_id, v_number,
    -abs(v_inv.amount_ex_tax_minor), -abs(v_inv.tax_amount_minor), -abs(v_inv.total_amount_minor), v_inv.currency,
    v_inv.billing_email_snapshot, v_inv.admin_email_snapshot, v_inv.sent_to_emails_snapshot,
    'credited', now(), 'CREDIT', v_inv.id, 0, current_date
  )
  RETURNING id INTO v_credit_id;

  UPDATE public.provider_commission_invoices
  SET payment_status = 'credited', credited_by_invoice_id = v_credit_id, updated_at = now()
  WHERE id = p_invoice_id;

  INSERT INTO public.billing_audit_log (organization_id, actor_user_id, action, after_json, reason)
  VALUES (v_inv.provider_id, p_actor_user_id, 'provider_commission_invoice.credited',
          jsonb_build_object('invoice_id', p_invoice_id, 'credit_invoice_id', v_credit_id, 'credit_number', v_number),
          trim(p_reason));

  RETURN jsonb_build_object('ok', true, 'credit_invoice_id', v_credit_id, 'credit_number', v_number);
END;
$$;

-- ---------------------------------------------------------------------------
-- 9) Grants: service_role only for oppgjørs-RPC-ene.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.lp_commission_invoice_issue(uuid, uuid)',
    'public.lp_commission_invoice_register_payment(uuid, bigint, timestamptz, text, text, text, uuid)',
    'public.lp_commission_invoice_refresh_overdue()',
    'public.lp_commission_invoice_create_credit(uuid, text, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role, postgres', fn);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION private.lp_commission_invoice_next_number(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.lp_billing_effective_period(uuid, text, text) FROM PUBLIC, anon, authenticated;

COMMIT;
