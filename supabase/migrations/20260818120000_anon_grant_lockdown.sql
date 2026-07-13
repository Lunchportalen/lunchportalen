-- SECURITY / TENANT ISOLATION (Fase 1 security): anon grant lockdown.
--
-- Closes audit finding #22 (CONTRADICTIONS-AND-GAPS): the prod baseline carries
-- `GRANT ALL ... TO anon` on order/company/tenant tables and EXECUTE for anon on
-- lp_* RPCs (including lp_order_advance_status). RLS + in-function asserts were
-- the only backstop. This migration removes the anon surface entirely.
--
-- RLS: intentionally unchanged (policies are not touched; grants only).
--
-- Verified anon dependencies in the app (kept working):
--   * lp_company_registration_create — called with the anon key by the public
--     /registrer server action (SECURITY DEFINER, fail-closed inside).
--     -> anon EXECUTE is explicitly re-granted for exactly this function.
--   * All other public routes/actions use the service-role client or an
--     authenticated session client (verified by call-site audit 2026-07-13).
--
-- authenticated is preserved exactly as-is for functions: effective EXECUTE is
-- snapshotted before revoking PUBLIC, and re-granted only where it existed.
-- (The 20260609150000 internal-RPC lockdown therefore stays intact.)
--
-- Idempotent: REVOKE/GRANT are no-ops when already applied.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Tables, views, sequences: remove the anon surface (RLS remains).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_tables integer := 0;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm')
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon', r.nspname, r.relname);
    v_tables := v_tables + 1;
  END LOOP;

  FOR r IN
    SELECT n.nspname, c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %I.%I FROM anon', r.nspname, r.relname);
  END LOOP;

  RAISE NOTICE 'anon_grant_lockdown: tables/views revoked from anon = %', v_tables;

  IF v_tables = 0 THEN
    RAISE EXCEPTION 'anon_grant_lockdown: no tables found (fail-closed)';
  END IF;
END
$$;

-- Future objects created by the migration role must not regain anon grants.
DO $$
BEGIN
  BEGIN
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'anon_grant_lockdown: default-privilege change skipped (insufficient privilege)';
  END;
END
$$;

-- ---------------------------------------------------------------------------
-- 2) lp_* functions: kill PUBLIC/anon EXECUTE, preserve authenticated exactly.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_targets integer := 0;
  v_auth_kept integer := 0;
  v_had_authenticated boolean;
BEGIN
  FOR r IN
    SELECT
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname LIKE 'lp\_%' ESCAPE '\'
    ORDER BY p.proname, args
  LOOP
    v_targets := v_targets + 1;

    -- Snapshot BEFORE revoking (includes grants inherited via PUBLIC).
    v_had_authenticated := has_function_privilege('authenticated', r.oid, 'EXECUTE');

    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC', r.proname, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon', r.proname, r.args);

    IF v_had_authenticated THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args);
      v_auth_kept := v_auth_kept + 1;
    ELSE
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM authenticated', r.proname, r.args);
    END IF;

    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO postgres', r.proname, r.args);
  END LOOP;

  RAISE NOTICE 'anon_grant_lockdown: lp_ functions locked = %, authenticated preserved = %',
    v_targets, v_auth_kept;

  IF v_targets = 0 THEN
    RAISE EXCEPTION 'anon_grant_lockdown: no lp_ functions found (fail-closed)';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2b) Repair: lp_outbox_retry_event lost authenticated EXECUTE in the June
--     internal-RPC lockdown (20260609150000 matched the lp_outbox\_% prefix),
--     breaking the superadmin retry route (calls it with the session client).
--     The function is SECURITY DEFINER, pinned search_path, and self-gating
--     (is_platform_admin() -> 42501 for everyone else), so authenticated
--     EXECUTE is safe and required.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_granted integer := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'lp_outbox_retry_event'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated', r.proname, r.args);
    v_granted := v_granted + 1;
  END LOOP;

  IF v_granted = 0 THEN
    RAISE EXCEPTION 'anon_grant_lockdown: lp_outbox_retry_event not found (fail-closed)';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3) The single verified anon entry point: public /registrer registration.
--    SECURITY DEFINER with fail-closed validation inside the function.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
  v_granted integer := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'lp_company_registration_create'
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon', r.proname, r.args);
    v_granted := v_granted + 1;
  END LOOP;

  IF v_granted = 0 THEN
    RAISE EXCEPTION 'anon_grant_lockdown: lp_company_registration_create not found (fail-closed)';
  END IF;
END
$$;

COMMIT;
