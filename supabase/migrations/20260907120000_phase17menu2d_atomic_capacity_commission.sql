-- PHASE 17MENU.2D — Atomic dish-day capacity + commission exact_numerator ledger fields.
-- Staging-first. Capacity enforced only when a dish_day_capacity row exists (opt-in pools).
-- Protected Golden Path Impact: lp_order_set unchanged; capacity via order_items triggers.
-- Commission: additive columns + write path for exact integer numerator (bps×net).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Atomic capacity pool (provider + date + choice slug)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dish_day_capacity (
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  choice_key text NOT NULL,
  capacity_limit integer NOT NULL CHECK (capacity_limit >= 0),
  reserved_qty integer NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, service_date, choice_key),
  CONSTRAINT dish_day_capacity_reserved_le_limit CHECK (reserved_qty <= capacity_limit)
);

CREATE TABLE IF NOT EXISTS public.dish_day_capacity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  service_date date NOT NULL,
  choice_key text NOT NULL,
  order_id uuid,
  user_id uuid,
  delta integer NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('RESERVE', 'RELEASE')),
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dish_day_capacity_events_idem UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS dish_day_capacity_events_order_idx
  ON public.dish_day_capacity_events (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dish_day_capacity_events_pool_idx
  ON public.dish_day_capacity_events (provider_id, service_date, choice_key);

COMMENT ON TABLE public.dish_day_capacity IS
  '17MENU.2D atomic capacity pools. Absence of a row = unlimited (no enforcement).';

CREATE OR REPLACE FUNCTION public.lp_capacity_try_reserve(
  p_provider_id uuid,
  p_service_date date,
  p_choice_key text,
  p_qty integer,
  p_order_id uuid,
  p_user_id uuid,
  p_idempotency_key text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_limit integer;
  v_reserved integer;
  v_key text;
  v_choice text := lower(trim(coalesce(p_choice_key, '')));
BEGIN
  IF p_provider_id IS NULL OR p_service_date IS NULL OR v_choice = '' THEN
    RETURN true;
  END IF;
  IF coalesce(p_qty, 0) <= 0 THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'CAPACITY_QTY_INVALID';
  END IF;

  -- Idempotent: net state for this order is already RESERVE (latest event)
  IF p_order_id IS NOT NULL AND (
    SELECT e.event_type
    FROM public.dish_day_capacity_events e
    WHERE e.order_id = p_order_id
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 1
  ) = 'RESERVE' THEN
    RETURN true;
  END IF;

  -- Unique event key per reserve attempt (order rebinds after RELEASE must re-increment).
  v_key := coalesce(
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    'cap:reserve:' || coalesce(p_order_id::text, 'none') || ':' || replace(gen_random_uuid()::text, '-', '')
  );

  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.dish_day_capacity_events e WHERE e.idempotency_key = v_key
  ) THEN
    RETURN true;
  END IF;

  SELECT c.capacity_limit, c.reserved_qty
    INTO v_limit, v_reserved
  FROM public.dish_day_capacity c
  WHERE c.provider_id = p_provider_id
    AND c.service_date = p_service_date
    AND c.choice_key = v_choice
  FOR UPDATE;

  -- No pool row → not capacity-governed
  IF NOT FOUND THEN
    RETURN true;
  END IF;

  IF v_reserved + p_qty > v_limit THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'CAPACITY_EXCEEDED';
  END IF;

  UPDATE public.dish_day_capacity
  SET reserved_qty = reserved_qty + p_qty,
      updated_at = now()
  WHERE provider_id = p_provider_id
    AND service_date = p_service_date
    AND choice_key = v_choice;

  INSERT INTO public.dish_day_capacity_events (
    provider_id, service_date, choice_key, order_id, user_id, delta, event_type, idempotency_key
  ) VALUES (
    p_provider_id, p_service_date, v_choice, p_order_id, p_user_id, p_qty, 'RESERVE', v_key
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_capacity_release(
  p_order_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_ev record;
  v_key text;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN true;
  END IF;

  -- Only release when latest event is RESERVE
  SELECT e.*
    INTO v_ev
  FROM public.dish_day_capacity_events e
  WHERE e.order_id = p_order_id
  ORDER BY e.created_at DESC, e.id DESC
  LIMIT 1;

  IF NOT FOUND OR v_ev.event_type IS DISTINCT FROM 'RESERVE' THEN
    RETURN true;
  END IF;

  v_key := coalesce(
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    'cap:release:' || p_order_id::text || ':' || replace(gen_random_uuid()::text, '-', '')
  );

  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.dish_day_capacity_events e WHERE e.idempotency_key = v_key
  ) THEN
    RETURN true;
  END IF;

  UPDATE public.dish_day_capacity c
  SET reserved_qty = GREATEST(0, c.reserved_qty - v_ev.delta),
      updated_at = now()
  WHERE c.provider_id = v_ev.provider_id
    AND c.service_date = v_ev.service_date
    AND c.choice_key = v_ev.choice_key;

  INSERT INTO public.dish_day_capacity_events (
    provider_id, service_date, choice_key, order_id, user_id, delta, event_type, idempotency_key
  ) VALUES (
    v_ev.provider_id, v_ev.service_date, v_ev.choice_key, p_order_id, p_user_id, -v_ev.delta, 'RELEASE', v_key
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_order_items_capacity_reserve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_order record;
  v_provider uuid;
  v_choice text;
BEGIN
  SELECT o.* INTO v_order FROM public.orders o WHERE o.id = NEW.order_id;
  IF NOT FOUND OR v_order.status IS DISTINCT FROM 'ACTIVE'::public.order_status THEN
    RETURN NEW;
  END IF;

  SELECT c.provider_id INTO v_provider
  FROM public.companies c
  WHERE c.id = v_order.company_id;

  IF v_provider IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT regexp_replace(
    lower(translate(trim(pc.name), 'æøåÆØÅ', 'eoaEOA')),
    '[^a-z0-9]+', '', 'g'
  )
    INTO v_choice
  FROM public.products pr
  JOIN public.product_categories pc ON pc.id = pr.category_id
  WHERE pr.id = NEW.product_id;

  IF v_choice IS NULL OR v_choice = '' THEN
    RETURN NEW;
  END IF;

  PERFORM public.lp_capacity_try_reserve(
    v_provider,
    v_order.date,
    v_choice,
    coalesce(NEW.quantity, 1),
    NEW.order_id,
    v_order.user_id,
    NULL
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_order_items_capacity_release()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_order record;
BEGIN
  SELECT o.* INTO v_order FROM public.orders o WHERE o.id = OLD.order_id;
  -- Release when items removed (cancel path deletes items before status flip)
  PERFORM public.lp_capacity_release(OLD.order_id, v_order.user_id, NULL);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_capacity_reserve ON public.order_items;
CREATE TRIGGER trg_order_items_capacity_reserve
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.tg_order_items_capacity_reserve();

DROP TRIGGER IF EXISTS trg_order_items_capacity_release ON public.order_items;
CREATE TRIGGER trg_order_items_capacity_release
  AFTER DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE PROCEDURE public.tg_order_items_capacity_release();

GRANT EXECUTE ON FUNCTION public.lp_capacity_try_reserve(uuid, date, text, integer, uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lp_capacity_release(uuid, uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) Commission ledger exact numerator (additive)
-- ---------------------------------------------------------------------------
ALTER TABLE public.commission_ledger
  ADD COLUMN IF NOT EXISTS exact_numerator bigint,
  ADD COLUMN IF NOT EXISTS denominator integer NOT NULL DEFAULT 10000,
  ADD COLUMN IF NOT EXISTS price_version text,
  ADD COLUMN IF NOT EXISTS package_key text,
  ADD COLUMN IF NOT EXISTS reversal_of uuid REFERENCES public.commission_ledger(id),
  ADD COLUMN IF NOT EXISTS calculation_checksum text,
  ADD COLUMN IF NOT EXISTS source_event text;

COMMENT ON COLUMN public.commission_ledger.exact_numerator IS
  'Integer exact numerator = commission_basis_amount_minor * commission_rate_bps (never float).';

-- Backfill existing rows where possible
UPDATE public.commission_ledger
SET exact_numerator = (commission_basis_amount_minor::bigint * commission_rate_bps::bigint),
    denominator = 10000,
    source_event = coalesce(source_event, event_type)
WHERE exact_numerator IS NULL
  AND commission_basis_amount_minor IS NOT NULL
  AND commission_rate_bps IS NOT NULL;

-- Align with existing commission_remainder_carry (period_key / commission_invoice_minor).
ALTER TABLE public.commission_remainder_carry
  ADD COLUMN IF NOT EXISTS settled_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS commission_remainder_carry_idem_uidx
  ON public.commission_remainder_carry (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.lp_billing_settle_period_remainder(
  p_provider_id uuid,
  p_currency text,
  p_billing_period text,
  p_carry_in bigint DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_prev_carry bigint := 0;
  v_earned bigint := 0;
  v_reversed bigint := 0;
  v_period bigint;
  v_invoice bigint;
  v_carry_out bigint;
  v_key text;
  v_existing uuid;
BEGIN
  v_key := coalesce(
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    format('settle:%s:%s:%s', p_provider_id, p_currency, p_billing_period)
  );

  SELECT c.id INTO v_existing
  FROM public.commission_remainder_carry c
  WHERE c.idempotency_key = v_key
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN (
      SELECT jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'carry_in', c.carry_in,
        'carry_out', c.carry_out,
        'invoice_minor', c.commission_invoice_minor,
        'period_numerator', c.period_numerator
      )
      FROM public.commission_remainder_carry c
      WHERE c.id = v_existing
    );
  END IF;

  IF p_carry_in IS NOT NULL THEN
    v_prev_carry := p_carry_in;
  ELSE
    SELECT coalesce(c.carry_out, 0)
      INTO v_prev_carry
    FROM public.commission_remainder_carry c
    WHERE c.provider_id = p_provider_id
      AND c.currency = p_currency
      AND c.period_key < p_billing_period
    ORDER BY c.period_key DESC
    LIMIT 1;
    v_prev_carry := coalesce(v_prev_carry, 0);
  END IF;

  SELECT coalesce(sum(CASE WHEN cl.exact_numerator > 0 THEN cl.exact_numerator ELSE 0 END), 0),
         coalesce(sum(CASE WHEN cl.exact_numerator < 0 THEN -cl.exact_numerator ELSE 0 END), 0)
    INTO v_earned, v_reversed
  FROM public.commission_ledger cl
  WHERE cl.provider_id = p_provider_id
    AND cl.currency = p_currency
    AND cl.billing_period = p_billing_period
    AND cl.exact_numerator IS NOT NULL;

  v_period := v_prev_carry + v_earned - v_reversed;
  IF v_period < 0 THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'COMMISSION_IMBALANCE';
  END IF;
  v_invoice := v_period / 10000;
  v_carry_out := v_period % 10000;

  INSERT INTO public.commission_remainder_carry (
    provider_id, currency, period_key, carry_in, carry_out,
    period_numerator, commission_invoice_minor, settled_at, idempotency_key
  ) VALUES (
    p_provider_id, p_currency, p_billing_period, v_prev_carry::integer, v_carry_out::integer,
    v_period, v_invoice::integer, now(), v_key
  )
  ON CONFLICT DO NOTHING;

  -- Upsert by natural key when unique on (provider, currency, period) exists
  UPDATE public.commission_remainder_carry c
  SET carry_in = v_prev_carry::integer,
      carry_out = v_carry_out::integer,
      period_numerator = v_period,
      commission_invoice_minor = v_invoice::integer,
      settled_at = now(),
      idempotency_key = coalesce(c.idempotency_key, v_key)
  WHERE c.provider_id = p_provider_id
    AND c.currency = p_currency
    AND c.period_key = p_billing_period;

  IF NOT FOUND THEN
    INSERT INTO public.commission_remainder_carry (
      provider_id, currency, period_key, carry_in, carry_out,
      period_numerator, commission_invoice_minor, settled_at, idempotency_key
    ) VALUES (
      p_provider_id, p_currency, p_billing_period, v_prev_carry::integer, v_carry_out::integer,
      v_period, v_invoice::integer, now(), v_key
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'carry_in', v_prev_carry,
    'carry_out', v_carry_out,
    'invoice_minor', v_invoice,
    'period_numerator', v_period,
    'earned', v_earned,
    'reversed', v_reversed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lp_billing_settle_period_remainder(uuid, text, text, bigint, text) TO service_role;

CREATE OR REPLACE FUNCTION public.lp_billing_final_rounding_adjustment(
  p_provider_id uuid,
  p_currency text,
  p_billing_period text,
  p_reason text DEFAULT 'contract_close_final_rounding',
  p_actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_carry bigint := 0;
  v_id uuid;
BEGIN
  SELECT c.carry_out INTO v_carry
  FROM public.commission_remainder_carry c
  WHERE c.provider_id = p_provider_id
    AND c.currency = p_currency
    AND c.period_key = p_billing_period;

  v_carry := coalesce(v_carry, 0);
  IF v_carry = 0 THEN
    RETURN jsonb_build_object('ok', true, 'adjusted', false, 'carry', 0);
  END IF;

  INSERT INTO public.commission_ledger (
    provider_id,
    organization_id,
    order_id,
    event_type,
    commission_rate_bps,
    country_code,
    tax_country_code,
    currency,
    commission_basis_amount_minor,
    commission_amount_exact,
    billing_period,
    idempotency_key,
    reason,
    created_by,
    exact_numerator,
    denominator,
    source_event,
    calculation_checksum
  ) VALUES (
    p_provider_id,
    p_provider_id,
    NULL,
    'ROUNDING_ADJUSTMENT',
    500,
    'NO',
    'NO',
    p_currency,
    0,
    (v_carry::numeric / 10000),
    p_billing_period,
    format('final_round:%s:%s:%s', p_provider_id, p_currency, p_billing_period),
    p_reason,
    p_actor,
    v_carry,
    10000,
    'ROUNDING_ADJUSTMENT',
    format('final_round_%s', v_carry)
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;

  UPDATE public.commission_remainder_carry
  SET carry_out = 0,
      commission_invoice_minor = commission_invoice_minor + CASE WHEN v_carry >= 5000 THEN 1 ELSE 0 END,
      settled_at = now()
  WHERE provider_id = p_provider_id
    AND currency = p_currency
    AND period_key = p_billing_period;

  RETURN jsonb_build_object('ok', true, 'adjusted', true, 'carry_closed', v_carry, 'ledger_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lp_billing_final_rounding_adjustment(uuid, text, text, text, uuid) TO service_role;

COMMIT;
