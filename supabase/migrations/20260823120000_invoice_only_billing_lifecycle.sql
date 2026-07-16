-- PHASE 8 — PROVIDER→COMPANY INVOICE-ONLY BILLING LIFECYCLE (additive).
--
-- Builds the FULL invoice-only flow on the canonical provider→company track
-- (agreement_invoices/agreement_invoice_lines):
--   delivered orders → immutable invoice basis → DRAFT preview → ISSUE
--   (sequential per-provider numbering) → SENT (email, app-side) →
--   manual bank payments (idempotent) → PARTIALLY_PAID/PAID/OVERDUE →
--   credit notes (full/partial, cancellation + cross-period corrections) →
--   VOID + reissue.
--
-- Laws:
--   - Basis = DELIVERED order lines only, snapshot-immutable from order_items
--     (quantity, unit price, currency, tax rate/amount, net, gross,
--     provider/company/location). Never live menu prices.
--   - Fail-closed tenant isolation (provider owns company; company sees own).
--   - NO Stripe: payments are manual bank registrations with an idempotent
--     reconciliation import boundary (idempotency_key on invoice_payments).
--   - Tripletex remains a Norwegian ACCOUNTING ADAPTER only (app-side
--     registry) — never a global default; CSV export covers other markets.
--   - All transitions audited in billing_audit_log (actor, timestamp, before/after).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) agreement_invoices: lifecycle columns + widened status model (additive).
--    Legacy values PENDING_SYNC/SYNC_FAILED remain valid for existing rows.
-- ---------------------------------------------------------------------------
ALTER TABLE public.agreement_invoices
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'INVOICE',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NOK',
  ADD COLUMN IF NOT EXISTS issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_terms_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS location_id uuid,
  ADD COLUMN IF NOT EXISTS credit_of_invoice_id uuid REFERENCES public.agreement_invoices(id),
  ADD COLUMN IF NOT EXISTS credited_by_invoice_id uuid REFERENCES public.agreement_invoices(id);

ALTER TABLE public.agreement_invoices
  DROP CONSTRAINT IF EXISTS agreement_invoices_status_check;
ALTER TABLE public.agreement_invoices
  ADD CONSTRAINT agreement_invoices_status_check CHECK (
    status = ANY (ARRAY[
      'DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CREDITED', 'VOID',
      -- legacy sync-track values (existing rows / Tripletex path)
      'PENDING_SYNC', 'SYNC_FAILED'
    ]::text[])
  );

ALTER TABLE public.agreement_invoices
  DROP CONSTRAINT IF EXISTS agreement_invoices_kind_check;
ALTER TABLE public.agreement_invoices
  ADD CONSTRAINT agreement_invoices_kind_check CHECK (kind IN ('INVOICE', 'CREDIT_NOTE'));

COMMENT ON COLUMN public.agreement_invoices.kind IS
  'INVOICE eller CREDIT_NOTE (kreditnota peker på original via credit_of_invoice_id).';

-- ---------------------------------------------------------------------------
-- 2) agreement_invoice_lines: immutable basis references (additive).
-- ---------------------------------------------------------------------------
ALTER TABLE public.agreement_invoice_lines
  ADD COLUMN IF NOT EXISTS order_id uuid,
  ADD COLUMN IF NOT EXISTS location_id uuid,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'ORDER',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NOK',
  ADD COLUMN IF NOT EXISTS service_date date;

ALTER TABLE public.agreement_invoice_lines
  DROP CONSTRAINT IF EXISTS agreement_invoice_lines_source_check;
ALTER TABLE public.agreement_invoice_lines
  ADD CONSTRAINT agreement_invoice_lines_source_check CHECK (
    source IN ('ORDER', 'ADDITION', 'DISCOUNT', 'CORRECTION', 'CANCELLATION_CORRECTION', 'CREDIT')
  );

CREATE INDEX IF NOT EXISTS agreement_invoice_lines_order_idx
  ON public.agreement_invoice_lines (order_id) WHERE order_id IS NOT NULL;

-- Kreditnotaer/rabatter krever negative linjer: de legacy ikke-negative
-- sjekkene erstattes av fortegns-KONSISTENS (netto og MVA samme fortegn,
-- antall aldri 0). Positivitet for ORDER/ADDITION håndheves i RPC-ene.
ALTER TABLE public.agreement_invoice_lines
  DROP CONSTRAINT IF EXISTS agreement_invoice_lines_line_amount_check,
  DROP CONSTRAINT IF EXISTS agreement_invoice_lines_quantity_check,
  DROP CONSTRAINT IF EXISTS agreement_invoice_lines_unit_price_check,
  DROP CONSTRAINT IF EXISTS agreement_invoice_lines_vat_amount_check;
ALTER TABLE public.agreement_invoice_lines
  DROP CONSTRAINT IF EXISTS agreement_invoice_lines_sign_consistency_check;
ALTER TABLE public.agreement_invoice_lines
  ADD CONSTRAINT agreement_invoice_lines_sign_consistency_check CHECK (
    quantity <> 0 AND (vat_amount = 0 OR sign(vat_amount) = sign(line_amount))
  );

-- Legacy UNIQUE (agreement_id, invoice_period_start) blokkerte kreditnotaer
-- (samme periode som original) og reissue etter VOID. Erstattes av en
-- partiell unik indeks som bevarer garantien for AKTIVE fakturaer.
ALTER TABLE public.agreement_invoices
  DROP CONSTRAINT IF EXISTS agreement_invoices_agreement_id_invoice_period_start_key;
CREATE UNIQUE INDEX IF NOT EXISTS agreement_invoices_active_period_uidx
  ON public.agreement_invoices (agreement_id, invoice_period_start, invoice_period_end)
  WHERE kind = 'INVOICE' AND status <> 'VOID';

-- Kanoniske MVA-koder (referansedata; lines.tax_code_id er NOT NULL FK).
INSERT INTO public.billing_tax_codes (id, rate, tripletex_vat_code, description)
VALUES
  ('MVA_0', 0, '5', 'Fritatt / 0 %'),
  ('MVA_15', 0.15, '31', 'Næringsmidler 15 %'),
  ('MVA_25', 0.25, '3', 'Alminnelig sats 25 %')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.lp_invoice_tax_code_for_rate(p_rate numeric)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE
    WHEN coalesce(p_rate, 0) = 0 THEN 'MVA_0'
    WHEN abs(coalesce(p_rate, 0) - 0.25) < 0.001 THEN 'MVA_25'
    ELSE 'MVA_15'
  END;
$$;

-- ---------------------------------------------------------------------------
-- 3) invoice_payments — manual bank payment registration (idempotent import
--    boundary for reconciliation: idempotency_key UNIQUE).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.agreement_invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL,
  method text NOT NULL DEFAULT 'BANK' CHECK (method IN ('BANK', 'MANUAL', 'OTHER')),
  reference text,
  idempotency_key text NOT NULL UNIQUE,
  registered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_idx ON public.invoice_payments (invoice_id);
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
-- Service-role only (RPC/API-mediert) — ingen anon/authenticated policies.

-- ---------------------------------------------------------------------------
-- 4) invoice_sequences — sequential numbering per provider (legal entity) + year.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoice_sequences (
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  year integer NOT NULL,
  next_number integer NOT NULL DEFAULT 1,
  PRIMARY KEY (provider_id, year)
);
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION private.lp_invoice_next_number(p_provider_id uuid, p_kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_year integer := extract(year from current_date)::integer;
  v_n integer;
  v_slug text;
  v_prefix text := CASE WHEN p_kind = 'CREDIT_NOTE' THEN 'KN' ELSE 'F' END;
BEGIN
  SELECT upper(regexp_replace(coalesce(slug, 'PROV'), '[^a-zA-Z0-9]', '', 'g'))
  INTO v_slug FROM public.providers WHERE id = p_provider_id;
  IF v_slug IS NULL THEN RAISE EXCEPTION 'PROVIDER_NOT_FOUND' USING errcode = 'P0002'; END IF;

  INSERT INTO public.invoice_sequences (provider_id, year, next_number)
  VALUES (p_provider_id, v_year, 2)
  ON CONFLICT (provider_id, year) DO UPDATE SET next_number = public.invoice_sequences.next_number + 1
  RETURNING CASE WHEN xmax = 0 THEN 1 ELSE next_number - 1 END INTO v_n;

  RETURN format('%s-%s-%s-%s', v_prefix, v_slug, v_year, lpad(v_n::text, 4, '0'));
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Helper: recompute head totals from lines (single-currency, fail-closed).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.lp_invoice_recompute_totals(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_net numeric;
  v_tax numeric;
  v_currencies integer;
  v_currency text;
BEGIN
  SELECT coalesce(sum(line_amount), 0), coalesce(sum(vat_amount), 0),
         count(DISTINCT currency), max(currency)
  INTO v_net, v_tax, v_currencies, v_currency
  FROM public.agreement_invoice_lines WHERE invoice_id = p_invoice_id;

  IF v_currencies > 1 THEN
    RAISE EXCEPTION 'CURRENCY_MIXED' USING errcode = 'P0001';
  END IF;

  UPDATE public.agreement_invoices
  SET amount_net = round(v_net, 2),
      amount_tax = round(v_tax, 2),
      amount_total = round(v_net + v_tax, 2),
      currency = coalesce(v_currency, currency),
      updated_at = now()
  WHERE id = p_invoice_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) Helper: append-only billing audit for invoice transitions.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.lp_invoice_audit(
  p_invoice_id uuid, p_actor uuid, p_action text, p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_row public.agreement_invoices%rowtype;
BEGIN
  SELECT * INTO v_row FROM public.agreement_invoices WHERE id = p_invoice_id;
  INSERT INTO public.billing_audit_log (organization_id, actor_user_id, action, after_json, reason)
  VALUES (
    v_row.provider_id, p_actor, p_action,
    jsonb_build_object(
      'invoice_id', v_row.id, 'invoice_number', v_row.invoice_number,
      'kind', v_row.kind, 'status', v_row.status,
      'company_id', v_row.company_id, 'amount_total', v_row.amount_total,
      'amount_paid', v_row.amount_paid, 'currency', v_row.currency
    ),
    p_reason
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7) RPC: build/refresh DRAFT from DELIVERED orders (immutable snapshots).
-- ---------------------------------------------------------------------------
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
      amount_net, amount_tax, amount_total, status, kind, payment_terms_days
    ) VALUES (
      v_agreement_id, p_provider_id, p_company_id, v_location_id,
      p_period_start, p_period_end, 'monthly',
      0, 0, 0, 'DRAFT', 'INVOICE', 14
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
    coalesce(nullif(trim(o.currency_code), ''), 'NOK'),
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

-- ---------------------------------------------------------------------------
-- 8) RPC: add manual line (addition/discount/correction) to a DRAFT.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_invoice_add_line(
  p_invoice_id uuid,
  p_source text,
  p_description text,
  p_quantity integer,
  p_unit_price numeric,
  p_vat_rate numeric,
  p_actor_user_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_service_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_inv public.agreement_invoices%rowtype;
  v_source text := upper(trim(coalesce(p_source, '')));
  v_qty integer := coalesce(p_quantity, 1);
  v_net numeric;
  v_vat numeric;
  v_line_id uuid;
BEGIN
  IF v_source NOT IN ('ADDITION', 'DISCOUNT', 'CORRECTION', 'CANCELLATION_CORRECTION') THEN
    RAISE EXCEPTION 'LINE_SOURCE_INVALID' USING errcode = 'P0001';
  END IF;
  IF coalesce(trim(p_description), '') = '' THEN
    RAISE EXCEPTION 'DESCRIPTION_REQUIRED' USING errcode = 'P0001';
  END IF;
  IF v_qty = 0 OR p_unit_price IS NULL THEN
    RAISE EXCEPTION 'LINE_VALUES_INVALID' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_inv FROM public.agreement_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING errcode = 'P0002'; END IF;
  IF v_inv.status <> 'DRAFT' THEN RAISE EXCEPTION 'INVOICE_NOT_DRAFT' USING errcode = 'P0001'; END IF;

  v_net := round(v_qty * p_unit_price, 2);
  -- Rabatter/korrigeringer som skal redusere: negativt fortegn styres av
  -- unit_price (DISCOUNT håndheves negativ, ADDITION positiv — fail-closed).
  IF v_source = 'DISCOUNT' AND v_net >= 0 THEN
    v_net := -abs(v_net);
    p_unit_price := -abs(p_unit_price);
  END IF;
  IF v_source = 'ADDITION' AND v_net <= 0 THEN
    RAISE EXCEPTION 'ADDITION_MUST_BE_POSITIVE' USING errcode = 'P0001';
  END IF;
  v_vat := round(v_net * coalesce(p_vat_rate, 0), 2);

  INSERT INTO public.agreement_invoice_lines (
    invoice_id, product_key, description, quantity, unit_price, line_amount,
    vat_rate, vat_amount, tax_code_id, order_id, location_id, source, currency, service_date
  ) VALUES (
    p_invoice_id, 'CUSTOM', trim(p_description), v_qty, p_unit_price, v_net,
    coalesce(p_vat_rate, 0), v_vat, private.lp_invoice_tax_code_for_rate(coalesce(p_vat_rate, 0)),
    p_order_id, v_inv.location_id, v_source, v_inv.currency, p_service_date
  )
  RETURNING id INTO v_line_id;

  PERFORM private.lp_invoice_recompute_totals(p_invoice_id);
  PERFORM private.lp_invoice_audit(p_invoice_id, p_actor_user_id, 'invoice.line_added', v_source);

  RETURN jsonb_build_object('ok', true, 'line_id', v_line_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 9) RPC: finalize/issue (sequential numbering, due date, freeze).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_invoice_finalize(
  p_invoice_id uuid,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_inv public.agreement_invoices%rowtype;
  v_number text;
BEGIN
  SELECT * INTO v_inv FROM public.agreement_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING errcode = 'P0002'; END IF;
  IF v_inv.status = 'ISSUED' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'invoice_id', p_invoice_id, 'invoice_number', v_inv.invoice_number, 'status', 'ISSUED');
  END IF;
  IF v_inv.status <> 'DRAFT' THEN RAISE EXCEPTION 'INVOICE_NOT_DRAFT' USING errcode = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.agreement_invoice_lines WHERE invoice_id = p_invoice_id) THEN
    RAISE EXCEPTION 'INVOICE_HAS_NO_LINES' USING errcode = 'P0001';
  END IF;

  v_number := private.lp_invoice_next_number(v_inv.provider_id, v_inv.kind);

  UPDATE public.agreement_invoices
  SET status = 'ISSUED',
      invoice_number = v_number,
      issued_at = now(),
      due_date = CASE WHEN kind = 'CREDIT_NOTE' THEN current_date
                      ELSE current_date + make_interval(days => payment_terms_days) END::date,
      last_status_change = now(),
      updated_at = now()
  WHERE id = p_invoice_id;

  -- Full kreditnota → original merkes CREDITED ved utstedelse av kreditnotaen.
  IF v_inv.kind = 'CREDIT_NOTE' AND v_inv.credit_of_invoice_id IS NOT NULL
     AND coalesce((v_inv.metadata->>'full_credit')::boolean, false) THEN
    UPDATE public.agreement_invoices
    SET status = 'CREDITED',
        credited_by_invoice_id = p_invoice_id,
        last_status_change = now(),
        updated_at = now()
    WHERE id = v_inv.credit_of_invoice_id;
    PERFORM private.lp_invoice_audit(v_inv.credit_of_invoice_id, p_actor_user_id, 'invoice.credited', 'Full kreditnota utstedt');
  END IF;

  PERFORM private.lp_invoice_audit(p_invoice_id, p_actor_user_id, 'invoice.issued', v_number);
  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'invoice_id', p_invoice_id, 'invoice_number', v_number, 'status', 'ISSUED');
END;
$$;

-- ---------------------------------------------------------------------------
-- 10) RPC: mark sent (email delivery happens app-side first).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_invoice_mark_sent(
  p_invoice_id uuid,
  p_recipient_email text,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_status text;
BEGIN
  SELECT status INTO v_status FROM public.agreement_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING errcode = 'P0002'; END IF;
  IF v_status = 'SENT' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', 'SENT');
  END IF;
  IF v_status <> 'ISSUED' THEN RAISE EXCEPTION 'INVOICE_NOT_ISSUED' USING errcode = 'P0001'; END IF;

  UPDATE public.agreement_invoices
  SET status = 'SENT',
      sent_at = now(),
      email_sent_at = now(),
      recipient_email = lower(trim(coalesce(p_recipient_email, recipient_email))),
      last_status_change = now(),
      updated_at = now()
  WHERE id = p_invoice_id;

  PERFORM private.lp_invoice_audit(p_invoice_id, p_actor_user_id, 'invoice.sent', p_recipient_email);
  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'status', 'SENT');
END;
$$;

-- ---------------------------------------------------------------------------
-- 11) RPC: manual bank payment (idempotent reconciliation boundary).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_invoice_register_payment(
  p_invoice_id uuid,
  p_amount numeric,
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
  v_inv public.agreement_invoices%rowtype;
  v_inserted integer;
  v_paid numeric;
  v_new_status text;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'PAYMENT_AMOUNT_INVALID' USING errcode = 'P0001'; END IF;
  IF coalesce(trim(p_idempotency_key), '') = '' THEN RAISE EXCEPTION 'IDEMPOTENCY_KEY_REQUIRED' USING errcode = 'P0001'; END IF;

  SELECT * INTO v_inv FROM public.agreement_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING errcode = 'P0002'; END IF;
  IF v_inv.status NOT IN ('ISSUED', 'SENT', 'PARTIALLY_PAID', 'OVERDUE') THEN
    RAISE EXCEPTION 'INVOICE_NOT_PAYABLE' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.invoice_payments (invoice_id, amount, paid_at, method, reference, idempotency_key, registered_by)
  VALUES (
    p_invoice_id, round(p_amount, 2), coalesce(p_paid_at, now()),
    CASE WHEN upper(coalesce(p_method, 'BANK')) IN ('BANK', 'MANUAL', 'OTHER') THEN upper(coalesce(p_method, 'BANK')) ELSE 'BANK' END,
    nullif(trim(coalesce(p_reference, '')), ''), trim(p_idempotency_key), p_actor_user_id
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT coalesce(sum(amount), 0) INTO v_paid FROM public.invoice_payments WHERE invoice_id = p_invoice_id;
  v_new_status := CASE WHEN v_paid >= v_inv.amount_total THEN 'PAID' ELSE 'PARTIALLY_PAID' END;

  UPDATE public.agreement_invoices
  SET amount_paid = round(v_paid, 2),
      status = v_new_status,
      paid_at = CASE WHEN v_new_status = 'PAID' THEN coalesce(p_paid_at, now()) ELSE paid_at END,
      last_status_change = CASE WHEN status <> v_new_status THEN now() ELSE last_status_change END,
      updated_at = now()
  WHERE id = p_invoice_id;

  IF v_inserted > 0 THEN
    PERFORM private.lp_invoice_audit(p_invoice_id, p_actor_user_id, 'invoice.payment_registered', p_reference);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'idempotent', v_inserted = 0,
    'amount_paid', round(v_paid, 2), 'status', v_new_status
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 12) RPC: refresh OVERDUE (set-based, deterministic).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_invoice_refresh_overdue(p_provider_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.agreement_invoices
  SET status = 'OVERDUE', last_status_change = now(), updated_at = now()
  WHERE kind = 'INVOICE'
    AND status IN ('ISSUED', 'SENT', 'PARTIALLY_PAID')
    AND due_date IS NOT NULL AND due_date < current_date
    AND (p_provider_id IS NULL OR provider_id = p_provider_id);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'marked_overdue', v_count);
END;
$$;

-- ---------------------------------------------------------------------------
-- 13) RPC: create credit note (full/partial; cancellation + cross-period
--     corrections via order subset or manual correction lines on the draft).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_invoice_create_credit_note(
  p_invoice_id uuid,
  p_reason text,
  p_actor_user_id uuid DEFAULT NULL,
  p_order_ids uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_inv public.agreement_invoices%rowtype;
  v_credit_id uuid;
  v_full boolean;
  v_lines integer;
BEGIN
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'REASON_REQUIRED' USING errcode = 'P0001'; END IF;

  SELECT * INTO v_inv FROM public.agreement_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING errcode = 'P0002'; END IF;
  IF v_inv.kind <> 'INVOICE' THEN RAISE EXCEPTION 'NOT_AN_INVOICE' USING errcode = 'P0001'; END IF;
  IF v_inv.status NOT IN ('ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE') THEN
    RAISE EXCEPTION 'INVOICE_NOT_CREDITABLE' USING errcode = 'P0001';
  END IF;

  v_full := p_order_ids IS NULL;

  INSERT INTO public.agreement_invoices (
    agreement_id, provider_id, company_id, location_id,
    invoice_period_start, invoice_period_end, billing_cycle,
    amount_net, amount_tax, amount_total, status, kind,
    payment_terms_days, currency, credit_of_invoice_id, metadata
  ) VALUES (
    v_inv.agreement_id, v_inv.provider_id, v_inv.company_id, v_inv.location_id,
    v_inv.invoice_period_start, v_inv.invoice_period_end, v_inv.billing_cycle,
    0, 0, 0, 'DRAFT', 'CREDIT_NOTE',
    0, v_inv.currency, v_inv.id,
    jsonb_build_object('full_credit', v_full, 'reason', trim(p_reason))
  )
  RETURNING id INTO v_credit_id;

  INSERT INTO public.agreement_invoice_lines (
    invoice_id, product_key, description, quantity, unit_price, line_amount,
    vat_rate, vat_amount, tax_code_id, order_id, location_id, source, currency, service_date
  )
  SELECT
    v_credit_id, l.product_key, 'KREDIT: ' || l.description,
    -l.quantity, l.unit_price, -l.line_amount,
    l.vat_rate, -l.vat_amount, l.tax_code_id, l.order_id, l.location_id, 'CREDIT', l.currency, l.service_date
  FROM public.agreement_invoice_lines l
  WHERE l.invoice_id = p_invoice_id
    AND (p_order_ids IS NULL OR l.order_id = ANY (p_order_ids));

  GET DIAGNOSTICS v_lines = ROW_COUNT;
  IF v_lines = 0 THEN RAISE EXCEPTION 'NO_LINES_TO_CREDIT' USING errcode = 'P0001'; END IF;

  PERFORM private.lp_invoice_recompute_totals(v_credit_id);
  PERFORM private.lp_invoice_audit(v_credit_id, p_actor_user_id, 'invoice.credit_note_created', trim(p_reason));

  RETURN jsonb_build_object('ok', true, 'credit_note_id', v_credit_id, 'lines', v_lines, 'full_credit', v_full);
END;
$$;

-- ---------------------------------------------------------------------------
-- 14) RPC: void (controlled — never after payment) → frees orders for reissue.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_invoice_void(
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
  v_inv public.agreement_invoices%rowtype;
BEGIN
  IF coalesce(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'REASON_REQUIRED' USING errcode = 'P0001'; END IF;
  SELECT * INTO v_inv FROM public.agreement_invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_FOUND' USING errcode = 'P0002'; END IF;
  IF v_inv.status = 'VOID' THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', 'VOID');
  END IF;
  IF v_inv.status NOT IN ('DRAFT', 'ISSUED') OR v_inv.amount_paid > 0 THEN
    RAISE EXCEPTION 'INVOICE_NOT_VOIDABLE' USING errcode = 'P0001';
  END IF;

  UPDATE public.agreement_invoices
  SET status = 'VOID', last_status_change = now(), updated_at = now(),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('void_reason', trim(p_reason))
  WHERE id = p_invoice_id;

  PERFORM private.lp_invoice_audit(p_invoice_id, p_actor_user_id, 'invoice.voided', trim(p_reason));
  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'status', 'VOID');
END;
$$;

-- ---------------------------------------------------------------------------
-- 15) Grants: service_role only (API-lag håndhever provider/company-scope).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.lp_invoice_build_draft(uuid, uuid, date, date, uuid)',
    'public.lp_invoice_add_line(uuid, text, text, integer, numeric, numeric, uuid, uuid, date)',
    'public.lp_invoice_finalize(uuid, uuid)',
    'public.lp_invoice_mark_sent(uuid, text, uuid)',
    'public.lp_invoice_register_payment(uuid, numeric, timestamptz, text, text, text, uuid)',
    'public.lp_invoice_refresh_overdue(uuid)',
    'public.lp_invoice_create_credit_note(uuid, text, uuid, uuid[])',
    'public.lp_invoice_void(uuid, text, uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role, postgres', fn);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION private.lp_invoice_next_number(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.lp_invoice_recompute_totals(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.lp_invoice_audit(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;

COMMIT;
