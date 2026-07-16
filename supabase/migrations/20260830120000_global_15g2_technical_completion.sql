-- PHASE 15G.2 — Technical completion tables (additive).
-- After 20260829120000. No DROP/TRUNCATE. No forged APPROVED statuses.
-- Old app ignores new tables. Rollback: stop writing; do not DROP in prod without plan.

BEGIN;

-- ---------------------------------------------------------------------------
-- Legal acceptance records (technical workflow)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('provider', 'company', 'employee')),
  subject_id uuid NOT NULL,
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  locale text NOT NULL,
  document_type text NOT NULL,
  document_version text NOT NULL,
  document_checksum text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  acceptance_method text NOT NULL CHECK (acceptance_method IN ('clickwrap', 'api')),
  audit_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legal_acceptances_subject_idx
  ON public.legal_acceptances (subject_type, subject_id, document_type);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.legal_acceptances FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.legal_acceptances TO authenticated, service_role;
GRANT ALL ON TABLE public.legal_acceptances TO service_role;

DROP POLICY IF EXISTS legal_acceptances_read ON public.legal_acceptances;
CREATE POLICY legal_acceptances_read ON public.legal_acceptances
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Immutable commercial / tax snapshots (order + invoice lines)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_compliance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  order_line_id uuid,
  country_code text NOT NULL,
  jurisdiction_path text NOT NULL,
  currency_code text NOT NULL,
  locale text,
  marketplace_model_status text NOT NULL DEFAULT 'DRAFT',
  tax_resolve_status text NOT NULL CHECK (tax_resolve_status IN ('OK', 'FAIL_CLOSED')),
  tax_fail_code text,
  tax_rule_id uuid,
  tax_rate_bps integer,
  tax_amount_minor bigint,
  commission_bps integer NOT NULL DEFAULT 500 CHECK (commission_bps = 500),
  commission_minor bigint,
  engine_version text NOT NULL,
  snapshot_json jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_compliance_snapshots_order_idx
  ON public.order_compliance_snapshots (order_id);

ALTER TABLE public.order_compliance_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_compliance_snapshots FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.order_compliance_snapshots TO authenticated, service_role;
GRANT ALL ON TABLE public.order_compliance_snapshots TO service_role;
DROP POLICY IF EXISTS order_compliance_snapshots_read ON public.order_compliance_snapshots;
CREATE POLICY order_compliance_snapshots_read ON public.order_compliance_snapshots
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- E-invoice delivery attempts (mock-aware; never claim live from mock)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.e_invoice_delivery_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  invoice_id text NOT NULL,
  channel text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL,
  is_mock boolean NOT NULL DEFAULT true,
  live_registration_claimed boolean NOT NULL DEFAULT false
    CHECK (live_registration_claimed = false OR is_mock = false),
  credential_dependency text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.e_invoice_delivery_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.e_invoice_delivery_attempts FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.e_invoice_delivery_attempts TO authenticated, service_role;
GRANT ALL ON TABLE public.e_invoice_delivery_attempts TO service_role;
DROP POLICY IF EXISTS e_invoice_delivery_attempts_read ON public.e_invoice_delivery_attempts;
CREATE POLICY e_invoice_delivery_attempts_read ON public.e_invoice_delivery_attempts
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- Activation kill switch (fail-closed default)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.global_activation_kill_switch (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  global_cutover_allowed boolean NOT NULL DEFAULT false,
  technical_21_complete boolean NOT NULL DEFAULT false,
  reason text NOT NULL DEFAULT 'Phase 15G.2 default: cutover blocked until certified',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.global_activation_kill_switch (id, global_cutover_allowed, technical_21_complete, reason)
VALUES (1, false, false, 'Phase 15G.2 default: cutover blocked until certified')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.global_activation_kill_switch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.global_activation_kill_switch FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.global_activation_kill_switch TO authenticated, service_role;
GRANT ALL ON TABLE public.global_activation_kill_switch TO service_role;
DROP POLICY IF EXISTS global_activation_kill_switch_read ON public.global_activation_kill_switch;
CREATE POLICY global_activation_kill_switch_read ON public.global_activation_kill_switch
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.legal_acceptances IS
  '15G.2 additive acceptance log. Old app ignores. Rollback: stop writes.';
COMMENT ON TABLE public.order_compliance_snapshots IS
  '15G.2 immutable compliance snapshots. Fail-closed tax statuses expected until APPROVED rules.';
COMMENT ON TABLE public.global_activation_kill_switch IS
  '15G.2 singleton kill switch. Default blocks global cutover.';

COMMIT;
