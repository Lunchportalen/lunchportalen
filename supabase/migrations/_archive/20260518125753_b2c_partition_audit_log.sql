-- B2c — RANGE partition `audit_log` by `created_at` (monthly + DEFAULT).
-- FASE B oppgave 2 sub-task B2c; applied via Supabase MCP as version 20260518125753.
--
-- PostgreSQL requires constraint and index names unique within `public`; the heap table
-- keeps `_legacy_`-prefixed names until swapped away so `audit_log_new` can use canonical
-- constraint/index names before rename.
--
-- Rollback: supabase/migrations/rollbacks/20260518125753_b2c_ROLLBACK.sql

BEGIN;

LOCK TABLE public.audit_log IN EXCLUSIVE MODE;

ALTER TABLE public.audit_log RENAME CONSTRAINT audit_log_pkey TO audit_log_legacy_pkey;
ALTER TABLE public.audit_log RENAME CONSTRAINT audit_log_action_check TO audit_log_legacy_action_check;
ALTER TABLE public.audit_log RENAME CONSTRAINT audit_log_actor_user_id_fkey TO audit_log_legacy_actor_user_id_fkey;
ALTER INDEX public.idx_audit_log_actor_user_id RENAME TO idx_audit_log_legacy_actor_user_id;

CREATE TABLE public.audit_log_new (
  id bigint NOT NULL DEFAULT nextval('public.audit_log_id_seq'::regclass),
  actor_user_id uuid,
  table_name text NOT NULL,
  record_id text,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_action_check CHECK (
    action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])
  ),
  CONSTRAINT audit_log_pkey PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE public.audit_log_y_default PARTITION OF public.audit_log_new DEFAULT;

CREATE TABLE public.audit_log_y2026m05 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE public.audit_log_y2026m06 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE public.audit_log_y2026m07 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE public.audit_log_y2026m08 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE public.audit_log_y2026m09 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE public.audit_log_y2026m10 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE public.audit_log_y2026m11 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE public.audit_log_y2026m12 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE TABLE public.audit_log_y2027m01 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE public.audit_log_y2027m02 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE public.audit_log_y2027m03 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');
CREATE TABLE public.audit_log_y2027m04 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
CREATE TABLE public.audit_log_y2027m05 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2027-05-01') TO ('2027-06-01');
CREATE TABLE public.audit_log_y2027m06 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2027-06-01') TO ('2027-07-01');
CREATE TABLE public.audit_log_y2027m07 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2027-07-01') TO ('2027-08-01');
CREATE TABLE public.audit_log_y2027m08 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2027-08-01') TO ('2027-09-01');
CREATE TABLE public.audit_log_y2027m09 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2027-09-01') TO ('2027-10-01');
CREATE TABLE public.audit_log_y2027m10 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2027-10-01') TO ('2027-11-01');
CREATE TABLE public.audit_log_y2027m11 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2027-11-01') TO ('2027-12-01');
CREATE TABLE public.audit_log_y2027m12 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2027-12-01') TO ('2028-01-01');

CREATE TABLE public.audit_log_y2028m01 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2028-01-01') TO ('2028-02-01');
CREATE TABLE public.audit_log_y2028m02 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2028-02-01') TO ('2028-03-01');
CREATE TABLE public.audit_log_y2028m03 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2028-03-01') TO ('2028-04-01');
CREATE TABLE public.audit_log_y2028m04 PARTITION OF public.audit_log_new
  FOR VALUES FROM ('2028-04-01') TO ('2028-05-01');

INSERT INTO public.audit_log_new (
  id,
  actor_user_id,
  table_name,
  record_id,
  action,
  old_data,
  new_data,
  changed_at,
  created_at
)
SELECT
  id,
  actor_user_id,
  table_name,
  record_id,
  action,
  old_data,
  new_data,
  changed_at,
  created_at
FROM public.audit_log;

SELECT setval(
  'public.audit_log_id_seq',
  (SELECT COALESCE(MAX(id), 0) + 1 FROM public.audit_log_new),
  false
);

ALTER TABLE public.audit_log RENAME TO audit_log_legacy;
ALTER TABLE public.audit_log_new RENAME TO audit_log;

ALTER TABLE public.audit_log_legacy ALTER COLUMN id DROP DEFAULT;

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;

CREATE INDEX idx_audit_log_actor_user_id ON public.audit_log (actor_user_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT TO authenticated
  USING ((SELECT private.is_platform_admin()));

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_actor_user_id_fkey
  FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.audit_log TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.audit_log TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.audit_log TO postgres;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE public.audit_log TO service_role;

ANALYZE public.audit_log;

COMMIT;
