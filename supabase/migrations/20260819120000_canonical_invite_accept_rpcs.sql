-- CANONICAL INVITATION ACCEPTANCE (Fase 3): atomic profile bind + membership
-- sync + invite consume in ONE transaction, idempotent and fail-closed.
--
-- Auth-user creation stays in app code (Supabase admin API); these RPCs run
-- AFTER the user + profile row exist and perform the tenant binding atomically.
-- The existing profiles→memberships sync trigger (trg_profiles_sync_memberships)
-- fires inside the same statement, so company/location memberships are created
-- atomically with the profile bind.
--
-- Fail-closed rules (raise P0001 with a stable token the app maps to 4xx):
--   INVITE_INVALID     — no invite for token_hash
--   INVITE_EXPIRED     — expires_at passed
--   INVITE_REVOKED     — company invite revoked_at set
--   INVITE_USED        — already consumed by a DIFFERENT user
--   INVITE_CORRUPT     — missing company_id
--   INVITE_EMAIL_MISMATCH — auth email != invite email (wrong recipient)
--   COMPANY_MISMATCH   — user already bound to another company
-- Idempotent: re-accepting an already-consumed invite by the SAME already-bound
-- user returns ok (no error), so a retried request after a network blip is safe.
--
-- SECURITY DEFINER + pinned search_path. EXECUTE granted to service_role only
-- (called via the service-role admin client) — never anon/authenticated.
-- RLS: intentionally unchanged.

BEGIN;

CREATE OR REPLACE FUNCTION public.lp_employee_invite_accept(
  p_user_id uuid,
  p_token_hash text,
  p_email text,
  p_full_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_invite public.employee_invites%rowtype;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_profile_company uuid;
  v_final_name text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED' USING errcode = 'P0001';
  END IF;
  IF coalesce(trim(p_token_hash), '') = '' THEN
    RAISE EXCEPTION 'INVITE_INVALID' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_invite
  FROM public.employee_invites
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_INVALID' USING errcode = 'P0001';
  END IF;

  IF v_invite.company_id IS NULL THEN
    RAISE EXCEPTION 'INVITE_CORRUPT' USING errcode = 'P0001';
  END IF;

  IF v_email = '' OR lower(trim(coalesce(v_invite.email, ''))) <> v_email THEN
    RAISE EXCEPTION 'INVITE_EMAIL_MISMATCH' USING errcode = 'P0001';
  END IF;

  -- Idempotency: already consumed.
  IF v_invite.used_at IS NOT NULL THEN
    SELECT company_id INTO v_profile_company FROM public.profiles WHERE id = p_user_id;
    IF v_profile_company IS NOT DISTINCT FROM v_invite.company_id THEN
      RETURN jsonb_build_object(
        'ok', true, 'idempotent', true,
        'company_id', v_invite.company_id, 'location_id', v_invite.location_id,
        'email', v_email
      );
    END IF;
    RAISE EXCEPTION 'INVITE_USED' USING errcode = 'P0001';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'INVITE_EXPIRED' USING errcode = 'P0001';
  END IF;

  SELECT company_id INTO v_profile_company FROM public.profiles WHERE id = p_user_id;
  IF v_profile_company IS NOT NULL AND v_profile_company <> v_invite.company_id THEN
    RAISE EXCEPTION 'COMPANY_MISMATCH' USING errcode = 'P0001';
  END IF;

  v_final_name := nullif(trim(coalesce(p_full_name, '')), '');
  IF v_final_name IS NULL THEN
    v_final_name := nullif(trim(coalesce(v_invite.full_name, '')), '');
  END IF;

  -- Atomic bind (fires membership + tenant-integrity triggers in this tx).
  UPDATE public.profiles
  SET email = v_email,
      full_name = coalesce(v_final_name, full_name),
      role = 'employee'::public.user_role,
      company_id = v_invite.company_id,
      location_id = v_invite.location_id,
      active = true,
      is_active = true,
      disabled_at = NULL,
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING errcode = 'P0001';
  END IF;

  UPDATE public.employee_invites
  SET used_at = now(),
      accepted_at = now(),
      full_name = coalesce(v_final_name, full_name)
  WHERE id = v_invite.id AND used_at IS NULL;

  RETURN jsonb_build_object(
    'ok', true, 'idempotent', false,
    'company_id', v_invite.company_id, 'location_id', v_invite.location_id,
    'email', v_email
  );
END;
$$;

COMMENT ON FUNCTION public.lp_employee_invite_accept(uuid, text, text, text) IS
  'Fase 3 canonical employee invite acceptance: atomic profile bind + membership sync + invite consume, idempotent, fail-closed. service_role only.';

CREATE OR REPLACE FUNCTION public.lp_company_admin_invite_accept(
  p_user_id uuid,
  p_token_hash text,
  p_email text,
  p_full_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_invite public.company_invites%rowtype;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_profile_company uuid;
  v_final_name text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'USER_ID_REQUIRED' USING errcode = 'P0001';
  END IF;
  IF coalesce(trim(p_token_hash), '') = '' THEN
    RAISE EXCEPTION 'INVITE_INVALID' USING errcode = 'P0001';
  END IF;

  SELECT * INTO v_invite
  FROM public.company_invites
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_INVALID' USING errcode = 'P0001';
  END IF;

  IF v_invite.company_id IS NULL THEN
    RAISE EXCEPTION 'INVITE_CORRUPT' USING errcode = 'P0001';
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'INVITE_REVOKED' USING errcode = 'P0001';
  END IF;

  IF v_email = '' OR lower(trim(coalesce(v_invite.contact_email, ''))) <> v_email THEN
    RAISE EXCEPTION 'INVITE_EMAIL_MISMATCH' USING errcode = 'P0001';
  END IF;

  IF v_invite.used_at IS NOT NULL THEN
    SELECT company_id INTO v_profile_company FROM public.profiles WHERE id = p_user_id;
    IF v_profile_company IS NOT DISTINCT FROM v_invite.company_id THEN
      RETURN jsonb_build_object(
        'ok', true, 'idempotent', true,
        'company_id', v_invite.company_id, 'email', v_email
      );
    END IF;
    RAISE EXCEPTION 'INVITE_USED' USING errcode = 'P0001';
  END IF;

  IF v_invite.expires_at IS NULL OR v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'INVITE_EXPIRED' USING errcode = 'P0001';
  END IF;

  SELECT company_id INTO v_profile_company FROM public.profiles WHERE id = p_user_id;
  IF v_profile_company IS NOT NULL AND v_profile_company <> v_invite.company_id THEN
    RAISE EXCEPTION 'COMPANY_MISMATCH' USING errcode = 'P0001';
  END IF;

  v_final_name := nullif(trim(coalesce(p_full_name, '')), '');
  IF v_final_name IS NULL THEN
    v_final_name := nullif(trim(coalesce(v_invite.contact_name, '')), '');
  END IF;

  UPDATE public.profiles
  SET email = v_email,
      full_name = coalesce(v_final_name, full_name),
      role = 'company_admin'::public.user_role,
      company_id = v_invite.company_id,
      active = true,
      is_active = true,
      disabled_at = NULL,
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND' USING errcode = 'P0001';
  END IF;

  UPDATE public.company_invites
  SET used_at = now(), accepted_at = now()
  WHERE id = v_invite.id AND used_at IS NULL;

  RETURN jsonb_build_object(
    'ok', true, 'idempotent', false,
    'company_id', v_invite.company_id, 'email', v_email
  );
END;
$$;

COMMENT ON FUNCTION public.lp_company_admin_invite_accept(uuid, text, text, text) IS
  'Fase 3 canonical company-admin invite acceptance: atomic profile bind + membership sync + invite consume, idempotent, fail-closed. service_role only.';

-- Grants: service-role client only (Phase 1 anon/authenticated lockdown preserved).
REVOKE ALL ON FUNCTION public.lp_employee_invite_accept(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lp_employee_invite_accept(uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lp_employee_invite_accept(uuid, text, text, text) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.lp_company_admin_invite_accept(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lp_company_admin_invite_accept(uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lp_company_admin_invite_accept(uuid, text, text, text) TO service_role, postgres;

COMMIT;
