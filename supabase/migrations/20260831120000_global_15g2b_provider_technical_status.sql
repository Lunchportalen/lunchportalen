-- PHASE 15G.2B — Provider snapshots + technical vs approval status (additive).
-- After 20260830120000. No DROP/TRUNCATE. No forged APPROVED statuses.

BEGIN;

CREATE TABLE IF NOT EXISTS public.tax_provider_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  jurisdiction_path text NOT NULL,
  provider_name text NOT NULL,
  provider_version text NOT NULL,
  requested_at timestamptz NOT NULL,
  technical_status text NOT NULL CHECK (technical_status IN (
    'TECHNICALLY_SUPPORTED','TECHNICALLY_BLOCKED','NOT_APPLICABLE',
    'EXTERNAL_CREDENTIAL_REQUIRED','EXTERNAL_REVIEW_REQUIRED'
  )),
  evidence_reference text,
  rate_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tax_provider_snapshots_path_idx
  ON public.tax_provider_snapshots (country_code, jurisdiction_path);

CREATE TABLE IF NOT EXISTS public.compliance_lane_status (
  country_code text NOT NULL,
  locale text,
  lane text NOT NULL CHECK (lane IN (
    'tax','legal','invoice','e_invoice','privacy','localization','marketplace'
  )),
  technical_status text NOT NULL DEFAULT 'TECHNICALLY_CONFIGURED'
    CHECK (technical_status IN (
      'TECHNICALLY_CONFIGURED','TECHNICALLY_TESTED','EVIDENCE_COLLECTED','EXTERNAL_REVIEW_REQUIRED'
    )),
  approval_status text NOT NULL DEFAULT 'NONE'
    CHECK (approval_status IN (
      'NONE','TAX_APPROVED','LEGAL_APPROVED','INVOICE_APPROVED','LOCALIZATION_APPROVED','READY_FOR_GLOBAL_CUTOVER'
    )),
  blocked_reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country_code, lane, locale)
);

-- Seed technical configured lanes for 21 countries (approval NONE)
INSERT INTO public.compliance_lane_status (country_code, locale, lane, technical_status, approval_status)
SELECT c, '', lane, 'TECHNICALLY_CONFIGURED', 'NONE'
FROM unnest(ARRAY[
  'NO','SE','DK','FI','GB','DE','FR','ES','IT','NL',
  'BE','CH','AT','IE','PL','RO','CZ','PT','GR','US','CA'
]) AS c
CROSS JOIN unnest(ARRAY['tax','legal','invoice','e_invoice','privacy','marketplace']) AS lane
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.credential_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  dependency_key text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'REQUIRED'
    CHECK (status IN ('REQUIRED','SATISFIED','NOT_APPLICABLE')),
  notes text,
  UNIQUE (country_code, dependency_key)
);

INSERT INTO public.credential_dependencies (country_code, dependency_key, channel, status, notes)
SELECT c,
  c || ':peppol:access_point_contract',
  'peppol',
  CASE WHEN c = 'US' THEN 'NOT_APPLICABLE' ELSE 'REQUIRED' END,
  'Sandbox/mock proof only until credentials exist'
FROM unnest(ARRAY[
  'NO','SE','DK','FI','DE','NL','BE','AT','IE','US'
]) AS c
ON CONFLICT DO NOTHING;

ALTER TABLE public.tax_provider_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_lane_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credential_dependencies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tax_provider_snapshots FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.compliance_lane_status FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.credential_dependencies FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.tax_provider_snapshots TO authenticated, service_role;
GRANT SELECT ON TABLE public.compliance_lane_status TO authenticated, service_role;
GRANT SELECT ON TABLE public.credential_dependencies TO authenticated, service_role;
GRANT ALL ON TABLE public.tax_provider_snapshots TO service_role;
GRANT ALL ON TABLE public.compliance_lane_status TO service_role;
GRANT ALL ON TABLE public.credential_dependencies TO service_role;

DROP POLICY IF EXISTS tax_provider_snapshots_read ON public.tax_provider_snapshots;
CREATE POLICY tax_provider_snapshots_read ON public.tax_provider_snapshots FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS compliance_lane_status_read ON public.compliance_lane_status;
CREATE POLICY compliance_lane_status_read ON public.compliance_lane_status FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS credential_dependencies_read ON public.credential_dependencies;
CREATE POLICY credential_dependencies_read ON public.credential_dependencies FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.tax_provider_snapshots IS
  '15G.2B provider snapshots. Fixture/external results are technical — not TAX_APPROVED.';
COMMENT ON TABLE public.compliance_lane_status IS
  '15G.2B technical vs approval lanes. approval_status NONE until human reviewers act.';

COMMIT;
