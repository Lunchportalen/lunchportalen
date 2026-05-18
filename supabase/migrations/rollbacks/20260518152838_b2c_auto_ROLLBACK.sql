-- B2c-auto rollback — remove cron job and partition helper (pg_cron extension stays).
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT j.jobid INTO jid FROM cron.job j WHERE j.jobname = 'audit_log_create_partitions' LIMIT 1;
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

DROP FUNCTION IF EXISTS private.ensure_audit_log_partitions(integer);
