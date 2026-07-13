-- Global launch P0 (Fase A / A1): archived-org guard for custom_access_token_hook.
-- Additive only. Does NOT modify historical migrations.
--
-- Gap closed: the Fase 2 hook (20260708120000) filtered on membership status only.
-- A membership in an archived organization (companies.status CLOSED/TERMINATED,
-- providers.status CLOSED) could still mint active_org_id / active_role claims.
--
-- Fail-closed rule: archived org => membership excluded from claims entirely
-- (both `memberships` array and active_* selection). Zero remaining memberships
-- => no active_* claims (same behavior as zero-membership users).
--
-- Reversible: re-run 20260708120000 hook body + DROP FUNCTION public.lp_org_is_archived(uuid).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Helper: archived/terminal organization check (spine + live legacy truth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_org_is_archived(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.organizations o
      WHERE o.id = p_org_id
        AND upper(coalesce(o.status, '')) IN ('CLOSED', 'TERMINATED')
    )
    OR EXISTS (
      SELECT 1
      FROM public.companies c
      WHERE c.id = p_org_id
        AND c.status IN ('CLOSED'::public.company_status, 'TERMINATED'::public.company_status)
    )
    OR EXISTS (
      SELECT 1
      FROM public.providers p
      WHERE p.id = p_org_id
        AND p.status = 'CLOSED'::public.provider_status
    );
$$;

COMMENT ON FUNCTION public.lp_org_is_archived(uuid) IS
  'Fail-closed archived-org check for JWT mint: spine organizations.status OR live companies/providers terminal status.';

REVOKE ALL ON FUNCTION public.lp_org_is_archived(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lp_org_is_archived(uuid) FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.lp_org_is_archived(uuid) TO supabase_auth_admin, service_role;

-- Live-truth reads used by the helper when invoked by supabase_auth_admin directly.
GRANT SELECT ON TABLE public.companies TO supabase_auth_admin;
GRANT SELECT ON TABLE public.providers TO supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- 2) custom_access_token_hook — identical to Fase 2 shadow hook + archived-org guard
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user uuid;
  v_claims jsonb;
  v_is_platform_admin boolean := false;
  v_memberships_json jsonb := '[]'::jsonb;
  v_active_org_id uuid;
  v_active_role public.app_role;
  v_active_location_id uuid;
  v_preferred_id uuid;
  v_active_count int := 0;
BEGIN
  v_user := NULLIF(event->>'user_id', '')::uuid;
  IF v_user IS NULL THEN
    RETURN event;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = v_user
  )
  INTO v_is_platform_admin;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'org_id', m.org_id::text,
        'role', m.role::text,
        'location_id', to_jsonb(m.location_id::text)
      )
      ORDER BY m.org_id, m.role::text, m.location_id NULLS FIRST
    ),
    '[]'::jsonb
  )
  INTO v_memberships_json
  FROM public.memberships m
  WHERE m.user_id = v_user
    AND m.status = 'active'::public.membership_status
    AND NOT public.lp_org_is_archived(m.org_id);

  v_active_count := jsonb_array_length(v_memberships_json);

  IF v_active_count > 0 THEN
    SELECT p.preferred_spine_membership_id
    INTO v_preferred_id
    FROM public.profiles p
    WHERE p.id = v_user;

    IF v_preferred_id IS NOT NULL THEN
      SELECT m.org_id, m.role, m.location_id
      INTO v_active_org_id, v_active_role, v_active_location_id
      FROM public.memberships m
      WHERE m.id = v_preferred_id
        AND m.user_id = v_user
        AND m.status = 'active'::public.membership_status
        AND NOT public.lp_org_is_archived(m.org_id);
    END IF;

    IF v_active_org_id IS NULL THEN
      IF v_active_count = 1 THEN
        SELECT m.org_id, m.role, m.location_id
        INTO v_active_org_id, v_active_role, v_active_location_id
        FROM public.memberships m
        WHERE m.user_id = v_user
          AND m.status = 'active'::public.membership_status
          AND NOT public.lp_org_is_archived(m.org_id);
      ELSE
        SELECT m.org_id, m.role, m.location_id
        INTO v_active_org_id, v_active_role, v_active_location_id
        FROM public.memberships m
        WHERE m.user_id = v_user
          AND m.status = 'active'::public.membership_status
          AND NOT public.lp_org_is_archived(m.org_id)
        ORDER BY
          CASE m.role
            WHEN 'company_admin'::public.app_role THEN 1
            WHEN 'provider_admin'::public.app_role THEN 2
            WHEN 'orderer'::public.app_role THEN 3
            WHEN 'kitchen'::public.app_role THEN 4
            WHEN 'driver'::public.app_role THEN 5
            ELSE 99
          END,
          m.location_id NULLS LAST,
          m.org_id
        LIMIT 1;
      END IF;
    END IF;
  END IF;

  v_claims := COALESCE(event->'claims', '{}'::jsonb);
  v_claims := jsonb_set(v_claims, '{is_platform_admin}', to_jsonb(v_is_platform_admin), true);
  v_claims := jsonb_set(v_claims, '{memberships}', v_memberships_json, true);

  IF v_active_org_id IS NOT NULL AND v_active_role IS NOT NULL THEN
    v_claims := jsonb_set(v_claims, '{active_org_id}', to_jsonb(v_active_org_id::text), true);
    v_claims := jsonb_set(v_claims, '{active_role}', to_jsonb(v_active_role::text), true);
    IF v_active_location_id IS NULL THEN
      v_claims := v_claims - 'active_location_id';
    ELSE
      v_claims := jsonb_set(
        v_claims,
        '{active_location_id}',
        to_jsonb(v_active_location_id::text),
        true
      );
    END IF;
  ELSE
    v_claims := v_claims - 'active_org_id' - 'active_role' - 'active_location_id';
  END IF;

  RETURN jsonb_set(event, '{claims}', v_claims, true);
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'custom_access_token_hook failed for user %: %', v_user, SQLERRM;
    RETURN event;
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'Supabase custom access token hook. Emits top-level spine claims; archived orgs excluded (fail-closed); fail-safe returns event unchanged on error.';

COMMIT;
