-- Patch 5 (Phase E.5) — Melhus default provider + provider_id backfill (PROVIDER-PLAN-V1 §10.2)
-- Deterministic UUID: 11111111-1111-1111-1111-111111111111

DO $$
DECLARE
  melhus_id constant uuid := '11111111-1111-1111-1111-111111111111';
  backfill_count int;
BEGIN
  INSERT INTO public.providers (
    id, name, slug, contact_email, status, billing_model, description
  )
  VALUES (
    melhus_id,
    'Melhus Catering AS',
    'melhus-catering',
    'kontakt@melhuscatering.no',
    'ACTIVE',
    'SAAS_FIXED',
    'Leverer bedriftslunsj i Trondheim og omegn. Mandag-fredag.'
  )
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1
    FROM public.provider_service_areas
    WHERE provider_id = melhus_id
      AND city = 'Trondheim'
      AND postal_code_from = '7000'
      AND postal_code_to = '7099'
  ) THEN
    INSERT INTO public.provider_service_areas (
      provider_id, country, city, postal_code_from, postal_code_to, min_employees, active
    )
    VALUES (melhus_id, 'NO', 'Trondheim', '7000', '7099', 20, true);
  END IF;

  UPDATE public.companies SET provider_id = melhus_id WHERE provider_id IS NULL;
  GET DIAGNOSTICS backfill_count = ROW_COUNT;
  RAISE NOTICE 'companies backfill: % rows', backfill_count;

  UPDATE public.agreements SET provider_id = melhus_id WHERE provider_id IS NULL;
  GET DIAGNOSTICS backfill_count = ROW_COUNT;
  RAISE NOTICE 'agreements backfill: % rows', backfill_count;

  -- guard_order_mutation blocks updates on CANCELLED/locked/cutoff-passed orders;
  -- one-time schema backfill only (provider_id was NULL on all rows).
  ALTER TABLE public.orders DISABLE TRIGGER guard_order_mutation;
  UPDATE public.orders SET provider_id = melhus_id WHERE provider_id IS NULL;
  ALTER TABLE public.orders ENABLE TRIGGER guard_order_mutation;
  GET DIAGNOSTICS backfill_count = ROW_COUNT;
  RAISE NOTICE 'orders backfill: % rows', backfill_count;

  UPDATE public.company_registrations SET provider_id = melhus_id WHERE provider_id IS NULL;
  GET DIAGNOSTICS backfill_count = ROW_COUNT;
  RAISE NOTICE 'company_registrations backfill: % rows', backfill_count;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'menu_service_days'
  ) THEN
    UPDATE public.menu_service_days SET provider_id = melhus_id WHERE provider_id IS NULL;
    GET DIAGNOSTICS backfill_count = ROW_COUNT;
    RAISE NOTICE 'menu_service_days backfill: % rows', backfill_count;
  END IF;

  IF EXISTS (SELECT 1 FROM public.companies WHERE provider_id IS NULL) THEN
    RAISE EXCEPTION 'companies has NULL provider_id after backfill';
  END IF;
  IF EXISTS (SELECT 1 FROM public.agreements WHERE provider_id IS NULL) THEN
    RAISE EXCEPTION 'agreements has NULL provider_id after backfill';
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE provider_id IS NULL) THEN
    RAISE EXCEPTION 'orders has NULL provider_id after backfill';
  END IF;

  ALTER TABLE public.companies ALTER COLUMN provider_id SET NOT NULL;
  ALTER TABLE public.agreements ALTER COLUMN provider_id SET NOT NULL;
  ALTER TABLE public.orders ALTER COLUMN provider_id SET NOT NULL;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'menu_service_days'
  ) THEN
    IF EXISTS (SELECT 1 FROM public.menu_service_days WHERE provider_id IS NULL) THEN
      RAISE EXCEPTION 'menu_service_days has NULL provider_id after backfill';
    END IF;
    ALTER TABLE public.menu_service_days ALTER COLUMN provider_id SET NOT NULL;
  END IF;
END
$$;
