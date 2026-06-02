-- Security: company lifecycle RPCs must require provider_admin (not any provider member).
-- Replaces lp_assert_provider_admin_access (can_access_provider = any membership) with
-- lp_assert_provider_admin_or_superadmin (platform_admin OR provider_admin only).
-- Verified prod callers: lp_company_suspend/pause/resume/delete only (4/4).

BEGIN;

CREATE OR REPLACE FUNCTION public.lp_company_suspend(p_company_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_provider_id uuid;
  v_cascade_orders int := 0;
BEGIN
  PERFORM private.lp_lifecycle_require_reason(p_reason);

  SELECT c.provider_id INTO v_provider_id FROM public.companies c WHERE c.id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPANY_NOT_FOUND' USING ERRCODE = '02000';
  END IF;
  PERFORM private.lp_assert_provider_admin_or_superadmin(v_provider_id);

  IF EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id AND suspended_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'already_suspended', true);
  END IF;

  UPDATE public.companies
  SET suspended_at = now(),
      suspended_by = auth.uid(),
      suspended_reason = p_reason
  WHERE id = p_company_id;

  v_cascade_orders := private.lp_orders_pause_active(p_company_id := p_company_id);

  PERFORM private.lp_lifecycle_audit(
    'suspend', 'company', p_company_id, p_reason,
    jsonb_build_object('provider_id', v_provider_id, 'cascade_orders_paused', v_cascade_orders)
  );

  RETURN jsonb_build_object('ok', true, 'cascade_orders_paused', v_cascade_orders);
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_company_pause(p_company_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_provider_id uuid;
  v_cascade_orders int := 0;
BEGIN
  SELECT c.provider_id INTO v_provider_id FROM public.companies c WHERE c.id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPANY_NOT_FOUND' USING ERRCODE = '02000';
  END IF;
  PERFORM private.lp_assert_provider_admin_or_superadmin(v_provider_id);

  IF EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id AND paused_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'already_paused', true);
  END IF;

  UPDATE public.companies
  SET paused_at = now(),
      paused_by = auth.uid(),
      paused_reason = p_reason
  WHERE id = p_company_id;

  v_cascade_orders := private.lp_orders_pause_active(p_company_id := p_company_id);

  PERFORM private.lp_lifecycle_audit(
    'pause', 'company', p_company_id, p_reason,
    jsonb_build_object('provider_id', v_provider_id, 'cascade_orders_paused', v_cascade_orders)
  );

  RETURN jsonb_build_object('ok', true, 'cascade_orders_paused', v_cascade_orders);
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_company_delete(p_company_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_provider_id uuid;
  v_cascade_orders int := 0;
BEGIN
  PERFORM private.lp_lifecycle_require_reason(p_reason);

  SELECT c.provider_id INTO v_provider_id FROM public.companies c WHERE c.id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPANY_NOT_FOUND' USING ERRCODE = '02000';
  END IF;
  PERFORM private.lp_assert_provider_admin_or_superadmin(v_provider_id);

  IF EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id AND deleted_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'already_deleted', true);
  END IF;

  UPDATE public.companies SET deleted_at = now() WHERE id = p_company_id;

  v_cascade_orders := private.lp_orders_cancel_active(p_company_id := p_company_id);

  PERFORM private.lp_lifecycle_audit(
    'delete', 'company', p_company_id, p_reason,
    jsonb_build_object(
      'provider_id', v_provider_id,
      'cascade_orders_cancelled', v_cascade_orders,
      'grace_days', 30
    )
  );

  RETURN jsonb_build_object('ok', true, 'cascade_orders_cancelled', v_cascade_orders);
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_company_resume(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_provider_id uuid;
  v_cascade_orders int := 0;
BEGIN
  SELECT c.provider_id INTO v_provider_id FROM public.companies c WHERE c.id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPANY_NOT_FOUND' USING ERRCODE = '02000';
  END IF;
  PERFORM private.lp_assert_provider_admin_or_superadmin(v_provider_id);

  UPDATE public.companies
  SET suspended_at = NULL,
      suspended_by = NULL,
      suspended_reason = NULL,
      paused_at = NULL,
      paused_by = NULL,
      paused_reason = NULL
  WHERE id = p_company_id;

  v_cascade_orders := private.lp_orders_resume_paused(p_company_id := p_company_id);

  PERFORM private.lp_lifecycle_audit(
    'resume', 'company', p_company_id, NULL,
    jsonb_build_object('provider_id', v_provider_id, 'cascade_orders_resumed', v_cascade_orders)
  );

  RETURN jsonb_build_object('ok', true, 'cascade_orders_resumed', v_cascade_orders);
END;
$$;

DROP FUNCTION IF EXISTS private.lp_assert_provider_admin_access(uuid);

COMMIT;
