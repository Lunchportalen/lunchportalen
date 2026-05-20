-- Patch 5 (Phase E.5) — provider_id + lifecycle columns on existing tables (PROVIDER-PLAN-V1 §4.3)
-- Nullable provider_id first; NOT NULL after Melhus backfill (separate migration).
-- No RLS changes (Patch 6).

-- companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.providers(id);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS suspended_reason text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS paused_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS paused_reason text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- agreements
ALTER TABLE public.agreements ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.providers(id);

-- orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.providers(id);

-- company_registrations (stays nullable after backfill)
ALTER TABLE public.company_registrations ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.providers(id);
ALTER TABLE public.company_registrations ADD COLUMN IF NOT EXISTS requested_postal_code text;
ALTER TABLE public.company_registrations ADD COLUMN IF NOT EXISTS requested_city text;

-- menu_service_days (only when table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'menu_service_days'
  ) THEN
    ALTER TABLE public.menu_service_days ADD COLUMN IF NOT EXISTS provider_id uuid REFERENCES public.providers(id);
  END IF;
END
$$;

-- profiles lifecycle
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_companies_provider ON public.companies (provider_id);
CREATE INDEX IF NOT EXISTS idx_agreements_provider ON public.agreements (provider_id);
CREATE INDEX IF NOT EXISTS idx_orders_provider ON public.orders (provider_id);
CREATE INDEX IF NOT EXISTS idx_company_registrations_provider ON public.company_registrations (provider_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'menu_service_days'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_menu_service_days_provider ON public.menu_service_days (provider_id)';
  END IF;
END
$$;
