-- Patch 7 (Phase E.7) — private lifecycle helpers (used by 12 public RPCs in 20260520180002)
-- PROVIDER-PLAN-V1 §6. Requires Patch 5 + Patch 6 + order_status.PAUSED (20260520180000).

-- ---------------------------------------------------------------------------
-- Internal helpers (private schema)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.lp_lifecycle_require_reason(p_reason text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 20 THEN
    RAISE EXCEPTION 'REASON_REQUIRED_MIN_20_CHARS' USING ERRCODE = '22023';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.lp_lifecycle_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_reason text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_reason, coalesce(p_metadata, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION private.lp_orders_pause_active(
  p_company_id uuid DEFAULT NULL,
  p_provider_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  ALTER TABLE public.orders DISABLE TRIGGER guard_order_mutation;
  UPDATE public.orders o
  SET status = 'PAUSED'::public.order_status
  WHERE o.status = 'ACTIVE'::public.order_status
    AND (
      (p_company_id IS NOT NULL AND o.company_id = p_company_id)
      OR (
        p_provider_id IS NOT NULL
        AND o.company_id IN (
          SELECT c.id FROM public.companies c WHERE c.provider_id = p_provider_id
        )
      )
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  ALTER TABLE public.orders ENABLE TRIGGER guard_order_mutation;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.lp_orders_cancel_active(
  p_company_id uuid DEFAULT NULL,
  p_provider_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  ALTER TABLE public.orders DISABLE TRIGGER guard_order_mutation;
  UPDATE public.orders o
  SET status = 'CANCELLED'::public.order_status
  WHERE o.status IN ('ACTIVE'::public.order_status, 'PAUSED'::public.order_status)
    AND (
      (p_company_id IS NOT NULL AND o.company_id = p_company_id)
      OR (
        p_provider_id IS NOT NULL
        AND o.company_id IN (
          SELECT c.id FROM public.companies c WHERE c.provider_id = p_provider_id
        )
      )
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  ALTER TABLE public.orders ENABLE TRIGGER guard_order_mutation;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.lp_orders_resume_paused(
  p_company_id uuid DEFAULT NULL,
  p_provider_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  ALTER TABLE public.orders DISABLE TRIGGER guard_order_mutation;
  UPDATE public.orders o
  SET status = 'ACTIVE'::public.order_status
  WHERE o.status = 'PAUSED'::public.order_status
    AND (
      (p_company_id IS NOT NULL AND o.company_id = p_company_id)
      OR (
        p_provider_id IS NOT NULL
        AND o.company_id IN (
          SELECT c.id FROM public.companies c WHERE c.provider_id = p_provider_id
        )
      )
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  ALTER TABLE public.orders ENABLE TRIGGER guard_order_mutation;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION private.lp_assert_provider_admin_access(p_provider_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_platform_admin()
    OR public.can_access_provider(p_provider_id) THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION private.lp_assert_user_lifecycle_access(
  p_user_id uuid,
  OUT o_company_id uuid,
  OUT o_provider_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%rowtype;
BEGIN
  SELECT * INTO v_profile FROM public.profiles p WHERE p.id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = '02000';
  END IF;

  o_company_id := v_profile.company_id;
  o_provider_id := NULL;
  IF o_company_id IS NOT NULL THEN
    SELECT c.provider_id INTO o_provider_id FROM public.companies c WHERE c.id = o_company_id;
  END IF;

  IF public.is_platform_admin() THEN
    RETURN;
  END IF;
  IF o_company_id IS NOT NULL AND public.can_admin_company(o_company_id) THEN
    RETURN;
  END IF;
  IF o_provider_id IS NOT NULL AND public.can_access_provider(o_provider_id) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
END;
$$;
