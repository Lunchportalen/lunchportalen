-- Fundament Fase 1 review corrections — forward reconcile (PR-B).
-- READ: 20260703120000 may be recorded applied while review adjustments were never executed.
-- 20260707120000 holds the original review migration; this file re-applies the same intent
-- idempotently with entry/exit asserts. Safe no-op when review state already correct.
-- Does NOT touch legacy tables, RLS policies, auth hooks, or RLS-cutover.
-- Idempotent: second run changes 0 rows; aborts on unexpected partial state.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Ops M-LM exclusion helper (inert; Fase 4 pension)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_fundament_is_ops_lm_excluded(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_user_id
      AND (
        lower(u.email) = 'kitchen@lunchportalen.no'
        OR lower(u.email) = 'driver@lunchportalen.no'
      )
  );
$$;

COMMENT ON FUNCTION public.lp_fundament_is_ops_lm_excluded(uuid) IS
  'M-LM exclusion: kitchen@/driver@ location_memberships are not copied to spine (M-PR only). Fase 4 pension.';

-- ---------------------------------------------------------------------------
-- 1) memberships.location_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.company_locations (id);

-- ---------------------------------------------------------------------------
-- 2) Populate location_id from legacy location_memberships
-- ---------------------------------------------------------------------------
UPDATE public.memberships m
SET
  location_id = lm.location_id,
  updated_at = GREATEST(m.updated_at, lm.updated_at)
FROM public.location_memberships lm
WHERE m.legacy_location_membership_id = lm.id
  AND m.location_id IS DISTINCT FROM lm.location_id;

-- ---------------------------------------------------------------------------
-- 3) ENTRY ASSERTS (before destructive ops) — fail-closed, predicate-based
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_real_operator_count int;
  v_provider_ops_before int;
  v_customer_ops_before int;
BEGIN
  SELECT COUNT(*)::int
  INTO v_real_operator_count
  FROM public.platform_admins pa
  JOIN auth.users u ON u.id = pa.user_id
  WHERE lower(u.email) = 'superadmin@lunchportalen.no';

  IF v_real_operator_count < 1 THEN
    RAISE EXCEPTION
      'fundament spine reconcile entry: prod operator (superadmin@lunchportalen.no) missing from platform_admins';
  END IF;

  SELECT COUNT(*)::int
  INTO v_provider_ops_before
  FROM public.memberships m
  JOIN public.organizations o ON o.id = m.org_id
  JOIN auth.users u ON u.id = m.user_id
  WHERE o.type = 'provider'::public.org_type
    AND lower(u.email) IN ('kitchen@lunchportalen.no', 'driver@lunchportalen.no');

  SELECT COUNT(*)::int
  INTO v_customer_ops_before
  FROM public.memberships m
  JOIN public.organizations o ON o.id = m.org_id
  JOIN auth.users u ON u.id = m.user_id
  WHERE o.type = 'customer'::public.org_type
    AND lower(u.email) IN ('kitchen@lunchportalen.no', 'driver@lunchportalen.no');

  IF v_customer_ops_before > 0 AND v_provider_ops_before = 0 THEN
    RAISE EXCEPTION
      'fundament spine reconcile entry: kitchen/driver customer rows (% ) exist but no provider ops rows — unsafe to delete',
      v_customer_ops_before;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 4) OPS DELETE: customer-side spine rows for kitchen@/driver@ only
-- ---------------------------------------------------------------------------
DELETE FROM public.memberships m
USING public.organizations o, auth.users u
WHERE m.org_id = o.id
  AND m.user_id = u.id
  AND o.type = 'customer'::public.org_type
  AND lower(u.email) IN ('kitchen@lunchportalen.no', 'driver@lunchportalen.no');

-- ---------------------------------------------------------------------------
-- 5) Unique constraint swap — after destructive cleanup + location_id populate
-- ---------------------------------------------------------------------------
ALTER TABLE public.memberships
  DROP CONSTRAINT IF EXISTS memberships_user_org_role_uniq;

DO $$
DECLARE
  v_conflict_groups bigint;
BEGIN
  SELECT COUNT(*) INTO v_conflict_groups
  FROM (
    SELECT user_id, org_id, role, location_id, COUNT(*) AS n
    FROM public.memberships
    GROUP BY user_id, org_id, role, location_id
    HAVING COUNT(*) > 1
  ) d;

  IF v_conflict_groups > 0 THEN
    RAISE EXCEPTION
      'fundament spine reconcile: % duplicate (user_id, org_id, role, location_id) groups — aborting unique swap',
      v_conflict_groups;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.memberships'::regclass
      AND conname = 'memberships_user_org_role_location_uniq'
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_user_org_role_location_uniq
      UNIQUE NULLS NOT DISTINCT (user_id, org_id, role, location_id);
  END IF;
END
$$;

COMMENT ON COLUMN public.memberships.location_id IS
  'Optional location scope (from location_memberships). NULL = org-wide membership. RLS not wired in Fase 1.';

-- ---------------------------------------------------------------------------
-- 6) legacy_provider_id rename (idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'customer_provider_org_id'
  ) THEN
    ALTER TABLE public.organizations
      RENAME COLUMN customer_provider_org_id TO legacy_provider_id;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'organizations_customer_provider_org_id_idx'
  ) THEN
    ALTER INDEX public.organizations_customer_provider_org_id_idx
      RENAME TO organizations_legacy_provider_id_idx;
  END IF;
END
$$;

COMMENT ON COLUMN public.organizations.legacy_provider_id IS
  'Transitional legacy provider reference; not canonical; drop after provider FK cutover.';

-- ---------------------------------------------------------------------------
-- 7) Metadata / markers
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.organizations o
SET metadata = jsonb_build_object(
  'transitory', true,
  'phase4_pension', 'platform_internal_customer',
  'legacy_company_name', o.name
)
FROM public.companies c
WHERE o.legacy_source = 'company'
  AND o.id = c.id
  AND c.name IN ('Lunchportalen AS', 'Lunchportalen QA')
  AND (
    o.metadata IS NULL
    OR o.metadata = '{}'::jsonb
    OR o.metadata->>'transitory' IS DISTINCT FROM 'true'
  );

COMMENT ON COLUMN public.organizations.metadata IS
  'Spine metadata. transitory=true + phase4_pension marks platform-internal orgs for Fase 4 retirement.';

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS source_rule text;

UPDATE public.memberships m
SET
  source_rule = 'M-PR',
  metadata = jsonb_build_object(
    'transitory', true,
    'phase4_pension', 'derived_profile_provider_binding',
    'source_rule', 'M-PR'
  ),
  updated_at = now()
FROM public.organizations o, auth.users u
WHERE m.org_id = o.id
  AND m.user_id = u.id
  AND o.type = 'provider'::public.org_type
  AND m.role IN ('kitchen'::public.app_role, 'driver'::public.app_role)
  AND lower(u.email) IN ('kitchen@lunchportalen.no', 'driver@lunchportalen.no')
  AND (
    m.source_rule IS DISTINCT FROM 'M-PR'
    OR m.metadata->>'transitory' IS DISTINCT FROM 'true'
    OR m.metadata->>'phase4_pension' IS DISTINCT FROM 'derived_profile_provider_binding'
  );

COMMENT ON COLUMN public.memberships.metadata IS
  'Spine metadata. transitory=true + phase4_pension marks derived ops bindings for Fase 4 retirement.';

COMMENT ON COLUMN public.memberships.source_rule IS
  'Backfill rule identifier (e.g. M-PR). Audit only; not wired to RLS in Fase 1.';

-- ---------------------------------------------------------------------------
-- 8) lp_fundament_map_membership_status — revoked is NOT mapped to suspended
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_fundament_map_membership_status(
  p_status public.membership_status,
  p_active boolean
)
RETURNS public.membership_status
LANGUAGE sql
IMMUTABLE
SET search_path TO public
AS $$
  SELECT CASE
    WHEN p_status = 'suspended'::public.membership_status THEN 'suspended'::public.membership_status
    WHEN p_status = 'invited'::public.membership_status THEN 'invited'::public.membership_status
    WHEN coalesce(p_active, true) = false THEN 'suspended'::public.membership_status
    ELSE 'active'::public.membership_status
  END;
$$;

COMMENT ON FUNCTION public.lp_fundament_map_membership_status(public.membership_status, boolean) IS
  'Spine backfill status map. status=revoked rows are excluded in INSERT (permanent removal ≠ suspended re-activation).';

-- ---------------------------------------------------------------------------
-- 9) platform_admins: remove test-domain superadmin only (predikat)
-- ---------------------------------------------------------------------------
DELETE FROM public.platform_admins pa
USING auth.users u
WHERE pa.user_id = u.id
  AND lower(u.email) LIKE '%@test.lunchportalen.no';

COMMENT ON TABLE public.platform_admins IS
  'Platform administrators (Fase 1). Parallel to profiles.role=superadmin; not wired to auth/RLS yet. Test-domain identities (e.g. @test.lunchportalen.no) are excluded from prod spine.';

-- ---------------------------------------------------------------------------
-- 10) EXIT ASSERTS — relative / predicate-based (safe on staging + prod)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_location_id_mismatch int;
  v_customer_ops int;
  v_test_pa int;
  v_real_pa int;
  v_expected_ops_provider int;
  v_actual_mpr int;
  v_revoked_on_spine int;
  v_map_fn_def text;
BEGIN
  SELECT COUNT(*)::int
  INTO v_location_id_mismatch
  FROM public.location_memberships lm
  JOIN public.memberships m ON m.legacy_location_membership_id = lm.id
  WHERE NOT public.lp_fundament_is_ops_lm_excluded(lm.user_id)
    AND m.location_id IS DISTINCT FROM lm.location_id;

  IF v_location_id_mismatch <> 0 THEN
    RAISE EXCEPTION
      'fundament spine reconcile exit: memberships.location_id mismatch vs location_memberships = %',
      v_location_id_mismatch;
  END IF;

  SELECT COUNT(*)::int
  INTO v_revoked_on_spine
  FROM public.memberships
  WHERE status = 'revoked'::public.membership_status;

  IF v_revoked_on_spine <> 0 THEN
    RAISE EXCEPTION
      'fundament spine reconcile exit: memberships status=revoked count = % (expected 0)',
      v_revoked_on_spine;
  END IF;

  SELECT COUNT(*)::int
  INTO v_customer_ops
  FROM public.memberships m
  JOIN public.organizations o ON o.id = m.org_id
  JOIN auth.users u ON u.id = m.user_id
  WHERE o.type = 'customer'::public.org_type
    AND lower(u.email) IN ('kitchen@lunchportalen.no', 'driver@lunchportalen.no');

  IF v_customer_ops <> 0 THEN
    RAISE EXCEPTION
      'fundament spine reconcile exit: kitchen/driver customer-side spine rows = % (expected 0)',
      v_customer_ops;
  END IF;

  SELECT COUNT(*)::int
  INTO v_expected_ops_provider
  FROM auth.users u
  WHERE lower(u.email) IN ('kitchen@lunchportalen.no', 'driver@lunchportalen.no');

  SELECT COUNT(*)::int
  INTO v_actual_mpr
  FROM public.memberships m
  JOIN public.organizations o ON o.id = m.org_id
  JOIN auth.users u ON u.id = m.user_id
  WHERE o.type = 'provider'::public.org_type
    AND m.role IN ('kitchen'::public.app_role, 'driver'::public.app_role)
    AND m.source_rule = 'M-PR'
    AND m.metadata->>'transitory' = 'true'
    AND lower(u.email) IN ('kitchen@lunchportalen.no', 'driver@lunchportalen.no');

  IF v_expected_ops_provider > 0 AND v_actual_mpr <> v_expected_ops_provider THEN
    RAISE EXCEPTION
      'fundament spine reconcile exit: provider M-PR ops rows = % (expected % for kitchen@/driver@)',
      v_actual_mpr,
      v_expected_ops_provider;
  END IF;

  SELECT COUNT(*)::int
  INTO v_test_pa
  FROM public.platform_admins pa
  JOIN auth.users u ON u.id = pa.user_id
  WHERE lower(u.email) LIKE '%@test.lunchportalen.no';

  IF v_test_pa <> 0 THEN
    RAISE EXCEPTION
      'fundament spine reconcile exit: test-domain platform_admins = % (expected 0)',
      v_test_pa;
  END IF;

  SELECT COUNT(*)::int
  INTO v_real_pa
  FROM public.platform_admins pa
  JOIN auth.users u ON u.id = pa.user_id
  WHERE lower(u.email) = 'superadmin@lunchportalen.no';

  IF v_real_pa < 1 THEN
    RAISE EXCEPTION
      'fundament spine reconcile exit: prod operator missing from platform_admins after cleanup';
  END IF;

  SELECT pg_get_functiondef(p.oid)
  INTO v_map_fn_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'lp_fundament_map_membership_status'
  LIMIT 1;

  IF v_map_fn_def IS NULL THEN
    RAISE EXCEPTION
      'fundament spine reconcile exit: lp_fundament_map_membership_status missing';
  END IF;

  IF v_map_fn_def ~* 'revoked.*suspended|suspended.*revoked' THEN
    RAISE EXCEPTION
      'fundament spine reconcile exit: lp_fundament_map_membership_status still maps revoked→suspended';
  END IF;
END
$$;

COMMIT;
