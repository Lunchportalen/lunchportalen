-- Patch 7 public lifecycle RPCs (12 functions)
-- ---------------------------------------------------------------------------
-- Provider RPCs (superadmin only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lp_provider_suspend(p_provider_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cascade_companies int := 0;
  v_cascade_orders int := 0;
BEGIN
  PERFORM private.lp_lifecycle_require_reason(p_reason);
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = p_provider_id) THEN
    RAISE EXCEPTION 'PROVIDER_NOT_FOUND' USING ERRCODE = '02000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.providers WHERE id = p_provider_id AND suspended_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'already_suspended', true);
  END IF;

  UPDATE public.providers
  SET status = 'SUSPENDED'::public.provider_status,
      suspended_at = now(),
      suspended_by = auth.uid(),
      suspended_reason = p_reason
  WHERE id = p_provider_id;

  UPDATE public.companies
  SET suspended_at = now(),
      suspended_by = auth.uid(),
      suspended_reason = p_reason
  WHERE provider_id = p_provider_id
    AND deleted_at IS NULL
    AND suspended_at IS NULL;
  GET DIAGNOSTICS v_cascade_companies = ROW_COUNT;

  v_cascade_orders := private.lp_orders_pause_active(p_provider_id := p_provider_id);

  PERFORM private.lp_lifecycle_audit(
    'suspend', 'provider', p_provider_id, p_reason,
    jsonb_build_object('cascade_companies', v_cascade_companies, 'cascade_orders_paused', v_cascade_orders)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'cascade_companies', v_cascade_companies,
    'cascade_orders_paused', v_cascade_orders
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_provider_pause(p_provider_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cascade_orders int := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = p_provider_id) THEN
    RAISE EXCEPTION 'PROVIDER_NOT_FOUND' USING ERRCODE = '02000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.providers WHERE id = p_provider_id AND paused_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'already_paused', true);
  END IF;

  UPDATE public.providers
  SET status = 'PAUSED'::public.provider_status,
      paused_at = now(),
      paused_by = auth.uid(),
      paused_reason = p_reason
  WHERE id = p_provider_id;

  v_cascade_orders := private.lp_orders_pause_active(p_provider_id := p_provider_id);

  PERFORM private.lp_lifecycle_audit(
    'pause', 'provider', p_provider_id, p_reason,
    jsonb_build_object('cascade_orders_paused', v_cascade_orders)
  );

  RETURN jsonb_build_object('ok', true, 'cascade_orders_paused', v_cascade_orders);
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_provider_delete(p_provider_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cascade_companies int := 0;
  v_cascade_orders int := 0;
BEGIN
  PERFORM private.lp_lifecycle_require_reason(p_reason);
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = p_provider_id) THEN
    RAISE EXCEPTION 'PROVIDER_NOT_FOUND' USING ERRCODE = '02000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.providers WHERE id = p_provider_id AND deleted_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'already_deleted', true);
  END IF;

  UPDATE public.providers
  SET status = 'CLOSED'::public.provider_status,
      deleted_at = now()
  WHERE id = p_provider_id;

  UPDATE public.companies
  SET deleted_at = now()
  WHERE provider_id = p_provider_id
    AND deleted_at IS NULL;
  GET DIAGNOSTICS v_cascade_companies = ROW_COUNT;

  v_cascade_orders := private.lp_orders_cancel_active(p_provider_id := p_provider_id);

  PERFORM private.lp_lifecycle_audit(
    'delete', 'provider', p_provider_id, p_reason,
    jsonb_build_object(
      'cascade_companies_deleted', v_cascade_companies,
      'cascade_orders_cancelled', v_cascade_orders,
      'grace_days', 30
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'cascade_companies_deleted', v_cascade_companies,
    'cascade_orders_cancelled', v_cascade_orders
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_provider_resume(p_provider_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cascade_companies int := 0;
  v_cascade_orders int := 0;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.providers WHERE id = p_provider_id) THEN
    RAISE EXCEPTION 'PROVIDER_NOT_FOUND' USING ERRCODE = '02000';
  END IF;

  UPDATE public.providers
  SET status = 'ACTIVE'::public.provider_status,
      suspended_at = NULL,
      suspended_by = NULL,
      suspended_reason = NULL,
      paused_at = NULL,
      paused_by = NULL,
      paused_reason = NULL
  WHERE id = p_provider_id;

  UPDATE public.companies
  SET suspended_at = NULL,
      suspended_by = NULL,
      suspended_reason = NULL,
      paused_at = NULL,
      paused_by = NULL,
      paused_reason = NULL
  WHERE provider_id = p_provider_id
    AND deleted_at IS NULL;
  GET DIAGNOSTICS v_cascade_companies = ROW_COUNT;

  v_cascade_orders := private.lp_orders_resume_paused(p_provider_id := p_provider_id);

  PERFORM private.lp_lifecycle_audit('resume', 'provider', p_provider_id, NULL, jsonb_build_object(
    'cascade_companies_resumed', v_cascade_companies,
    'cascade_orders_resumed', v_cascade_orders
  ));

  RETURN jsonb_build_object(
    'ok', true,
    'cascade_companies_resumed', v_cascade_companies,
    'cascade_orders_resumed', v_cascade_orders
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Company RPCs (provider_admin via can_access_provider or superadmin)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lp_company_suspend(p_company_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  PERFORM private.lp_assert_provider_admin_access(v_provider_id);

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
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_cascade_orders int := 0;
BEGIN
  SELECT c.provider_id INTO v_provider_id FROM public.companies c WHERE c.id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPANY_NOT_FOUND' USING ERRCODE = '02000';
  END IF;
  PERFORM private.lp_assert_provider_admin_access(v_provider_id);

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
SET search_path = public
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
  PERFORM private.lp_assert_provider_admin_access(v_provider_id);

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
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
  v_cascade_orders int := 0;
BEGIN
  SELECT c.provider_id INTO v_provider_id FROM public.companies c WHERE c.id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'COMPANY_NOT_FOUND' USING ERRCODE = '02000';
  END IF;
  PERFORM private.lp_assert_provider_admin_access(v_provider_id);

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

-- ---------------------------------------------------------------------------
-- User (profile) RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lp_user_suspend(p_user_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_provider_id uuid;
BEGIN
  PERFORM private.lp_lifecycle_require_reason(p_reason);
  SELECT o_company_id, o_provider_id
  INTO v_company_id, v_provider_id
  FROM private.lp_assert_user_lifecycle_access(p_user_id);

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND suspended_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'already_suspended', true);
  END IF;

  UPDATE public.profiles
  SET suspended_at = now(),
      suspended_by = auth.uid(),
      suspended_reason = p_reason
  WHERE id = p_user_id;

  PERFORM private.lp_lifecycle_audit(
    'suspend', 'user', p_user_id, p_reason,
    jsonb_build_object('company_id', v_company_id, 'provider_id', v_provider_id)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_user_pause(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_provider_id uuid;
BEGIN
  SELECT o_company_id, o_provider_id
  INTO v_company_id, v_provider_id
  FROM private.lp_assert_user_lifecycle_access(p_user_id);

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND paused_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'already_paused', true);
  END IF;

  UPDATE public.profiles SET paused_at = now() WHERE id = p_user_id;

  PERFORM private.lp_lifecycle_audit(
    'pause', 'user', p_user_id, NULL,
    jsonb_build_object('company_id', v_company_id, 'provider_id', v_provider_id)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_user_delete(
  p_user_id uuid,
  p_reason text,
  p_gdpr boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_provider_id uuid;
  v_meta jsonb;
BEGIN
  PERFORM private.lp_lifecycle_require_reason(p_reason);
  SELECT o_company_id, o_provider_id
  INTO v_company_id, v_provider_id
  FROM private.lp_assert_user_lifecycle_access(p_user_id);

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND deleted_at IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', true, 'already_deleted', true);
  END IF;

  UPDATE public.profiles
  SET deleted_at = now(),
      full_name = CASE WHEN p_gdpr THEN NULL ELSE full_name END,
      phone = CASE WHEN p_gdpr THEN NULL ELSE phone END
  WHERE id = p_user_id;

  IF p_gdpr THEN
    UPDATE auth.users
    SET email = 'deleted-' || p_user_id::text || '@deleted.local',
        banned_until = '9999-12-31 00:00:00+00'::timestamptz
    WHERE id = p_user_id;
  END IF;

  v_meta := jsonb_build_object(
    'company_id', v_company_id,
    'provider_id', v_provider_id,
    'gdpr_invoked', coalesce(p_gdpr, false)
  );

  PERFORM private.lp_lifecycle_audit('delete', 'user', p_user_id, p_reason, v_meta);

  RETURN jsonb_build_object('ok', true, 'gdpr_invoked', coalesce(p_gdpr, false));
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_user_resume(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_provider_id uuid;
BEGIN
  SELECT o_company_id, o_provider_id
  INTO v_company_id, v_provider_id
  FROM private.lp_assert_user_lifecycle_access(p_user_id);

  UPDATE public.profiles
  SET suspended_at = NULL,
      suspended_by = NULL,
      suspended_reason = NULL,
      paused_at = NULL
  WHERE id = p_user_id;

  PERFORM private.lp_lifecycle_audit(
    'resume', 'user', p_user_id, NULL,
    jsonb_build_object('company_id', v_company_id, 'provider_id', v_provider_id)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.lp_provider_suspend(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lp_provider_pause(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lp_provider_delete(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lp_provider_resume(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lp_company_suspend(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lp_company_pause(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lp_company_delete(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lp_company_resume(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lp_user_suspend(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lp_user_pause(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lp_user_delete(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lp_user_resume(uuid) TO authenticated;

DO $$
DECLARE
  v_missing int;
BEGIN
  SELECT count(*) INTO v_missing
  FROM unnest(ARRAY[
    'lp_provider_suspend', 'lp_provider_pause', 'lp_provider_delete', 'lp_provider_resume',
    'lp_company_suspend', 'lp_company_pause', 'lp_company_delete', 'lp_company_resume',
    'lp_user_suspend', 'lp_user_pause', 'lp_user_delete', 'lp_user_resume'
  ]) AS fn(name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = fn.name AND p.prosecdef
  );

  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Patch 7: % lifecycle RPC(s) missing or not SECURITY DEFINER', v_missing;
  END IF;
END
$$;
