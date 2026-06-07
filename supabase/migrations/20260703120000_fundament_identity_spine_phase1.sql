-- Fundament Fase 1: additive unified identity spine (strangler-fig).
-- READ: docs/discovery/fundament-schema-delta-2026-06-07.md
-- Scope: NEW objects + deterministic backfill ONLY.
-- Does NOT touch orders, agreements, legacy membership tables, RLS, or auth hooks.
-- Reversible: DROP new tables/types/functions created here.

-- ---------------------------------------------------------------------------
-- 0) Enum guards (no collision with live names except membership_status REUSE)
-- ---------------------------------------------------------------------------
-- Live already has public.membership_status(invited, active, suspended, revoked).
-- Spec subset (invited, active, suspended) is enforced on public.memberships via CHECK.
-- Rows with status='revoked' are EXCLUDED from backfill (see lp_fundament_map_membership_status).
-- org_type and app_role do not exist in live (verified MCP 2026-06-07).

DO $$
BEGIN
  CREATE TYPE public.org_type AS ENUM ('provider', 'customer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'provider_admin',
    'kitchen',
    'driver',
    'company_admin',
    'orderer'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ---------------------------------------------------------------------------
-- 1) organizations — stable id = legacy company.id | provider.id
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY,
  type public.org_type NOT NULL,
  name text NOT NULL,
  slug text,
  org_number text,
  status text NOT NULL,
  legacy_source text NOT NULL,
  legacy_provider_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT organizations_legacy_source_chk CHECK (legacy_source IN ('company', 'provider')),
  CONSTRAINT organizations_legacy_provider_fk FOREIGN KEY (legacy_provider_id)
    REFERENCES public.organizations (id),
  CONSTRAINT organizations_customer_provider_presence_chk CHECK (
    (type = 'provider'::public.org_type AND legacy_provider_id IS NULL)
    OR (type = 'customer'::public.org_type AND legacy_provider_id IS NOT NULL)
  ),
  CONSTRAINT organizations_legacy_source_id_uniq UNIQUE (legacy_source, id)
);

CREATE INDEX IF NOT EXISTS organizations_type_idx ON public.organizations (type);
CREATE INDEX IF NOT EXISTS organizations_legacy_provider_id_idx
  ON public.organizations (legacy_provider_id)
  WHERE legacy_provider_id IS NOT NULL;

COMMENT ON TABLE public.organizations IS
  'Fundament identity spine (Fase 1). id preserves legacy companies.id / providers.id for later FK cutover.';
COMMENT ON COLUMN public.organizations.legacy_provider_id IS
  'Transitorisk: customer org → provider org id (from companies.provider_id). Droppes etter FASE-3 provider-FK-cutover.';
COMMENT ON COLUMN public.organizations.metadata IS
  'Spine metadata. transitory=true + phase4_pension marks platform-internal orgs for Fase 4 retirement.';

-- ---------------------------------------------------------------------------
-- 2) memberships — unique (user_id, org_id, role, location_id); lineage columns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.company_locations (id),
  role public.app_role NOT NULL,
  status public.membership_status NOT NULL DEFAULT 'active'::public.membership_status,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  legacy_company_membership_id uuid,
  legacy_location_membership_id uuid,
  legacy_provider_membership_id uuid,
  CONSTRAINT memberships_user_org_role_location_uniq
    UNIQUE NULLS NOT DISTINCT (user_id, org_id, role, location_id),
  CONSTRAINT memberships_legacy_company_membership_id_uniq UNIQUE (legacy_company_membership_id),
  CONSTRAINT memberships_legacy_location_membership_id_uniq UNIQUE (legacy_location_membership_id),
  CONSTRAINT memberships_legacy_provider_membership_id_uniq UNIQUE (legacy_provider_membership_id),
  CONSTRAINT memberships_status_subset_chk CHECK (
    status = ANY (ARRAY[
      'invited'::public.membership_status,
      'active'::public.membership_status,
      'suspended'::public.membership_status
    ])
  )
);

CREATE INDEX IF NOT EXISTS memberships_user_id_idx ON public.memberships (user_id);
CREATE INDEX IF NOT EXISTS memberships_org_id_idx ON public.memberships (org_id);
CREATE INDEX IF NOT EXISTS memberships_location_id_idx
  ON public.memberships (location_id)
  WHERE location_id IS NOT NULL;

COMMENT ON TABLE public.memberships IS
  'Unified membership spine (Fase 1). Parallel to legacy membership tables; not wired to RLS yet.';
COMMENT ON COLUMN public.memberships.location_id IS
  'Optional location scope (from location_memberships). NULL = org-wide membership. RLS not wired in Fase 1.';
COMMENT ON COLUMN public.memberships.metadata IS
  'Spine metadata. transitory=true + phase4_pension marks derived ops bindings for Fase 4 retirement.';

-- ---------------------------------------------------------------------------
-- 3) platform_admins — platform scope, not tenant RLS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL
);

COMMENT ON TABLE public.platform_admins IS
  'Platform administrators (Fase 1). Parallel to profiles.role=superadmin; not wired to auth/RLS yet.';

-- ---------------------------------------------------------------------------
-- 4) Role validity for org.type (fail-closed on invalid combos)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_role_valid_for_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_type public.org_type;
BEGIN
  SELECT o.type INTO v_type
  FROM public.organizations o
  WHERE o.id = NEW.org_id;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'assert_role_valid_for_org: org % not found', NEW.org_id;
  END IF;

  IF v_type = 'customer'::public.org_type
     AND NEW.role NOT IN (
       'company_admin'::public.app_role,
       'orderer'::public.app_role
     ) THEN
    RAISE EXCEPTION 'assert_role_valid_for_org: role % invalid for customer org %', NEW.role, NEW.org_id;
  END IF;

  IF v_type = 'provider'::public.org_type
     AND NEW.role NOT IN (
       'provider_admin'::public.app_role,
       'kitchen'::public.app_role,
       'driver'::public.app_role
     ) THEN
    RAISE EXCEPTION 'assert_role_valid_for_org: role % invalid for provider org %', NEW.role, NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_memberships_assert_role_valid_for_org ON public.memberships;
CREATE TRIGGER trg_memberships_assert_role_valid_for_org
  BEFORE INSERT OR UPDATE OF org_id, role ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.assert_role_valid_for_org();

-- ---------------------------------------------------------------------------
-- 5) Mapping helpers (immutable, idempotent backfill)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_fundament_map_membership_role(p_role public.membership_role)
RETURNS public.app_role
LANGUAGE sql
IMMUTABLE
SET search_path TO public
AS $$
  SELECT CASE p_role
    WHEN 'company_admin'::public.membership_role THEN 'company_admin'::public.app_role
    WHEN 'location_admin'::public.membership_role THEN 'company_admin'::public.app_role
    WHEN 'company_finance'::public.membership_role THEN 'orderer'::public.app_role
    ELSE 'orderer'::public.app_role
  END;
$$;

CREATE OR REPLACE FUNCTION public.lp_fundament_map_provider_role(p_role public.provider_role)
RETURNS public.app_role
LANGUAGE sql
IMMUTABLE
SET search_path TO public
AS $$
  SELECT CASE p_role
    WHEN 'provider_admin'::public.provider_role THEN 'provider_admin'::public.app_role
    WHEN 'provider_kitchen'::public.provider_role THEN 'kitchen'::public.app_role
    ELSE NULL::public.app_role
  END;
$$;

CREATE OR REPLACE FUNCTION public.lp_fundament_map_profile_role(p_role public.user_role)
RETURNS public.app_role
LANGUAGE sql
IMMUTABLE
SET search_path TO public
AS $$
  SELECT CASE p_role
    WHEN 'kitchen'::public.user_role THEN 'kitchen'::public.app_role
    WHEN 'provider_kitchen'::public.user_role THEN 'kitchen'::public.app_role
    WHEN 'driver'::public.user_role THEN 'driver'::public.app_role
    WHEN 'provider_admin'::public.user_role THEN 'provider_admin'::public.app_role
    ELSE NULL::public.app_role
  END;
$$;

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

-- Ops users excluded from M-LM (handled via M-PR only; legacy location_memberships remain authoritative until Fase 4).
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
-- 6) BACKFILL: organizations (providers first, then companies)
-- Rule O-T: Lunchportalen AS/QA marked transitory in metadata (Fase 4 pension)
-- ---------------------------------------------------------------------------
INSERT INTO public.organizations (
  id,
  type,
  name,
  slug,
  org_number,
  status,
  legacy_source,
  legacy_provider_id,
  metadata,
  created_at,
  updated_at
)
SELECT
  p.id,
  'provider'::public.org_type,
  p.name,
  p.slug,
  p.org_number,
  p.status::text,
  'provider',
  NULL,
  '{}'::jsonb,
  p.created_at,
  p.updated_at
FROM public.providers p
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (
  id,
  type,
  name,
  slug,
  org_number,
  status,
  legacy_source,
  legacy_provider_id,
  metadata,
  created_at,
  updated_at
)
SELECT
  c.id,
  'customer'::public.org_type,
  c.name,
  c.slug::text,
  coalesce(c.organization_number, c.orgnr),
  c.status::text,
  'company',
  c.provider_id,
  CASE
    WHEN c.name IN ('Lunchportalen AS', 'Lunchportalen QA') THEN
      jsonb_build_object(
        'transitory', true,
        'phase4_pension', 'platform_internal_customer',
        'legacy_company_name', c.name
      )
    ELSE '{}'::jsonb
  END,
  c.created_at,
  c.updated_at
FROM public.companies c
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7) BACKFILL: platform_admins
-- Rule PA-1: profiles.role = superadmin
-- Rule PA-2: if platform_user_roles has rows, also platform_admin role (prod: 0 rows)
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_admins (user_id, source)
SELECT p.id, 'profiles.role=superadmin'
FROM public.profiles p
WHERE p.role = 'superadmin'::public.user_role
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.platform_admins (user_id, source)
SELECT pur.user_id, 'platform_user_roles.role=platform_admin'
FROM public.platform_user_roles pur
WHERE pur.role = 'platform_admin'::public.platform_role
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8) BACKFILL: memberships
-- Rule M-CM: one row per company_memberships.id; exclude status=revoked
-- Rule M-LM-INSERT: eligible location_memberships (excl. kitchen@/driver@) where role triple new (5 prod)
-- Rule M-LM-MERGE: remaining eligible LM attach legacy_location_membership_id + location_id (27 prod)
-- Rule M-LM-EXCL: kitchen@/driver@ LM skipped (2 prod) — M-PR only
-- Rule M-PM: one row per provider_memberships.id (0 prod)
-- Rule M-PR: profiles operational roles on provider org via companies.provider_id (2 prod, transitory metadata)
-- ---------------------------------------------------------------------------

-- M-CM
INSERT INTO public.memberships (
  user_id,
  org_id,
  role,
  status,
  created_at,
  updated_at,
  legacy_company_membership_id
)
SELECT
  cm.user_id,
  cm.company_id,
  public.lp_fundament_map_membership_role(cm.role),
  public.lp_fundament_map_membership_status(cm.status, cm.active),
  cm.created_at,
  cm.updated_at,
  cm.id
FROM public.company_memberships cm
WHERE cm.status IS DISTINCT FROM 'revoked'::public.membership_status
ON CONFLICT (legacy_company_membership_id) DO NOTHING;

-- M-LM-INSERT (company_admin cm + employee lm → extra orderer row with location_id)
INSERT INTO public.memberships (
  user_id,
  org_id,
  location_id,
  role,
  status,
  created_at,
  updated_at,
  legacy_location_membership_id
)
SELECT
  lm.user_id,
  lm.company_id,
  lm.location_id,
  public.lp_fundament_map_membership_role(lm.role),
  public.lp_fundament_map_membership_status(NULL::public.membership_status, lm.active),
  lm.created_at,
  lm.updated_at,
  lm.id
FROM public.location_memberships lm
WHERE NOT public.lp_fundament_is_ops_lm_excluded(lm.user_id)
  AND NOT EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.user_id = lm.user_id
      AND m.org_id = lm.company_id
      AND m.role = public.lp_fundament_map_membership_role(lm.role)
  )
ON CONFLICT (legacy_location_membership_id) DO NOTHING;

-- M-LM-MERGE
UPDATE public.memberships m
SET
  legacy_location_membership_id = lm.id,
  location_id = lm.location_id,
  updated_at = GREATEST(m.updated_at, lm.updated_at)
FROM public.location_memberships lm
WHERE NOT public.lp_fundament_is_ops_lm_excluded(lm.user_id)
  AND m.legacy_location_membership_id IS NULL
  AND m.user_id = lm.user_id
  AND m.org_id = lm.company_id
  AND m.role = public.lp_fundament_map_membership_role(lm.role)
  AND m.location_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.memberships m2
    WHERE m2.legacy_location_membership_id = lm.id
  );

-- M-PM
INSERT INTO public.memberships (
  user_id,
  org_id,
  role,
  status,
  created_at,
  updated_at,
  legacy_provider_membership_id
)
SELECT
  pm.user_id,
  pm.provider_id,
  public.lp_fundament_map_provider_role(pm.role),
  'active'::public.membership_status,
  pm.created_at,
  pm.created_at,
  pm.id
FROM public.provider_memberships pm
WHERE public.lp_fundament_map_provider_role(pm.role) IS NOT NULL
ON CONFLICT (legacy_provider_membership_id) DO NOTHING;

-- M-PR (provider org membership from profiles.role; skips provider_viewer — no app_role)
INSERT INTO public.memberships (
  user_id,
  org_id,
  role,
  status,
  metadata,
  created_at,
  updated_at
)
SELECT
  p.id,
  c.provider_id,
  public.lp_fundament_map_profile_role(p.role),
  CASE
    WHEN coalesce(p.active, true) = false
      OR p.archived_at IS NOT NULL
      OR p.disabled_at IS NOT NULL
      OR p.deleted_at IS NOT NULL
      THEN 'suspended'::public.membership_status
    ELSE 'active'::public.membership_status
  END,
  jsonb_build_object(
    'transitory', true,
    'phase4_pension', 'derived_profile_provider_binding',
    'source_rule', 'M-PR'
  ),
  p.created_at,
  p.updated_at
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
WHERE p.company_id IS NOT NULL
  AND public.lp_fundament_map_profile_role(p.role) IS NOT NULL
ON CONFLICT (user_id, org_id, role, location_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 9) Access: spine not exposed to app yet (no RLS wiring)
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.organizations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.memberships FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.platform_admins FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.organizations TO service_role;
GRANT ALL ON TABLE public.memberships TO service_role;
GRANT ALL ON TABLE public.platform_admins TO service_role;
