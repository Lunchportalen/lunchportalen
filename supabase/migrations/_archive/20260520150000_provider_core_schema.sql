-- Patch 4 (Phase E.4) — Provider core schema (PROVIDER-PLAN-V1 §4.1–§4.2)
-- New tables: providers, provider_memberships, provider_service_areas, lifecycle_audit_log
-- No provider_id on existing tables (Patch 5). No RLS policies here (separate migration).
--
-- Naming note: PROVIDER-PLAN calls this audit_log; production already has public.audit_log
-- (B2c partitioned row-audit, 20260518125753). Entity lifecycle audit uses lifecycle_audit_log.

-- ENUMS
DO $$
BEGIN
  CREATE TYPE public.provider_status AS ENUM ('ACTIVE', 'PAUSED', 'SUSPENDED', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE public.provider_role AS ENUM ('provider_admin', 'provider_kitchen', 'provider_viewer');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- user_role extension (Patch 4.2)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'provider_admin';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'provider_kitchen';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'provider_viewer';

-- providers
CREATE TABLE IF NOT EXISTS public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  org_number text UNIQUE,
  status public.provider_status NOT NULL DEFAULT 'ACTIVE',
  contact_email text NOT NULL,
  contact_phone text,
  logo_url text,
  primary_color text,
  description text,
  billing_model text NOT NULL DEFAULT 'SAAS_FIXED',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  suspended_at timestamptz,
  suspended_by uuid REFERENCES public.profiles(id),
  suspended_reason text,
  paused_at timestamptz,
  paused_by uuid REFERENCES public.profiles(id),
  paused_reason text,
  deleted_at timestamptz
);

-- provider_memberships
CREATE TABLE IF NOT EXISTS public.provider_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  role public.provider_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider_id)
);

-- provider_service_areas
CREATE TABLE IF NOT EXISTS public.provider_service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  country text NOT NULL DEFAULT 'NO',
  city text NOT NULL,
  postal_code_from text NOT NULL,
  postal_code_to text NOT NULL,
  min_employees integer DEFAULT 20,
  max_employees integer,
  available_days text[] DEFAULT ARRAY['mon', 'tue', 'wed', 'thu', 'fri'],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- lifecycle_audit_log (PROVIDER-PLAN §4 audit_log semantics)
CREATE TABLE IF NOT EXISTS public.lifecycle_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_providers_status ON public.providers (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_providers_slug ON public.providers (slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_provider_memberships_user ON public.provider_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_provider_memberships_provider ON public.provider_memberships (provider_id);
CREATE INDEX IF NOT EXISTS idx_service_areas_postal ON public.provider_service_areas (postal_code_from, postal_code_to);
CREATE INDEX IF NOT EXISTS idx_service_areas_active ON public.provider_service_areas (provider_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_lifecycle_audit_log_entity ON public.lifecycle_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_audit_log_actor ON public.lifecycle_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_audit_log_created ON public.lifecycle_audit_log (created_at DESC);

COMMENT ON TABLE public.providers IS 'Multi-leverandør SaaS-tabell. Hver provider eier sine companies, agreements, orders.';
COMMENT ON TABLE public.provider_memberships IS 'Parallel pattern til company_memberships. Brukerens tilgang til providers.';
COMMENT ON TABLE public.provider_service_areas IS 'Geografiske områder hver provider dekker. Brukes for registreringsflyt-matching i Patch 13.';
COMMENT ON TABLE public.lifecycle_audit_log IS 'Immutable entity lifecycle audit (suspend/pause/delete). PROVIDER-PLAN audit_log; distinct from B2c public.audit_log.';

-- Verification
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_status') THEN
    RAISE EXCEPTION 'provider_status enum missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'provider_role') THEN
    RAISE EXCEPTION 'provider_role enum missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'providers'
  ) THEN
    RAISE EXCEPTION 'providers table missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'provider_memberships'
  ) THEN
    RAISE EXCEPTION 'provider_memberships table missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'provider_service_areas'
  ) THEN
    RAISE EXCEPTION 'provider_service_areas table missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lifecycle_audit_log'
  ) THEN
    RAISE EXCEPTION 'lifecycle_audit_log table missing';
  END IF;
END
$$;
