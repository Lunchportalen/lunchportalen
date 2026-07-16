-- PHASE 15G — Global 21-country tax/legal foundation (additive).
-- Does NOT activate any market. Does NOT edit historical migrations.
-- Tax rules seed as RESEARCHED only — never ACTIVE/APPROVED without human review.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Currencies (minor-unit truth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.currencies (
  currency_code text PRIMARY KEY CHECK (currency_code ~ '^[A-Z]{3}$'),
  minor_units smallint NOT NULL CHECK (minor_units BETWEEN 0 AND 4),
  rounding_mode text NOT NULL DEFAULT 'half_up'
    CHECK (rounding_mode IN ('half_up', 'half_even', 'down', 'up')),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.currencies (currency_code, minor_units, name) VALUES
  ('NOK', 2, 'Norwegian krone'),
  ('SEK', 2, 'Swedish krona'),
  ('DKK', 2, 'Danish krone'),
  ('EUR', 2, 'Euro'),
  ('GBP', 2, 'Pound sterling'),
  ('CHF', 2, 'Swiss franc'),
  ('PLN', 2, 'Polish złoty'),
  ('RON', 2, 'Romanian leu'),
  ('CZK', 2, 'Czech koruna'),
  ('USD', 2, 'US dollar'),
  ('CAD', 2, 'Canadian dollar')
ON CONFLICT (currency_code) DO NOTHING;

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.currencies FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.currencies TO authenticated, service_role;

DROP POLICY IF EXISTS currencies_read ON public.currencies;
CREATE POLICY currencies_read ON public.currencies FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 2) Jurisdiction hierarchy (country → region → local)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.jurisdictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  parent_id uuid REFERENCES public.jurisdictions(id),
  level text NOT NULL CHECK (level IN ('country', 'state', 'province', 'county', 'city', 'district', 'special')),
  code text NOT NULL,
  name text NOT NULL,
  coverage_status text NOT NULL DEFAULT 'BLOCKED_MISSING_EVIDENCE'
    CHECK (coverage_status IN ('SUPPORTED', 'NOT_APPLICABLE', 'BLOCKED_MISSING_EVIDENCE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, level, code)
);

CREATE INDEX IF NOT EXISTS jurisdictions_country_idx ON public.jurisdictions (country_code);
CREATE INDEX IF NOT EXISTS jurisdictions_parent_idx ON public.jurisdictions (parent_id);

INSERT INTO public.jurisdictions (country_code, level, code, name, coverage_status)
SELECT c, 'country', c, c, CASE WHEN c IN ('US', 'CA') THEN 'BLOCKED_MISSING_EVIDENCE' ELSE 'SUPPORTED' END
FROM unnest(ARRAY[
  'NO','SE','DK','FI','GB','DE','FR','ES','IT','NL',
  'BE','CH','AT','IE','PL','RO','CZ','PT','GR','US','CA'
]) AS c
ON CONFLICT (country_code, level, code) DO NOTHING;

ALTER TABLE public.jurisdictions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.jurisdictions FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.jurisdictions TO authenticated, service_role;
GRANT ALL ON TABLE public.jurisdictions TO service_role;

DROP POLICY IF EXISTS jurisdictions_read ON public.jurisdictions;
CREATE POLICY jurisdictions_read ON public.jurisdictions FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 3) Tax authorities + evidence + rules (effective-dated)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_authorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  authority_code text NOT NULL,
  name text NOT NULL,
  official_home_url text,
  UNIQUE (country_code, authority_code)
);

CREATE TABLE IF NOT EXISTS public.tax_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  authority_name text NOT NULL,
  source_url text NOT NULL,
  source_title text NOT NULL,
  source_retrieved_at timestamptz NOT NULL DEFAULT now(),
  legal_reference text,
  confidence text NOT NULL DEFAULT 'unverified'
    CHECK (confidence IN ('unverified', 'official_primary', 'official_secondary')),
  review_status text NOT NULL DEFAULT 'RESEARCHED'
    CHECK (review_status IN ('RESEARCHED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED')),
  reviewer text,
  review_timestamp timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tax_categories (
  code text PRIMARY KEY,
  description text NOT NULL
);

INSERT INTO public.tax_categories (code, description) VALUES
  ('cold_food', 'Cold / ambient prepared food'),
  ('hot_food', 'Hot prepared food'),
  ('prepared_food', 'Prepared food (general)'),
  ('restaurant_service', 'Restaurant / on-premise service'),
  ('catering_service', 'Off-premise catering'),
  ('staffed_catering', 'Staffed catering service'),
  ('takeaway', 'Takeaway'),
  ('delivery_fee', 'Delivery fee'),
  ('service_fee', 'Service fee'),
  ('platform_commission', 'Platform commission (5%)'),
  ('alcohol', 'Alcoholic beverages'),
  ('non_alcoholic_beverage', 'Non-alcoholic beverages'),
  ('gratuity', 'Tips / gratuity'),
  ('packaging', 'Packaging'),
  ('refundable_deposit', 'Refundable deposit'),
  ('discount', 'Discount'),
  ('credit_adjustment', 'Credit note adjustment')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.tax_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  jurisdiction_id uuid REFERENCES public.jurisdictions(id),
  tax_category text NOT NULL REFERENCES public.tax_categories(code),
  customer_type text NOT NULL DEFAULT 'any'
    CHECK (customer_type IN ('any', 'B2B', 'B2C')),
  fulfillment_type text NOT NULL DEFAULT 'any'
    CHECK (fulfillment_type IN ('any', 'delivery', 'takeaway', 'on_premise', 'catering')),
  rate_bps integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 100000),
  inclusive boolean NOT NULL DEFAULT false,
  reverse_charge boolean NOT NULL DEFAULT false,
  exemption_code text,
  tax_code text,
  invoice_wording_key text,
  evidence_id uuid REFERENCES public.tax_evidence(id),
  valid_from date NOT NULL,
  valid_to date,
  review_status text NOT NULL DEFAULT 'RESEARCHED'
    CHECK (review_status IN ('RESEARCHED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE INDEX IF NOT EXISTS tax_rules_lookup_idx
  ON public.tax_rules (country_code, tax_category, review_status, valid_from);

CREATE TABLE IF NOT EXISTS public.tax_calculation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_line_id uuid,
  invoice_line_id uuid,
  country_code text NOT NULL,
  currency_code text NOT NULL REFERENCES public.currencies(currency_code),
  tax_category text NOT NULL,
  jurisdiction_path text NOT NULL,
  rate_bps integer NOT NULL,
  taxable_base_minor bigint NOT NULL,
  tax_amount_minor bigint NOT NULL,
  inclusive boolean NOT NULL,
  reverse_charge boolean NOT NULL DEFAULT false,
  rule_id uuid,
  evidence_id uuid,
  engine_version text NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  input_hash text NOT NULL,
  result_json jsonb NOT NULL
);

-- ---------------------------------------------------------------------------
-- 4) Marketplace / commercial model per country
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_commercial_models (
  country_code text PRIMARY KEY CHECK (country_code ~ '^[A-Z]{2}$'),
  platform_role text NOT NULL
    CHECK (platform_role IN (
      'agent', 'disclosed_agent', 'undisclosed_agent',
      'marketplace_facilitator', 'principal_reseller', 'software_intermediary'
    )),
  invoice_issuer text NOT NULL CHECK (invoice_issuer IN ('provider', 'platform', 'split')),
  tax_liable_party text NOT NULL CHECK (tax_liable_party IN ('provider', 'platform', 'customer', 'split')),
  commission_bps integer NOT NULL DEFAULT 500 CHECK (commission_bps = 500),
  review_status text NOT NULL DEFAULT 'DRAFT'
    CHECK (review_status IN ('DRAFT', 'RESEARCHED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.market_commercial_models (country_code, platform_role, invoice_issuer, tax_liable_party, review_status, notes)
SELECT c, 'disclosed_agent', 'provider', 'provider', 'DRAFT',
  'Default draft: provider invoices company; platform invoices 5% commission. Requires legal approval per country.'
FROM unnest(ARRAY[
  'NO','SE','DK','FI','GB','DE','FR','ES','IT','NL',
  'BE','CH','AT','IE','PL','RO','CZ','PT','GR','US','CA'
]) AS c
ON CONFLICT (country_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5) Invoice / e-invoice requirements registry
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_invoice_requirements (
  country_code text PRIMARY KEY,
  e_invoice_status text NOT NULL DEFAULT 'E_INVOICE_BLOCKED_PENDING_APPROVAL'
    CHECK (e_invoice_status IN (
      'E_INVOICE_REQUIRED', 'E_INVOICE_OPTIONAL',
      'E_INVOICE_NOT_APPLICABLE', 'E_INVOICE_BLOCKED_PENDING_APPROVAL'
    )),
  invoice_language_required text,
  numbering_strategy text NOT NULL DEFAULT 'provider_sequential',
  credit_note_required boolean NOT NULL DEFAULT true,
  review_status text NOT NULL DEFAULT 'RESEARCHED'
    CHECK (review_status IN ('RESEARCHED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  evidence_notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.market_invoice_requirements (country_code, e_invoice_status, invoice_language_required, review_status, evidence_notes)
VALUES
  ('NO', 'E_INVOICE_OPTIONAL', 'nb', 'RESEARCHED', 'EHF/Peppol optional for many B2B; Tripletex path exists. Human confirmation required.'),
  ('SE', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'sv', 'RESEARCHED', 'Peppol/Svefaktura landscape — pending official mandate confirmation.'),
  ('DK', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'da', 'RESEARCHED', 'NemHandel/Peppol — pending official confirmation.'),
  ('FI', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'fi', 'RESEARCHED', 'Finvoice/Peppol — pending official confirmation.'),
  ('GB', 'E_INVOICE_NOT_APPLICABLE', 'en', 'RESEARCHED', 'No general B2B e-invoice mandate at seed time — verify HMRC updates.'),
  ('DE', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'de', 'RESEARCHED', 'Growth Act / B2B e-invoice timeline — pending official confirmation.'),
  ('FR', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'fr', 'RESEARCHED', 'Chorus Pro / CTC roadmap — pending official confirmation.'),
  ('ES', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'es', 'RESEARCHED', 'Verifactu/TicketBAI variants — pending official confirmation.'),
  ('IT', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'it', 'RESEARCHED', 'SdI mandatory for many B2B — pending integration design approval.'),
  ('NL', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'nl', 'RESEARCHED', 'Peppol optional/required by buyer — pending confirmation.'),
  ('BE', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'nl', 'RESEARCHED', 'Peppol B2B mandate timeline — pending official confirmation.'),
  ('CH', 'E_INVOICE_OPTIONAL', 'de', 'RESEARCHED', 'No federal mandate equivalent to EU CTC at seed — verify.'),
  ('AT', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'de', 'RESEARCHED', 'Peppol/B2G — pending confirmation.'),
  ('IE', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'en', 'RESEARCHED', 'Pending official confirmation.'),
  ('PL', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'pl', 'RESEARCHED', 'KSeF mandate — pending official effective dates.'),
  ('RO', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'ro', 'RESEARCHED', 'RO e-Factura — pending official confirmation.'),
  ('CZ', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'cs', 'RESEARCHED', 'Pending official confirmation.'),
  ('PT', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'pt', 'RESEARCHED', 'ATCUD/e-fatura — pending confirmation.'),
  ('GR', 'E_INVOICE_BLOCKED_PENDING_APPROVAL', 'el', 'RESEARCHED', 'myDATA — pending confirmation.'),
  ('US', 'E_INVOICE_NOT_APPLICABLE', 'en', 'RESEARCHED', 'No federal B2B e-invoice mandate; state sales-tax returns separate.'),
  ('CA', 'E_INVOICE_NOT_APPLICABLE', 'en', 'RESEARCHED', 'No federal e-invoice mandate equivalent; GST/HST invoice rules apply.')
ON CONFLICT (country_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6) Legal packs (versioned; approval required)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  locale text NOT NULL,
  pack_type text NOT NULL CHECK (pack_type IN (
    'provider_terms', 'company_terms', 'employee_terms',
    'privacy_notice', 'cookie_notice', 'dpa',
    'subprocessor_notice', 'cancellation_refund',
    'acceptable_use', 'complaint_dispute',
    'marketing_consent', 'allergen_responsibility',
    'invoice_payment_terms', 'retention_deletion',
    'international_transfer'
  )),
  version text NOT NULL,
  content_checksum text NOT NULL,
  content_uri text,
  valid_from date NOT NULL,
  valid_to date,
  review_status text NOT NULL DEFAULT 'DRAFT'
    CHECK (review_status IN ('DRAFT', 'MACHINE_TRANSLATED', 'NATIVE_REVIEWED', 'LEGAL_APPROVED', 'REJECTED', 'EXPIRED')),
  native_reviewer text,
  legal_reviewer text,
  reviewed_at timestamptz,
  UNIQUE (country_code, locale, pack_type, version)
);

CREATE TABLE IF NOT EXISTS public.legal_pack_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  user_id uuid,
  legal_pack_id uuid NOT NULL REFERENCES public.legal_packs(id),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  acceptance_method text NOT NULL DEFAULT 'clickwrap'
);

-- ---------------------------------------------------------------------------
-- 7) Extended market readiness (orthogonal to market_approvals commercial ACTIVE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_build_readiness (
  country_code text PRIMARY KEY,
  build_state text NOT NULL DEFAULT 'DRAFT'
    CHECK (build_state IN (
      'DRAFT', 'RESEARCHED', 'TAX_CONFIGURED', 'LEGAL_CONFIGURED',
      'LOCALIZED', 'STAGING_CERTIFIED', 'EXTERNAL_REVIEW_APPROVED',
      'READY_FOR_GLOBAL_CUTOVER', 'ACTIVE'
    )),
  tax_pack_status text NOT NULL DEFAULT 'MISSING'
    CHECK (tax_pack_status IN ('MISSING', 'RESEARCHED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  legal_pack_status text NOT NULL DEFAULT 'MISSING'
    CHECK (legal_pack_status IN ('MISSING', 'RESEARCHED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  invoice_pack_status text NOT NULL DEFAULT 'MISSING'
    CHECK (invoice_pack_status IN ('MISSING', 'RESEARCHED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  localization_status text NOT NULL DEFAULT 'MISSING'
    CHECK (localization_status IN ('MISSING', 'MACHINE', 'NATIVE_REVIEWED', 'APPROVED')),
  staging_e2e_status text NOT NULL DEFAULT 'NOT_RUN'
    CHECK (staging_e2e_status IN ('NOT_RUN', 'FAILED', 'PASSED')),
  blocked_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.market_build_readiness (country_code, build_state, tax_pack_status, legal_pack_status, invoice_pack_status, localization_status)
SELECT c, 'RESEARCHED', 'RESEARCHED', 'MISSING', 'RESEARCHED',
  CASE WHEN c = 'NO' THEN 'NATIVE_REVIEWED' ELSE 'MACHINE' END
FROM unnest(ARRAY[
  'NO','SE','DK','FI','GB','DE','FR','ES','IT','NL',
  'BE','CH','AT','IE','PL','RO','CZ','PT','GR','US','CA'
]) AS c
ON CONFLICT (country_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 8) RLS lockdown on new commercial tables
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tax_authorities', 'tax_evidence', 'tax_categories', 'tax_rules',
    'tax_calculation_snapshots', 'market_commercial_models',
    'market_invoice_requirements', 'legal_packs', 'legal_pack_acceptances',
    'market_build_readiness'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon', t);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', t);
  END LOOP;
END $$;

-- Platform-admin read for approval tables (reuse is_platform_admin when present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_platform_admin'
  ) THEN
    CREATE POLICY tax_evidence_platform_read ON public.tax_evidence
      FOR SELECT TO authenticated USING (public.is_platform_admin());
    CREATE POLICY tax_rules_platform_read ON public.tax_rules
      FOR SELECT TO authenticated USING (public.is_platform_admin());
    CREATE POLICY legal_packs_platform_read ON public.legal_packs
      FOR SELECT TO authenticated USING (public.is_platform_admin());
    CREATE POLICY market_build_readiness_platform_read ON public.market_build_readiness
      FOR SELECT TO authenticated USING (public.is_platform_admin());
    CREATE POLICY market_commercial_models_platform_read ON public.market_commercial_models
      FOR SELECT TO authenticated USING (public.is_platform_admin());
    CREATE POLICY market_invoice_requirements_platform_read ON public.market_invoice_requirements
      FOR SELECT TO authenticated USING (public.is_platform_admin());
  END IF;
END $$;

-- Authenticated may read tax categories + currencies (non-sensitive reference)
DROP POLICY IF EXISTS tax_categories_read ON public.tax_categories;
CREATE POLICY tax_categories_read ON public.tax_categories FOR SELECT TO authenticated USING (true);

COMMIT;
