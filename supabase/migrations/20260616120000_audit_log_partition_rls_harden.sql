-- FASE 0: Close live cross-tenant leak on partitioned public.audit_log (prod 40/40 RLS-loose).
-- Write path preserved: tg_audit_row() is SECURITY DEFINER owned by postgres (BYPASSRLS).
-- Read path: default-deny for anon/authenticated; app uses service_role / audit_logs / audit_events.

-- ---------------------------------------------------------------------------
-- 1) Harden helper (idempotent per relation)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.audit_log_harden_relation(p_rel regclass)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF p_rel IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_rel);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_rel);

  -- Defense-in-depth: block PostgREST direct access on partition children (RLS was off → full leak).
  EXECUTE format('REVOKE ALL ON TABLE %s FROM anon', p_rel);
  EXECUTE format('REVOKE ALL ON TABLE %s FROM authenticated', p_rel);
END;
$$;

REVOKE ALL ON FUNCTION private.audit_log_harden_relation(regclass) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2) Harden parent + every partition child + legacy table (not hardcoded names)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_parent oid;
  v_child regclass;
BEGIN
  SELECT c.oid
  INTO v_parent
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'audit_log'
    AND c.relkind = 'p';

  IF v_parent IS NOT NULL THEN
    PERFORM private.audit_log_harden_relation(v_parent::regclass);

    FOR v_child IN
      SELECT i.inhrelid::regclass
      FROM pg_inherits i
      WHERE i.inhparent = v_parent
      ORDER BY 1
    LOOP
      PERFORM private.audit_log_harden_relation(v_child);
    END LOOP;
  END IF;

  IF to_regclass('public.audit_log_legacy') IS NOT NULL THEN
    PERFORM private.audit_log_harden_relation('public.audit_log_legacy'::regclass);
  END IF;
END;
$$;

-- Remove authenticated SELECT policies (reads via service_role only; no tenant column on audit_log).
DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
DROP POLICY IF EXISTS audit_log_select ON public.audit_log_legacy;

-- ---------------------------------------------------------------------------
-- 3) Partition creator: ENABLE+FORCE+REVOKE on every new monthly partition (regress guard)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.ensure_audit_log_partitions(months_ahead integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  i int;
  v_month date;
  v_next_month date;
  v_rel text;
  v_from_lit text;
  v_to_lit text;
  v_created text[] := ARRAY[]::text[];
  v_skipped text[] := ARRAY[]::text[];
BEGIN
  IF months_ahead IS NULL OR months_ahead < 1 THEN
    RAISE EXCEPTION 'months_ahead must be >= 1';
  END IF;

  FOR i IN 0..(months_ahead - 1) LOOP
    v_month := (
      date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'utc')::timestamp)
      + make_interval(months => i)
    )::date;

    v_rel := format('audit_log_y%sm%s', to_char(v_month, 'YYYY'), to_char(v_month, 'MM'));

    IF to_regclass('public.' || v_rel) IS NOT NULL THEN
      v_skipped := array_append(v_skipped, v_rel);
      CONTINUE;
    END IF;

    v_next_month := (v_month + interval '1 month')::date;
    v_from_lit := to_char(v_month, 'YYYY-MM-DD') || ' 00:00:00+00';
    v_to_lit := to_char(v_next_month, 'YYYY-MM-DD') || ' 00:00:00+00';

    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.audit_log FOR VALUES FROM (%L) TO (%L)',
      v_rel,
      v_from_lit,
      v_to_lit
    );

    PERFORM private.audit_log_harden_relation(('public.' || v_rel)::regclass);

    v_created := array_append(v_created, v_rel);
  END LOOP;

  RETURN jsonb_build_object(
    'created', coalesce(to_jsonb(v_created), '[]'::jsonb),
    'skipped', coalesce(to_jsonb(v_skipped), '[]'::jsonb),
    'months_checked', months_ahead
  );
END;
$$;

REVOKE ALL ON FUNCTION private.ensure_audit_log_partitions(integer) FROM PUBLIC;

COMMENT ON FUNCTION private.audit_log_harden_relation(regclass) IS
  'ENABLE+FORCE RLS and revoke anon/authenticated on audit_log relations. Idempotent.';
COMMENT ON FUNCTION private.ensure_audit_log_partitions(integer) IS
  'Create monthly audit_log partitions and harden each new child (RLS regress guard).';
