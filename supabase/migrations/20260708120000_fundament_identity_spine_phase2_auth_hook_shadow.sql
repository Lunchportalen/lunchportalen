-- Fundament Fase 2: custom access token hook + JWT claim helpers (SHADOW).
-- READ: ratified FASE 2 design (2026-06-07).
-- Scope: additive hook, helpers, preference column, hook query index.
-- Does NOT enable Auth hook (Dashboard operator step).
-- Does NOT wire RLS to spine claims (Fase 3).
-- Reversible: DROP functions + column + index (hook disable in Dashboard first).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Preference column — validated by hook against active memberships
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_spine_membership_id uuid
  REFERENCES public.memberships (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.preferred_spine_membership_id IS
  'Optional active spine membership for JWT mint. Hook validates status=active + user ownership; else deterministic fallback.';

-- ---------------------------------------------------------------------------
-- 2) Hook query index (memberships user_id + status)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS memberships_user_id_status_idx
  ON public.memberships (user_id, status);

-- platform_admins.user_id is PRIMARY KEY — no extra index required.

-- ---------------------------------------------------------------------------
-- 3) JWT claim helpers (STABLE — unused by RLS until Fase 3)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_active_org()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT NULLIF(auth.jwt()->>'active_org_id', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.app_active_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT NULLIF(auth.jwt()->>'active_role', '')::public.app_role;
$$;

CREATE OR REPLACE FUNCTION public.app_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT COALESCE((auth.jwt()->>'is_platform_admin')::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.app_active_location_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT NULLIF(auth.jwt()->>'active_location_id', '')::uuid;
$$;

COMMENT ON FUNCTION public.app_active_org() IS
  'Fase 2 shadow helper: reads top-level JWT claim active_org_id. Not wired to RLS until Fase 3.';
COMMENT ON FUNCTION public.app_active_role() IS
  'Fase 2 shadow helper: reads top-level JWT claim active_role. Not wired to RLS until Fase 3.';
COMMENT ON FUNCTION public.app_is_platform_admin() IS
  'Fase 2 shadow helper: reads top-level JWT claim is_platform_admin. Not wired to RLS until Fase 3.';
COMMENT ON FUNCTION public.app_active_location_id() IS
  'Fase 2 shadow helper: reads top-level JWT claim active_location_id. Not wired to RLS until Fase 3.';

-- ---------------------------------------------------------------------------
-- 4) custom_access_token_hook — fail-safe, no PII, top-level claims
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
    AND m.status = 'active'::public.membership_status;

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
        AND m.status = 'active'::public.membership_status;
    END IF;

    IF v_active_org_id IS NULL THEN
      IF v_active_count = 1 THEN
        SELECT m.org_id, m.role, m.location_id
        INTO v_active_org_id, v_active_role, v_active_location_id
        FROM public.memberships m
        WHERE m.user_id = v_user
          AND m.status = 'active'::public.membership_status;
      ELSE
        SELECT m.org_id, m.role, m.location_id
        INTO v_active_org_id, v_active_role, v_active_location_id
        FROM public.memberships m
        WHERE m.user_id = v_user
          AND m.status = 'active'::public.membership_status
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
  'Supabase custom access token hook (Fase 2 shadow). Emits top-level spine claims; fail-safe returns event unchanged on error.';

-- ---------------------------------------------------------------------------
-- 5) Grants — hook callable only by supabase_auth_admin; spine read for mint
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

GRANT SELECT ON TABLE public.memberships TO supabase_auth_admin;
GRANT SELECT ON TABLE public.platform_admins TO supabase_auth_admin;
GRANT SELECT ON TABLE public.profiles TO supabase_auth_admin;

GRANT EXECUTE ON FUNCTION public.app_active_org() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.app_active_role() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.app_is_platform_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.app_active_location_id() TO authenticated, anon, service_role;

COMMIT;
