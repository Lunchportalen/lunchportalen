-- Fundament Fase 1 review corrections (forward migration).
-- READ: prod diverged pre-review (fc05ce6e applied as 20260703120000).
-- Scope: spine-only adjustments to match 9712f00e intent + ops cleanup + test platform_admin removal.
-- Does NOT touch legacy tables (companies/providers/company_memberships/location_memberships).
-- Does NOT wire RLS or auth hooks to spine.
-- Idempotent: safe to re-run; second run should change 0 rows.

-- ---------------------------------------------------------------------------
-- 1) Ops M-LM exclusion helper
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
-- 2) R1a: memberships.location_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS location_id uuid REFERENCES public.company_locations (id);

-- ---------------------------------------------------------------------------
-- 3) R1b: populate location_id from legacy location_memberships
-- ---------------------------------------------------------------------------
UPDATE public.memberships m
SET
  location_id = lm.location_id,
  updated_at = GREATEST(m.updated_at, lm.updated_at)
FROM public.location_memberships lm
WHERE m.legacy_location_membership_id = lm.id
  AND m.location_id IS DISTINCT FROM lm.location_id;

-- ---------------------------------------------------------------------------
-- 4) OPS DELETE: remove customer-side spine rows for kitchen@/driver@
-- ---------------------------------------------------------------------------
DELETE FROM public.memberships m
USING public.organizations o, auth.users u
WHERE m.org_id = o.id
  AND m.user_id = u.id
  AND o.type = 'customer'::public.org_type
  AND lower(u.email) IN ('kitchen@lunchportalen.no', 'driver@lunchportalen.no');

-- ---------------------------------------------------------------------------
-- 5) Unique constraint swap (user_id, org_id, role, location_id) NULLS NOT DISTINCT
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
      'fundament review correction: % duplicate (user_id, org_id, role, location_id) groups — aborting unique swap',
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
-- 6) R3: rename customer_provider_org_id → legacy_provider_id
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
  'Transitorisk; droppes etter FASE-3 provider-FK-cutover. Customer org → provider org id (from companies.provider_id).';

-- ---------------------------------------------------------------------------
-- 7) R4a: organizations.metadata + transitory markers (Lunchportalen AS/QA)
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

-- ---------------------------------------------------------------------------
-- 8) R4b: memberships.metadata + source_rule; M-PR transitory markers
-- ---------------------------------------------------------------------------
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
-- 9) R2: lp_fundament_map_membership_status — no revoked→suspended
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
-- 10) platform_admins: remove test-domain superadmin (not prod operator)
-- ---------------------------------------------------------------------------
DELETE FROM public.platform_admins pa
USING auth.users u
WHERE pa.user_id = u.id
  AND lower(u.email) LIKE '%@test.lunchportalen.no';

COMMENT ON TABLE public.platform_admins IS
  'Platform administrators (Fase 1). Parallel to profiles.role=superadmin; not wired to auth/RLS yet. Test-domain identities (e.g. @test.lunchportalen.no) are excluded from prod spine.';
