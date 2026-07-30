-- Harden lp_capacity_upsert_day: only provider members / superadmin / service_role.
-- Additive security fix after 20260909120000.

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
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_is_super boolean := false;
  v_is_member boolean := false;
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

  -- Authorization: service_role OR superadmin OR provider_membership for target provider
  IF v_role IS DISTINCT FROM 'service_role' THEN
    SELECT exists(
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = v_uid AND pr.role = 'superadmin'
    ) INTO v_is_super;

    SELECT exists(
      SELECT 1 FROM public.provider_memberships pm
      WHERE pm.provider_id = p_provider_id
        AND pm.user_id = v_uid
    ) INTO v_is_member;

    IF NOT v_is_super AND NOT v_is_member THEN
      RAISE EXCEPTION USING errcode = 'P0001', message = 'CAPACITY_FORBIDDEN';
    END IF;
  END IF;

  IF coalesce(nullif(trim(p_country_code), ''), 'NO') <> 'NO' THEN
    RAISE EXCEPTION USING errcode = 'P0001', message = 'CAPACITY_WRONG_COUNTRY';
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
    p_provider_id, 'NO',
    coalesce(nullif(trim(p_timezone), ''), 'Europe/Oslo'),
    p_service_date, p_location_id, nullif(trim(coalesce(p_delivery_window, '')), ''),
    p_product_id, v_choice, v_mode,
    CASE WHEN v_mode = 'LIMITED' THEN p_capacity_limit ELSE NULL END,
    0, 0, coalesce(p_actor_id, v_uid), coalesce(p_actor_id, v_uid), now(), now()
  )
  ON CONFLICT (provider_id, service_date, choice_key) DO UPDATE
  SET capacity_mode = EXCLUDED.capacity_mode,
      capacity_limit = EXCLUDED.capacity_limit,
      location_id = COALESCE(EXCLUDED.location_id, public.dish_day_capacity.location_id),
      delivery_window = COALESCE(EXCLUDED.delivery_window, public.dish_day_capacity.delivery_window),
      product_id = COALESCE(EXCLUDED.product_id, public.dish_day_capacity.product_id),
      country_code = 'NO',
      timezone = EXCLUDED.timezone,
      updated_by = coalesce(p_actor_id, v_uid),
      updated_at = now()
  RETURNING * INTO v_row;

  INSERT INTO public.dish_day_capacity_events (
    provider_id, service_date, choice_key, delta, event_type, actor_id, note, idempotency_key
  ) VALUES (
    p_provider_id, p_service_date, v_choice, 0, 'CONFIGURE', coalesce(p_actor_id, v_uid), p_note,
    'cap:cfg:' || p_provider_id::text || ':' || p_service_date::text || ':' || v_choice || ':' || replace(gen_random_uuid()::text, '-', '')
  );

  INSERT INTO public.dish_day_capacity_audit (
    provider_id, service_date, choice_key, actor_id, action, before_json, after_json
  ) VALUES (
    p_provider_id, p_service_date, v_choice, coalesce(p_actor_id, v_uid), 'UPSERT_DAY', v_before, to_jsonb(v_row)
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.lp_capacity_upsert_day(uuid, date, text, text, integer, uuid, text, text, uuid, text, uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lp_capacity_upsert_day(uuid, date, text, text, integer, uuid, text, text, uuid, text, uuid, boolean, text) TO authenticated, service_role;
