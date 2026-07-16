-- Phase 15G.3B — review operations tables (staging/additive).
-- Never forges APPROVED. Fixture approvals isolated via is_fixture.

BEGIN;

-- ---------------------------------------------------------------------------
-- Reviewers (PII minimized; credential secrets never stored)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compliance_reviewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  display_label text NOT NULL,
  organization text NOT NULL,
  email_hash text NOT NULL,
  role text NOT NULL CHECK (role IN (
    'tax_reviewer','legal_reviewer','native_language_reviewer','security_reviewer','product_owner'
  )),
  country_scope text[] NOT NULL DEFAULT '{}',
  locale_scope text[] NULL,
  permitted_approval_types text[] NOT NULL DEFAULT '{}',
  credential_reference text NULL,
  credential_secret_ref text NULL,
  credential_valid_from timestamptz NULL,
  credential_valid_to timestamptz NULL,
  conflict_of_interest_declared boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'INVITED'
    CHECK (status IN ('INVITED','ACTIVE','SUSPENDED','EXPIRED')),
  is_test_fixture boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email_hash, role)
);

CREATE TABLE IF NOT EXISTS public.compliance_reviewer_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id uuid NOT NULL REFERENCES public.compliance_reviewers(id),
  actor_id text NOT NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Append-only approvals (real + isolated fixtures)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compliance_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_type text NOT NULL CHECK (approval_type IN (
    'TAX_APPROVAL','LEGAL_APPROVAL','INVOICE_APPROVAL','E_INVOICE_APPROVAL',
    'PRIVACY_APPROVAL','NATIVE_LOCALIZATION_APPROVAL','SECURITY_APPROVAL',
    'PRODUCT_OWNER_APPROVAL','REGISTRATION_CREDENTIAL_APPROVAL'
  )),
  country_code text NOT NULL,
  locale text NULL,
  reviewer_id uuid NOT NULL REFERENCES public.compliance_reviewers(id),
  decision text NOT NULL CHECK (decision IN ('APPROVE','REJECT','REQUEST_CHANGES')),
  reason text NOT NULL,
  scope text NOT NULL,
  evidence_pack_id text NOT NULL,
  evidence_checksum text NOT NULL,
  source_checksum_set text[] NOT NULL DEFAULT '{}',
  release_sha text NOT NULL,
  migration_head text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  immutable_signature_hash text NOT NULL,
  is_fixture boolean NOT NULL DEFAULT false,
  queue_item_id uuid NULL REFERENCES public.compliance_review_queue(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS compliance_approvals_real_dedupe_uidx
  ON public.compliance_approvals (
    approval_type, country_code, coalesce(locale, ''), release_sha, decision
  )
  WHERE is_fixture = false AND decision = 'APPROVE';

-- ---------------------------------------------------------------------------
-- Evidence objects (no public URLs; secrets never stored)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compliance_evidence_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  queue_item_id uuid NULL REFERENCES public.compliance_review_queue(id),
  approval_type text NULL,
  storage_bucket text NOT NULL DEFAULT 'compliance-evidence',
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  byte_size int NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  sha256 text NOT NULL,
  uploaded_by text NOT NULL,
  retention_until timestamptz NULL,
  is_fixture boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storage_bucket, storage_path)
);

-- ---------------------------------------------------------------------------
-- Operational registration / credential records (secret_ref only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compliance_registration_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  requirement_type text NOT NULL,
  status text NOT NULL DEFAULT 'BLOCKED'
    CHECK (status IN ('VERIFIED','NOT_APPLICABLE','BLOCKED','EXPIRED')),
  authority_or_provider text NULL,
  reference_id text NULL,
  secret_manager_ref text NULL,
  valid_from timestamptz NULL,
  valid_to timestamptz NULL,
  evidence_object_id uuid NULL REFERENCES public.compliance_evidence_objects(id),
  owner_label text NULL,
  reviewer_id uuid NULL REFERENCES public.compliance_reviewers(id),
  verified_at timestamptz NULL,
  notes text NULL,
  is_fixture boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, requirement_type)
);

-- ---------------------------------------------------------------------------
-- Queue assignment columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.compliance_review_queue
  ADD COLUMN IF NOT EXISTS assignee_reviewer_id uuid NULL REFERENCES public.compliance_reviewers(id);
ALTER TABLE public.compliance_review_queue
  ADD COLUMN IF NOT EXISTS task_version text NOT NULL DEFAULT '1';
ALTER TABLE public.compliance_review_queue
  ADD COLUMN IF NOT EXISTS release_sha text NULL;
ALTER TABLE public.compliance_review_queue
  ADD COLUMN IF NOT EXISTS is_fixture boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS compliance_review_queue_subject_uidx
  ON public.compliance_review_queue (subject_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.compliance_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_reviewer_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_evidence_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_registration_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.compliance_reviewers FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.compliance_reviewer_audit FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.compliance_approvals FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.compliance_evidence_objects FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.compliance_registration_records FROM PUBLIC, anon;

GRANT SELECT ON TABLE public.compliance_reviewers TO authenticated, service_role;
GRANT SELECT ON TABLE public.compliance_reviewer_audit TO authenticated, service_role;
GRANT SELECT ON TABLE public.compliance_approvals TO authenticated, service_role;
GRANT SELECT ON TABLE public.compliance_evidence_objects TO authenticated, service_role;
GRANT SELECT ON TABLE public.compliance_registration_records TO authenticated, service_role;

GRANT ALL ON TABLE public.compliance_reviewers TO service_role;
GRANT ALL ON TABLE public.compliance_reviewer_audit TO service_role;
GRANT ALL ON TABLE public.compliance_approvals TO service_role;
GRANT ALL ON TABLE public.compliance_evidence_objects TO service_role;
GRANT ALL ON TABLE public.compliance_registration_records TO service_role;

DROP POLICY IF EXISTS compliance_reviewers_read ON public.compliance_reviewers;
CREATE POLICY compliance_reviewers_read ON public.compliance_reviewers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS compliance_reviewer_audit_read ON public.compliance_reviewer_audit;
CREATE POLICY compliance_reviewer_audit_read ON public.compliance_reviewer_audit
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS compliance_approvals_read ON public.compliance_approvals;
CREATE POLICY compliance_approvals_read ON public.compliance_approvals
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS compliance_evidence_objects_read ON public.compliance_evidence_objects;
CREATE POLICY compliance_evidence_objects_read ON public.compliance_evidence_objects
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS compliance_registration_records_read ON public.compliance_registration_records;
CREATE POLICY compliance_registration_records_read ON public.compliance_registration_records
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.compliance_approvals IS
  '15G.3B append-only approvals. is_fixture=true never counts toward GLOBAL_21_READY.';
COMMENT ON TABLE public.compliance_reviewers IS
  '15G.3B reviewer roster. No fabricated production identities. credential_secret_ref only.';

COMMIT;
