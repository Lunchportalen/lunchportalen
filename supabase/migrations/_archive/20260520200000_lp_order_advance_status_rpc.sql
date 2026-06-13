-- Patch 11 (Phase E.11) — lp_order_advance_status for provider kitchen flow
-- Uses existing order_status: ACTIVE/LOCKED → PREPARED → DISPATCHED → DELIVERED
-- Bypasses guard_order_mutation (provider members lack platform kitchen role).

CREATE OR REPLACE FUNCTION private.lp_assert_provider_kitchen_access(p_provider_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_platform_admin() THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.provider_memberships pm
    WHERE pm.user_id = auth.uid()
      AND pm.provider_id = p_provider_id
      AND pm.role IN ('provider_admin'::public.provider_role, 'provider_kitchen'::public.provider_role)
  ) THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_order_advance_status(
  p_order_id uuid,
  p_target_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_old_status text;
  v_new_status text;
  v_target text;
BEGIN
  v_target := upper(trim(coalesce(p_target_status, '')));
  IF v_target NOT IN ('PREPARED', 'DISPATCHED', 'DELIVERED') THEN
    RAISE EXCEPTION 'INVALID_TARGET_STATUS' USING ERRCODE = '22023';
  END IF;

  SELECT o.provider_id, upper(o.status::text)
  INTO v_provider_id, v_old_status
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = '02000';
  END IF;

  PERFORM private.lp_assert_provider_kitchen_access(v_provider_id);

  IF v_old_status IN ('CANCELLED', 'PAUSED') THEN
    RAISE EXCEPTION 'ORDER_NOT_ADVANCEABLE' USING ERRCODE = '22023';
  END IF;

  IF v_old_status = v_target THEN
    RETURN jsonb_build_object('ok', true, 'already_at_status', true, 'from_status', v_old_status, 'to_status', v_target);
  END IF;

  IF v_old_status = 'DELIVERED' AND v_target = 'DISPATCHED' THEN
    IF NOT public.is_platform_admin()
      AND NOT EXISTS (
        SELECT 1
        FROM public.provider_memberships pm
        WHERE pm.user_id = auth.uid()
          AND pm.provider_id = v_provider_id
          AND pm.role = 'provider_admin'::public.provider_role
      ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
    END IF;
  ELSIF v_target = 'PREPARED' AND v_old_status IN ('ACTIVE', 'LOCKED') THEN
    NULL;
  ELSIF v_target = 'DISPATCHED' AND v_old_status = 'PREPARED' THEN
    NULL;
  ELSIF v_target = 'DELIVERED' AND v_old_status = 'DISPATCHED' THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION' USING ERRCODE = '22023';
  END IF;

  ALTER TABLE public.orders DISABLE TRIGGER guard_order_mutation;

  UPDATE public.orders
  SET status = v_target::public.order_status,
      updated_at = now()
  WHERE id = p_order_id;

  ALTER TABLE public.orders ENABLE TRIGGER guard_order_mutation;

  INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by, note)
  VALUES (p_order_id, v_old_status, v_target, auth.uid(), nullif(trim(p_note), ''));

  RETURN jsonb_build_object(
    'ok', true,
    'from_status', v_old_status,
    'to_status', v_target,
    'provider_id', v_provider_id
  );
END;
$$;

COMMENT ON FUNCTION public.lp_order_advance_status(uuid, text, text) IS
'Provider kitchen flow: ACTIVE/LOCKED→PREPARED→DISPATCHED→DELIVERED. Admin may reopen DELIVERED→DISPATCHED.';

GRANT EXECUTE ON FUNCTION public.lp_order_advance_status(uuid, text, text) TO authenticated;
