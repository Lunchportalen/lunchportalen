-- Provider-config foundation (inert skin): price rules, settings, package entitlements.
-- READ: ADR-016 in docs/engineering/architecture-decisions.md
-- Scope: additive tables + Melhus/Trondheim seed + RLS (spine helpers only).
-- Does NOT wire runtime (order/window, lp_order_set, onboarding, invoicing, Sanity).
-- Idempotent: safe to re-apply on staging/prod.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) provider_price_rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_price_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  customer_id uuid NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  agreement_id uuid NULL REFERENCES public.agreements (id) ON DELETE CASCADE,
  tier text NULL,
  package_key text NULL,
  menu_category_key text NULL,
  menu_item_id uuid NULL,
  amount_ex_vat numeric(12, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'NOK',
  vat_rate numeric(6, 4) NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_price_rules_amount_ex_vat_chk CHECK (amount_ex_vat > 0),
  CONSTRAINT provider_price_rules_currency_len_chk CHECK (char_length(trim(currency)) BETWEEN 3 AND 3),
  CONSTRAINT provider_price_rules_tier_chk CHECK (
    tier IS NULL OR tier = ANY (ARRAY['BASIS'::text, 'LUXUS'::text, 'ENTERPRISE'::text])
  ),
  CONSTRAINT provider_price_rules_package_key_chk CHECK (
    package_key IS NULL OR package_key = ANY (ARRAY['BASIS'::text, 'LUXUS'::text, 'ENTERPRISE'::text])
  ),
  CONSTRAINT provider_price_rules_valid_range_chk CHECK (
    valid_to IS NULL OR valid_to > valid_from
  ),
  CONSTRAINT provider_price_rules_vat_rate_chk CHECK (
    vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 1)
  )
);

COMMENT ON TABLE public.provider_price_rules IS
  'Provider-scoped price rules (inert until resolver wiring). Supports tier/package/category overrides.';

CREATE INDEX IF NOT EXISTS provider_price_rules_provider_active_idx
  ON public.provider_price_rules (provider_id, is_active, valid_from DESC);

CREATE UNIQUE INDEX IF NOT EXISTS provider_price_rules_provider_tier_default_uniq
  ON public.provider_price_rules (provider_id, tier)
  WHERE customer_id IS NULL
    AND agreement_id IS NULL
    AND tier IS NOT NULL
    AND is_active = true;

-- ---------------------------------------------------------------------------
-- 2) provider_settings (one row per provider)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_settings (
  provider_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  default_currency text NOT NULL DEFAULT 'NOK',
  default_country_code text NOT NULL DEFAULT 'NO',
  timezone text NOT NULL DEFAULT 'Europe/Oslo',
  cutoff_time text NOT NULL DEFAULT '08:00',
  kitchen_buffer_minutes integer NOT NULL DEFAULT 5,
  delivery_days jsonb NOT NULL DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb,
  locale text NOT NULL DEFAULT 'nb-NO',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_settings_currency_len_chk CHECK (char_length(trim(default_currency)) = 3),
  CONSTRAINT provider_settings_country_len_chk CHECK (char_length(trim(default_country_code)) = 2),
  CONSTRAINT provider_settings_cutoff_time_fmt_chk CHECK (cutoff_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  CONSTRAINT provider_settings_kitchen_buffer_chk CHECK (kitchen_buffer_minutes >= 0 AND kitchen_buffer_minutes <= 120),
  CONSTRAINT provider_settings_delivery_days_array_chk CHECK (jsonb_typeof(delivery_days) = 'array')
);

COMMENT ON TABLE public.provider_settings IS
  'Per-provider operational defaults (inert). Week-visibility rules (Thu 14:00 / Fri 15:00) intentionally excluded.';

-- ---------------------------------------------------------------------------
-- 3) provider_package_entitlements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_package_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_key text NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  entitlement_key text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  default_value jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_package_entitlements_package_key_chk CHECK (
    package_key = ANY (ARRAY['BASIS'::text, 'LUXUS'::text, 'ENTERPRISE'::text])
  ),
  CONSTRAINT provider_package_entitlements_key_len_chk CHECK (
    char_length(trim(entitlement_key)) BETWEEN 1 AND 128
  ),
  CONSTRAINT provider_package_entitlements_provider_pkg_key_uniq
    UNIQUE (provider_id, package_key, entitlement_key)
);

COMMENT ON TABLE public.provider_package_entitlements IS
  'Per-provider package entitlements (menu categories, auto_warm_meal, etc.). Inert until resolver wiring.';

CREATE INDEX IF NOT EXISTS provider_package_entitlements_provider_pkg_idx
  ON public.provider_package_entitlements (provider_id, package_key);

-- ---------------------------------------------------------------------------
-- 3b) provider_id NOT NULL + FK → organizations(id) (repair prior staging apply)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_tbl text;
  v_fk text;
  v_old_fk text;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY[
    'provider_price_rules',
    'provider_settings',
    'provider_package_entitlements'
  ] LOOP
    IF to_regclass(format('public.%I', v_tbl)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN provider_id SET NOT NULL',
      v_tbl
    );

    FOR v_old_fk IN
      SELECT c.conname
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_class ref ON ref.oid = c.confrelid
      JOIN pg_namespace refn ON refn.oid = ref.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = v_tbl
        AND c.contype = 'f'
        AND refn.nspname = 'public'
        AND ref.relname = 'providers'
        AND EXISTS (
          SELECT 1
          FROM unnest(c.conkey) AS col(attnum)
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = col.attnum
          WHERE a.attname = 'provider_id' AND NOT a.attisdropped
        )
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_tbl, v_old_fk);
    END LOOP;

    v_fk := v_tbl || '_provider_id_fkey';
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_class ref ON ref.oid = c.confrelid
      WHERE t.relname = v_tbl
        AND c.conname = v_fk
        AND ref.relname IS DISTINCT FROM 'organizations'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_tbl, v_fk);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_class ref ON ref.oid = c.confrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = v_tbl
        AND c.conname = v_fk
        AND ref.relname = 'organizations'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (provider_id) REFERENCES public.organizations (id) ON DELETE CASCADE',
        v_tbl,
        v_fk
      );
    END IF;
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- 4) updated_at triggers
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.tg_set_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS provider_price_rules_set_updated_at ON public.provider_price_rules;
    CREATE TRIGGER provider_price_rules_set_updated_at
      BEFORE UPDATE ON public.provider_price_rules
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

    DROP TRIGGER IF EXISTS provider_settings_set_updated_at ON public.provider_settings;
    CREATE TRIGGER provider_settings_set_updated_at
      BEFORE UPDATE ON public.provider_settings
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

    DROP TRIGGER IF EXISTS provider_package_entitlements_set_updated_at ON public.provider_package_entitlements;
    CREATE TRIGGER provider_package_entitlements_set_updated_at
      BEFORE UPDATE ON public.provider_package_entitlements
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 5) RLS — spine helpers only (app_active_org / app_is_platform_admin)
-- ---------------------------------------------------------------------------
ALTER TABLE public.provider_price_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_package_entitlements ENABLE ROW LEVEL SECURITY;

-- provider_price_rules
DROP POLICY IF EXISTS provider_price_rules_service_role_all ON public.provider_price_rules;
CREATE POLICY provider_price_rules_service_role_all
  ON public.provider_price_rules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS provider_price_rules_select_scope ON public.provider_price_rules;
CREATE POLICY provider_price_rules_select_scope
  ON public.provider_price_rules
  FOR SELECT
  TO authenticated
  USING (
    public.app_is_platform_admin()
    OR provider_id = public.app_active_org()
  );

DROP POLICY IF EXISTS provider_price_rules_write_platform_admin ON public.provider_price_rules;
CREATE POLICY provider_price_rules_write_platform_admin
  ON public.provider_price_rules
  FOR ALL
  TO authenticated
  USING (public.app_is_platform_admin())
  WITH CHECK (public.app_is_platform_admin());

-- provider_settings
DROP POLICY IF EXISTS provider_settings_service_role_all ON public.provider_settings;
CREATE POLICY provider_settings_service_role_all
  ON public.provider_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS provider_settings_select_scope ON public.provider_settings;
CREATE POLICY provider_settings_select_scope
  ON public.provider_settings
  FOR SELECT
  TO authenticated
  USING (
    public.app_is_platform_admin()
    OR provider_id = public.app_active_org()
  );

DROP POLICY IF EXISTS provider_settings_write_platform_admin ON public.provider_settings;
CREATE POLICY provider_settings_write_platform_admin
  ON public.provider_settings
  FOR ALL
  TO authenticated
  USING (public.app_is_platform_admin())
  WITH CHECK (public.app_is_platform_admin());

-- provider_package_entitlements
DROP POLICY IF EXISTS provider_package_entitlements_service_role_all ON public.provider_package_entitlements;
CREATE POLICY provider_package_entitlements_service_role_all
  ON public.provider_package_entitlements
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS provider_package_entitlements_select_scope ON public.provider_package_entitlements;
CREATE POLICY provider_package_entitlements_select_scope
  ON public.provider_package_entitlements
  FOR SELECT
  TO authenticated
  USING (
    public.app_is_platform_admin()
    OR provider_id = public.app_active_org()
  );

DROP POLICY IF EXISTS provider_package_entitlements_write_platform_admin ON public.provider_package_entitlements;
CREATE POLICY provider_package_entitlements_write_platform_admin
  ON public.provider_package_entitlements
  FOR ALL
  TO authenticated
  USING (public.app_is_platform_admin())
  WITH CHECK (public.app_is_platform_admin());

REVOKE ALL ON TABLE public.provider_price_rules FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.provider_settings FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.provider_package_entitlements FROM PUBLIC, anon;

GRANT SELECT ON TABLE public.provider_price_rules TO authenticated;
GRANT SELECT ON TABLE public.provider_settings TO authenticated;
GRANT SELECT ON TABLE public.provider_package_entitlements TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.provider_price_rules TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.provider_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.provider_package_entitlements TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Seed — Melhus Catering AS / Trondheim (lookup provider in spine, no hardcoded UUID)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_provider_id uuid;
  v_pkg text;
  v_cat text;
  v_cats text[];
BEGIN
  SELECT p.id
  INTO v_provider_id
  FROM public.providers p
  WHERE p.slug = 'melhus-catering'
    AND p.deleted_at IS NULL
    AND p.status = 'ACTIVE'::public.provider_status
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    SELECT p.id
    INTO v_provider_id
    FROM public.providers p
    WHERE p.name = 'Melhus Catering AS'
      AND p.deleted_at IS NULL
      AND p.status = 'ACTIVE'::public.provider_status
    ORDER BY p.created_at ASC
    LIMIT 1;
  END IF;

  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION
      'PROVIDER_CONFIG_SEED_FAILED: Melhus Catering AS (slug melhus-catering) not found in public.providers';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = v_provider_id
      AND o.type = 'provider'::public.org_type
  ) THEN
    RAISE EXCEPTION
      'PROVIDER_CONFIG_SEED_FAILED: provider org missing in public.organizations spine for provider_id %',
      v_provider_id;
  END IF;

  INSERT INTO public.provider_settings (
    provider_id,
    default_currency,
    default_country_code,
    timezone,
    cutoff_time,
    kitchen_buffer_minutes,
    delivery_days,
    locale
  )
  VALUES (
    v_provider_id,
    'NOK',
    'NO',
    'Europe/Oslo',
    '08:00',
    5,
    '["mon","tue","wed","thu","fri"]'::jsonb,
    'nb-NO'
  )
  ON CONFLICT (provider_id) DO NOTHING;

  INSERT INTO public.provider_price_rules (
    provider_id, tier, package_key, amount_ex_vat, currency, vat_rate, is_active
  )
  VALUES
    (v_provider_id, 'BASIS', 'BASIS', 90, 'NOK', 0.15, true),
    (v_provider_id, 'LUXUS', 'LUXUS', 130, 'NOK', 0.15, true),
    (v_provider_id, 'ENTERPRISE', 'ENTERPRISE', 170, 'NOK', 0.15, true)
  ON CONFLICT (provider_id, tier)
    WHERE customer_id IS NULL
      AND agreement_id IS NULL
      AND tier IS NOT NULL
      AND is_active = true
  DO NOTHING;

  -- BASIS: paasmurt, salat, varmrett (lib/cms/menuDayContract.ts PLAN_CATEGORIES)
  v_cats := ARRAY['paasmurt', 'salat', 'varmrett'];
  FOREACH v_cat IN ARRAY v_cats LOOP
    INSERT INTO public.provider_package_entitlements (
      provider_id, package_key, entitlement_key, is_enabled, default_value
    )
    VALUES (
      v_provider_id,
      'BASIS',
      'menu_category:' || v_cat,
      true,
      jsonb_build_object('category', v_cat)
    )
    ON CONFLICT (provider_id, package_key, entitlement_key) DO NOTHING;
  END LOOP;

  INSERT INTO public.provider_package_entitlements (
    provider_id, package_key, entitlement_key, is_enabled, default_value
  )
  VALUES (
    v_provider_id,
    'BASIS',
    'auto_warm_meal',
    true,
    '{"enabled": true}'::jsonb
  )
  ON CONFLICT (provider_id, package_key, entitlement_key) DO NOTHING;

  -- LUXUS + ENTERPRISE: 6 categories each (same set per menuDayContract.ts)
  v_cats := ARRAY['paasmurt', 'salat', 'sushi', 'pokebowl', 'thai', 'varmrett'];
  FOREACH v_pkg IN ARRAY ARRAY['LUXUS', 'ENTERPRISE'] LOOP
    FOREACH v_cat IN ARRAY v_cats LOOP
      INSERT INTO public.provider_package_entitlements (
        provider_id, package_key, entitlement_key, is_enabled, default_value
      )
      VALUES (
        v_provider_id,
        v_pkg,
        'menu_category:' || v_cat,
        true,
        jsonb_build_object('category', v_cat)
      )
      ON CONFLICT (provider_id, package_key, entitlement_key) DO NOTHING;
    END LOOP;

    INSERT INTO public.provider_package_entitlements (
      provider_id, package_key, entitlement_key, is_enabled, default_value
    )
    VALUES (
      v_provider_id,
      v_pkg,
      'auto_warm_meal',
      true,
      '{"enabled": true}'::jsonb
    )
    ON CONFLICT (provider_id, package_key, entitlement_key) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'provider_config_foundation: seeded provider_id=%', v_provider_id;
END
$$;

COMMIT;
