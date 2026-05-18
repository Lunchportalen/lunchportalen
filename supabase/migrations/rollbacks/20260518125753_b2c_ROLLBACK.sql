-- B2c rollback — restore heap `audit_log` from `audit_log_legacy` after partitioned swap.
-- Manual apply only. Version 20260518125753.
--
-- CRITICAL: OWNED BY NONE before DROP CASCADE so `audit_log_id_seq` is not dropped with the
-- partitioned table tree.

BEGIN;

ALTER SEQUENCE public.audit_log_id_seq OWNED BY NONE;

ALTER TABLE public.audit_log RENAME TO audit_log_p;

ALTER TABLE public.audit_log_legacy RENAME TO audit_log;

ALTER TABLE public.audit_log
  ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;

DROP TABLE public.audit_log_p CASCADE;

ALTER TABLE public.audit_log RENAME CONSTRAINT audit_log_legacy_pkey TO audit_log_pkey;
ALTER TABLE public.audit_log RENAME CONSTRAINT audit_log_legacy_action_check TO audit_log_action_check;
ALTER TABLE public.audit_log RENAME CONSTRAINT audit_log_legacy_actor_user_id_fkey TO audit_log_actor_user_id_fkey;

ALTER INDEX public.idx_audit_log_legacy_actor_user_id RENAME TO idx_audit_log_actor_user_id;

COMMIT;
