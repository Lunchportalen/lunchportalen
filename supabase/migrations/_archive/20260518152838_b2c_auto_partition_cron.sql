-- B2c-auto — pg_cron buffer for future public.audit_log monthly partitions.
-- B2c pre-created May 2026 → April 2028; this job keeps >=12 months lookahead.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Idempotent: remove previous job by name if present (uses jobid; safe if table empty).
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT j.jobid INTO jid FROM cron.job j WHERE j.jobname = 'audit_log_create_partitions' LIMIT 1;
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.ensure_audit_log_partitions(months_ahead integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
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

    v_created := array_append(v_created, v_rel);
  END LOOP;

  RETURN jsonb_build_object(
    'created', coalesce(to_jsonb(v_created), '[]'::jsonb),
    'skipped', coalesce(to_jsonb(v_skipped), '[]'::jsonb),
    'months_checked', months_ahead
  );
END;
$fn$;

REVOKE ALL ON FUNCTION private.ensure_audit_log_partitions(integer) FROM PUBLIC;

SELECT cron.schedule(
  'audit_log_create_partitions',
  '0 0 1 * *',
  $$SELECT private.ensure_audit_log_partitions(12)$$
);
