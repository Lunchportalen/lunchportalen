-- NORWAY ENTERPRISE — Explicit capacity model + atomic reserve/release.
-- Capacity only (no commission model changes).
-- Protected Golden Path Impact: lp_order_set body unchanged; capacity via order_items triggers.
-- Backward compatible: active providers backfilled to explicit UNLIMITED (ordering stays open).

-- ---------------------------------------------------------------------------
-- 1) Provider-level explicit capacity policy (never implicit unlimited)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_capacity_policy (
  provider_id uuid PRIMARY KEY REFERENCES public.providers(id) ON DELETE CASCADE,
  country_code text NOT NULL DEFAULT 'NO',
  timezone text NOT NULL DEFAULT 'Europe/Oslo',
  default_mode text NOT NULL DEFAULT 'UNLIMITED'
    CHECK (default_mode IN ('UNLIMITED', 'LIMITED', 'CLOSED')),
  default_capacity_limit integer NULL,
  migration_decision text NOT NULL DEFAULT 'explicit_unlimited_backfill_20260909',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_capacity_policy_limit_chk CHECK (
    default_mode <> 'LIMITED'
    OR (default_capacity_limit IS NOT NULL AND default_capacity_limit >= 0)
  )
);

COMMENT ON TABLE public.provider_capacity_policy IS
  'Explicit per-provider capacity default. Absence is invalid for ACTIVE providers after backfill.';

-- ---------------------------------------------------------------------------
-- 2) Day / choice / optional scope capacity pools
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dish_day_capacity (
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  country_code text NOT NULL DEFAULT 'NO',
  timezone text NOT NULL DEFAULT 'Europe/Oslo',
  service_date date NOT NULL,
  location_id uuid NULL,
  delivery_window text NULL,
  menu_service_day_id uuid NULL,
  product_id uuid NULL,
  choice_key text NOT NULL,
  capacity_mode text NOT NULL DEFAULT 'LIMITED'
    CHECK (capacity_mode IN ('UNLIMITED', 'LIMITED', 'CLOSED')),
  capacity_limit integer NULL,
  reserved_qty integer NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  released_qty integer NOT NULL DEFAULT 0 CHECK (released_qty >= 0),
  effective_from timestamptz,
  effective_to timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, service_date, choice_key),
  CONSTRAINT dish_day_capacity_limit_chk CHECK (
    capacity_mode <> 'LIMITED'
    OR (capacity_limit IS NOT NULL AND capacity_limit >= 0)
  ),
  CONSTRAINT dish_day_capacity_reserved_le_limit CHECK (
    capacity_mode <> 'LIMITED'
    OR capacity_limit IS NULL
    OR reserved_qty <= capacity_limit
  )
);

CREATE TABLE IF NOT EXISTS public.dish_day_capacity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  service_date date NOT NULL,
  choice_key text NOT NULL,
  order_id uuid,
  user_id uuid,
  delta integer NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('RESERVE', 'RELEASE', 'CONFIGURE', 'OVERRIDE')),
  idempotency_key text,
  actor_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dish_day_capacity_events_idem UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS dish_day_capacity_events_order_idx
  ON public.dish_day_capacity_events (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dish_day_capacity_events_pool_idx
  ON public.dish_day_capacity_events (provider_id, service_date, choice_key);

CREATE TABLE IF NOT EXISTS public.dish_day_capacity_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  service_date date,
  choice_key text,
  actor_id uuid,
  action text NOT NULL,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dish_day_capacity_audit_provider_idx
  ON public.dish_day_capacity_audit (provider_id, created_at DESC);

COMMENT ON TABLE public.dish_day_capacity IS
  'Explicit day/choice capacity. Modes: UNLIMITED | LIMITED | CLOSED. Hierarchy falls back to provider_capacity_policy.';

-- ---------------------------------------------------------------------------
-- 3) Backfill: every ACTIVE provider gets explicit UNLIMITED policy
-- ---------------------------------------------------------------------------
INSERT INTO public.provider_capacity_policy (
  provider_id,
  country_code,
  timezone,
  default_mode,
  default_capacity_limit,
  migration_decision,
  created_at,
  updated_at
)
SELECT
  p.id,
  'NO',
  'Europe/Oslo',
  'UNLIMITED',
  NULL,
  'explicit_unlimited_backfill_20260909',
  now(),
  now()
FROM public.providers p
WHERE p.status = 'ACTIVE'
  AND p.deleted_at IS NULL
ON CONFLICT (provider_id) DO NOTHING;

INSERT INTO public.dish_day_capacity_audit (provider_id, action, after_json)
SELECT
  pcp.provider_id,
  'MIGRATION_EXPLICIT_UNLIMITED',
  jsonb_build_object(
    'default_mode', pcp.default_mode,
    'migration_decision', pcp.migration_decision,
    'country_code', pcp.country_code,
    'timezone', pcp.timezone
  )
FROM public.provider_capacity_policy pcp
WHERE pcp.migration_decision = 'explicit_unlimited_backfill_20260909'
  AND NOT EXISTS (
    SELECT 1
    FROM public.dish_day_capacity_audit a
    WHERE a.provider_id = pcp.provider_id
      AND a.action = 'MIGRATION_EXPLICIT_UNLIMITED'
  );

-- ---------------------------------------------------------------------------
-- 4) Atomic reserve / release
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_capacity_choice_key_from_category(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(
    regexp_replace(
      lower(translate(trim(coalesce(p_name, '')), 'æøåÆØÅ', 'eoaEOA')),
      '[^a-z0-9]+',
      '',
      'g'
    ),
    ''
  );
$$;

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
  v_choice text := public.lp_capacity_choice_key_from_category(p_choice_key);
  v_mode text;
  v_limit integer;
  v_reserved integer;
  v_key text;
  v_policy public.provider_capacity_policy%ROWTYPE;
  v_pool_choice text;
BEGIN
  IF p_provider_id IS NULL OR p_service_date IS NULL THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'CAPACITY_SCOPE_INVALID';
  END IF;
  IF coalesce(p_qty, 0) <= 0 THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'CAPACITY_QTY_INVALID';
  END IF;
  IF v_choice IS NULL OR v_choice = '' THEN
    v_choice := '__provider__';
  END IF;

  -- Idempotent: latest event for this order already RESERVE
  IF p_order_id IS NOT NULL AND (
    SELECT e.event_type
    FROM public.dish_day_capacity_events e
    WHERE e.order_id = p_order_id
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 1
  ) = 'RESERVE' THEN
    RETURN true;
  END IF;

  v_key := coalesce(
    nullif(trim(coalesce(p_idempotency_key, '')), ''),
    'cap:reserve:' || coalesce(p_order_id::text, 'none') || ':' || replace(gen_random_uuid()::text, '-', '')
  );

  IF p_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.dish_day_capacity_events e WHERE e.idempotency_key = v_key
  ) THEN
    RETURN true;
  END IF;

  -- Lock specific choice pool if present
  SELECT c.capacity_mode, c.capacity_limit, c.reserved_qty, c.choice_key
    INTO v_mode, v_limit, v_reserved, v_pool_choice
  FROM public.dish_day_capacity c
  WHERE c.provider_id = p_provider_id
    AND c.service_date = p_service_date
    AND c.choice_key = v_choice
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Optional provider-day pool
    SELECT c.capacity_mode, c.capacity_limit, c.reserved_qty, c.choice_key
      INTO v_mode, v_limit, v_reserved, v_pool_choice
    FROM public.dish_day_capacity c
    WHERE c.provider_id = p_provider_id
      AND c.service_date = p_service_date
      AND c.choice_key = '__provider__'
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    SELECT *
      INTO v_policy
    FROM public.provider_capacity_policy p
    WHERE p.provider_id = p_provider_id
    FOR UPDATE;

    IF NOT FOUND THEN
      -- Fail closed: no implicit unlimited after enterprise capacity closure
      RAISE EXCEPTION USING errcode = 'P0001', message = 'CAPACITY_POLICY_MISSING';
    END IF;

    IF v_policy.default_mode = 'CLOSED' THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'CAPACITY_CLOSED';
    END IF;

    IF v_policy.default_mode = 'UNLIMITED' THEN
      -- Explicit unlimited: no pool mutation required
      INSERT INTO public.dish_day_capacity_events (
        provider_id, service_date, choice_key, order_id, user_id, delta, event_type, idempotency_key, note
      ) VALUES (
        p_provider_id, p_service_date, v_choice, p_order_id, p_user_id, p_qty, 'RESERVE', v_key,
        'policy:UNLIMITED'
      );
      RETURN true;
    END IF;

    -- LIMITED default → materialize day/choice pool
    v_pool_choice := v_choice;
    INSERT INTO public.dish_day_capacity (
      provider_id, country_code, timezone, service_date, choice_key,
      capacity_mode, capacity_limit, reserved_qty, created_at, updated_at
    ) VALUES (
      p_provider_id, coalesce(v_policy.country_code, 'NO'), coalesce(v_policy.timezone, 'Europe/Oslo'),
      p_service_date, v_pool_choice, 'LIMITED', v_policy.default_capacity_limit, 0, now(), now()
    )
    ON CONFLICT (provider_id, service_date, choice_key) DO NOTHING;

    SELECT c.capacity_mode, c.capacity_limit, c.reserved_qty, c.choice_key
      INTO v_mode, v_limit, v_reserved, v_pool_choice
    FROM public.dish_day_capacity c
    WHERE c.provider_id = p_provider_id
      AND c.service_date = p_service_date
      AND c.choice_key = v_choice
    FOR UPDATE;
  END IF;

  IF v_mode = 'CLOSED' THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'CAPACITY_CLOSED';
  END IF;

  IF v_mode = 'UNLIMITED' THEN
    UPDATE public.dish_day_capacity
    SET reserved_qty = reserved_qty + p_qty,
        updated_at = now()
    WHERE provider_id = p_provider_id
      AND service_date = p_service_date
      AND choice_key = v_pool_choice;

    INSERT INTO public.dish_day_capacity_events (
      provider_id, service_date, choice_key, order_id, user_id, delta, event_type, idempotency_key, note
    ) VALUES (
      p_provider_id, p_service_date, v_pool_choice, p_order_id, p_user_id, p_qty, 'RESERVE', v_key,
      'mode:UNLIMITED'
    );
    RETURN true;
  END IF;

  -- LIMITED
  IF v_reserved + p_qty > coalesce(v_limit, -1) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'CAPACITY_EXCEEDED';
  END IF;

  UPDATE public.dish_day_capacity
  SET reserved_qty = reserved_qty + p_qty,
      updated_at = now()
  WHERE provider_id = p_provider_id
    AND service_date = p_service_date
    AND choice_key = v_pool_choice;

  INSERT INTO public.dish_day_capacity_events (
    provider_id, service_date, choice_key, order_id, user_id, delta, event_type, idempotency_key
  ) VALUES (
    p_provider_id, p_service_date, v_pool_choice, p_order_id, p_user_id, p_qty, 'RESERVE', v_key
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

  -- Pool rows may be absent for policy-UNLIMITED reserves
  UPDATE public.dish_day_capacity c
  SET reserved_qty = GREATEST(0, c.reserved_qty - v_ev.delta),
      released_qty = c.released_qty + v_ev.delta,
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

CREATE OR REPLACE FUNCTION public.lp_capacity_upsert_day(
  p_provider_id uuid,
  p_service_date date,
  p_choice_key text,
  p_capacity_mode text,
  p_capacity_limit integer,
  p_actor_id uuid DEFAULT NULL,
  p_country_code text DEFAULT 'NO',
  p_timezone text DEFAULT 'Europe/Oslo',
  p_location_id uuid DEFAULT NULL,
  p_delivery_window text DEFAULT NULL,
  p_product_id uuid DEFAULT NULL,
  p_allow_below_reserved boolean DEFAULT false,
  p_note text DEFAULT NULL
)
RETURNS public.dish_day_capacity
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_choice text := coalesce(nullif(public.lp_capacity_choice_key_from_category(p_choice_key), ''), '__provider__');
  v_mode text := upper(trim(coalesce(p_capacity_mode, '')));
  v_before jsonb;
  v_row public.dish_day_capacity;
BEGIN
  IF p_provider_id IS NULL OR p_service_date IS NULL THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'CAPACITY_SCOPE_INVALID';
  END IF;
  IF v_mode NOT IN ('UNLIMITED', 'LIMITED', 'CLOSED') THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'CAPACITY_MODE_INVALID';
  END IF;
  IF v_mode = 'LIMITED' AND (p_capacity_limit IS NULL OR p_capacity_limit < 0) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'CAPACITY_LIMIT_INVALID';
  END IF;

  SELECT to_jsonb(c)
    INTO v_before
  FROM public.dish_day_capacity c
  WHERE c.provider_id = p_provider_id
    AND c.service_date = p_service_date
    AND c.choice_key = v_choice
  FOR UPDATE;

  IF v_before IS NOT NULL
     AND v_mode = 'LIMITED'
     AND NOT coalesce(p_allow_below_reserved, false)
     AND p_capacity_limit < coalesce((v_before->>'reserved_qty')::integer, 0) THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'CAPACITY_BELOW_RESERVED';
  END IF;

  INSERT INTO public.dish_day_capacity (
    provider_id, country_code, timezone, service_date, location_id, delivery_window,
    product_id, choice_key, capacity_mode, capacity_limit, reserved_qty, released_qty,
    created_by, updated_by, created_at, updated_at
  ) VALUES (
    p_provider_id, coalesce(nullif(trim(p_country_code), ''), 'NO'),
    coalesce(nullif(trim(p_timezone), ''), 'Europe/Oslo'),
    p_service_date, p_location_id, nullif(trim(coalesce(p_delivery_window, '')), ''),
    p_product_id, v_choice, v_mode,
    CASE WHEN v_mode = 'LIMITED' THEN p_capacity_limit ELSE NULL END,
    0, 0, p_actor_id, p_actor_id, now(), now()
  )
  ON CONFLICT (provider_id, service_date, choice_key) DO UPDATE
  SET capacity_mode = EXCLUDED.capacity_mode,
      capacity_limit = EXCLUDED.capacity_limit,
      location_id = COALESCE(EXCLUDED.location_id, public.dish_day_capacity.location_id),
      delivery_window = COALESCE(EXCLUDED.delivery_window, public.dish_day_capacity.delivery_window),
      product_id = COALESCE(EXCLUDED.product_id, public.dish_day_capacity.product_id),
      country_code = EXCLUDED.country_code,
      timezone = EXCLUDED.timezone,
      updated_by = p_actor_id,
      updated_at = now()
  RETURNING * INTO v_row;

  INSERT INTO public.dish_day_capacity_events (
    provider_id, service_date, choice_key, delta, event_type, actor_id, note, idempotency_key
  ) VALUES (
    p_provider_id, p_service_date, v_choice, 0, 'CONFIGURE', p_actor_id, p_note,
    'cap:cfg:' || p_provider_id::text || ':' || p_service_date::text || ':' || v_choice || ':' || replace(gen_random_uuid()::text, '-', '')
  );

  INSERT INTO public.dish_day_capacity_audit (
    provider_id, service_date, choice_key, actor_id, action, before_json, after_json
  ) VALUES (
    p_provider_id, p_service_date, v_choice, p_actor_id, 'UPSERT_DAY', v_before, to_jsonb(v_row)
  );

  RETURN v_row;
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
  v_date date;
BEGIN
  SELECT o.* INTO v_order FROM public.orders o WHERE o.id = NEW.order_id;
  IF NOT FOUND OR v_order.status IS DISTINCT FROM 'ACTIVE'::public.order_status THEN
    RETURN NEW;
  END IF;

  v_provider := v_order.provider_id;
  IF v_provider IS NULL THEN
    SELECT c.provider_id INTO v_provider
    FROM public.companies c
    WHERE c.id = v_order.company_id;
  END IF;
  IF v_provider IS NULL THEN
    RETURN NEW;
  END IF;

  v_date := coalesce(v_order.service_date, v_order.date);

  SELECT public.lp_capacity_choice_key_from_category(pc.name)
    INTO v_choice
  FROM public.products pr
  JOIN public.product_categories pc ON pc.id = pr.category_id
  WHERE pr.id = NEW.product_id;

  IF v_choice IS NULL OR v_choice = '' THEN
    v_choice := '__provider__';
  END IF;

  PERFORM public.lp_capacity_try_reserve(
    v_provider,
    v_date,
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
  PERFORM public.lp_capacity_release(OLD.order_id, v_order.user_id, NULL);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_capacity_reserve ON public.order_items;
CREATE TRIGGER trg_order_items_capacity_reserve
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_order_items_capacity_reserve();

DROP TRIGGER IF EXISTS trg_order_items_capacity_release ON public.order_items;
CREATE TRIGGER trg_order_items_capacity_release
  AFTER DELETE ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_order_items_capacity_release();

-- ---------------------------------------------------------------------------
-- 5) RLS — provider isolation; writes via SECURITY DEFINER RPCs / service role
-- ---------------------------------------------------------------------------
ALTER TABLE public.provider_capacity_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_day_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_day_capacity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_day_capacity_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_capacity_policy_select ON public.provider_capacity_policy;
CREATE POLICY provider_capacity_policy_select ON public.provider_capacity_policy
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.provider_id = provider_capacity_policy.provider_id
        AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role = 'superadmin'
    )
  );

DROP POLICY IF EXISTS dish_day_capacity_select ON public.dish_day_capacity;
CREATE POLICY dish_day_capacity_select ON public.dish_day_capacity
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.provider_id = dish_day_capacity.provider_id
        AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role = 'superadmin'
    )
  );

DROP POLICY IF EXISTS dish_day_capacity_events_select ON public.dish_day_capacity_events;
CREATE POLICY dish_day_capacity_events_select ON public.dish_day_capacity_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.provider_id = dish_day_capacity_events.provider_id
        AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role = 'superadmin'
    )
  );

DROP POLICY IF EXISTS dish_day_capacity_audit_select ON public.dish_day_capacity_audit;
CREATE POLICY dish_day_capacity_audit_select ON public.dish_day_capacity_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.provider_id = dish_day_capacity_audit.provider_id
        AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = auth.uid() AND pr.role = 'superadmin'
    )
  );

GRANT SELECT ON public.provider_capacity_policy TO authenticated, service_role;
GRANT SELECT ON public.dish_day_capacity TO authenticated, service_role;
GRANT SELECT ON public.dish_day_capacity_events TO authenticated, service_role;
GRANT SELECT ON public.dish_day_capacity_audit TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.lp_capacity_choice_key_from_category(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lp_capacity_try_reserve(uuid, date, text, integer, uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lp_capacity_release(uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lp_capacity_upsert_day(uuid, date, text, text, integer, uuid, text, text, uuid, text, uuid, boolean, text) TO authenticated, service_role;
