-- Provider-config FK reconcile (ADR-016 gate #143 cleanup).
-- Staging applied an earlier revision of 20260710120000 (provider_id FK → providers).
-- This forward migration repairs constraints only — no data changes.
-- No-op when tables already have provider_id NOT NULL + FK → organizations(id).

BEGIN;

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

COMMIT;
