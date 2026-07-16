-- PHASE 15G.1 — Source evidence lifecycle, US/CA jurisdictions, review workflow, researched seeds.
-- Additive after 20260828120000. No DROP/TRUNCATE of production data. No forged APPROVED statuses.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Official source records (evidence pipeline)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  jurisdiction_code text,
  authority_name text NOT NULL,
  official_domain text NOT NULL,
  source_url text NOT NULL,
  source_title text NOT NULL,
  legal_reference text,
  publication_date date,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  valid_from date,
  valid_to date,
  language text NOT NULL DEFAULT 'en',
  checksum text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN (
    'tax_rate_table','tax_guidance','invoice_mandate','e_invoice_mandate',
    'legal_statute','privacy_guidance','dor_bulletin'
  )),
  parser_version text NOT NULL,
  extracted_claims jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer_status text NOT NULL DEFAULT 'UNREVIEWED'
    CHECK (reviewer_status IN ('UNREVIEWED','PENDING_REVIEW','APPROVED','REJECTED','EXPIRED')),
  reviewer_id text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to > valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS tax_source_records_url_checksum_uidx
  ON public.tax_source_records (source_url, checksum);
CREATE INDEX IF NOT EXISTS tax_source_records_country_idx
  ON public.tax_source_records (country_code, reviewer_status);

ALTER TABLE public.tax_source_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tax_source_records FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.tax_source_records TO authenticated, service_role;
GRANT ALL ON TABLE public.tax_source_records TO service_role;

DROP POLICY IF EXISTS tax_source_records_read ON public.tax_source_records;
CREATE POLICY tax_source_records_read ON public.tax_source_records
  FOR SELECT TO authenticated USING (true);

-- Seed researched official sources (UNREVIEWED / not APPROVED)
INSERT INTO public.tax_source_records (
  id, country_code, jurisdiction_code, authority_name, official_domain, source_url, source_title,
  legal_reference, publication_date, retrieved_at, valid_from, language, checksum, source_type,
  parser_version, extracted_claims, reviewer_status
) VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    'NO', NULL, 'Skatteetaten', 'skatteetaten.no',
    'https://www.skatteetaten.no/satser/merverdiavgift/',
    'Merverdiavgiftssatser',
    'Merverdiavgiftsloven',
    '2026-01-01', '2026-07-16T09:00:00Z', '2026-01-01', 'nb',
    'sha256:no-mva-2026-researched-pointer',
    'tax_rate_table', '15g1.1.0',
    '["standard_25","foodstuffs_15","selected_services_12"]'::jsonb,
    'UNREVIEWED'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'GB', NULL, 'HM Revenue & Customs', 'gov.uk',
    'https://www.gov.uk/guidance/catering-takeaway-food-and-vat-notice-7091',
    'Catering, takeaway food (VAT Notice 709/1)',
    'VAT Act 1994 Group 1 Schedule 8 notes',
    NULL, '2026-07-16T09:00:00Z', '2012-10-01', 'en',
    'sha256:gb-hmrc-709-1-researched-pointer',
    'tax_guidance', '15g1.1.0',
    '["hot_takeaway_standard","cold_takeaway_often_zero","on_premise_standard"]'::jsonb,
    'UNREVIEWED'
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'CA', NULL, 'Canada Revenue Agency', 'canada.ca',
    'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html',
    'GST/HST calculator (and rates)',
    NULL,
    '2025-04-01', '2026-07-16T09:00:00Z', '2025-04-01', 'en',
    'sha256:ca-cra-gst-hst-rates-researched-pointer',
    'tax_rate_table', '15g1.1.0',
    '["gst_5","hst_by_province","ns_hst_14_from_2025_04_01"]'::jsonb,
    'UNREVIEWED'
  )
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) US 50+DC and CA 13 jurisdictions
-- ---------------------------------------------------------------------------
INSERT INTO public.jurisdictions (country_code, parent_id, level, code, name, coverage_status)
VALUES
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'AL', 'Alabama'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'AK', 'Alaska'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'AZ', 'Arizona'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'AR', 'Arkansas'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'CA', 'California'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'CO', 'Colorado'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'CT', 'Connecticut'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'DE', 'Delaware'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'DC', 'District of Columbia'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'FL', 'Florida'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'GA', 'Georgia'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'HI', 'Hawaii'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'ID', 'Idaho'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'IL', 'Illinois'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'IN', 'Indiana'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'IA', 'Iowa'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'KS', 'Kansas'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'KY', 'Kentucky'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'LA', 'Louisiana'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'ME', 'Maine'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'MD', 'Maryland'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'MA', 'Massachusetts'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'MI', 'Michigan'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'MN', 'Minnesota'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'MS', 'Mississippi'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'MO', 'Missouri'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'MT', 'Montana'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'NE', 'Nebraska'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'NV', 'Nevada'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'NH', 'New Hampshire'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'NJ', 'New Jersey'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'NM', 'New Mexico'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'NY', 'New York'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'NC', 'North Carolina'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'ND', 'North Dakota'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'OH', 'Ohio'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'OK', 'Oklahoma'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'OR', 'Oregon'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'PA', 'Pennsylvania'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'RI', 'Rhode Island'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'SC', 'South Carolina'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'SD', 'South Dakota'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'TN', 'Tennessee'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'TX', 'Texas'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'UT', 'Utah'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'VT', 'Vermont'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'VA', 'Virginia'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'WA', 'Washington'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'WV', 'West Virginia'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'WI', 'Wisconsin'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('US', (SELECT id FROM public.jurisdictions WHERE country_code='US' AND level='country' AND code='US'), 'state', 'WY', 'Wyoming'::text, 'BLOCKED_MISSING_EVIDENCE')
ON CONFLICT (country_code, level, code) DO NOTHING;

INSERT INTO public.jurisdictions (country_code, parent_id, level, code, name, coverage_status)
VALUES
  ('CA', (SELECT id FROM public.jurisdictions WHERE country_code='CA' AND level='country' AND code='CA'), 'province', 'AB', 'Alberta'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('CA', (SELECT id FROM public.jurisdictions WHERE country_code='CA' AND level='country' AND code='CA'), 'province', 'BC', 'British Columbia'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('CA', (SELECT id FROM public.jurisdictions WHERE country_code='CA' AND level='country' AND code='CA'), 'province', 'MB', 'Manitoba'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('CA', (SELECT id FROM public.jurisdictions WHERE country_code='CA' AND level='country' AND code='CA'), 'province', 'NB', 'New Brunswick'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('CA', (SELECT id FROM public.jurisdictions WHERE country_code='CA' AND level='country' AND code='CA'), 'province', 'NL', 'Newfoundland and Labrador'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('CA', (SELECT id FROM public.jurisdictions WHERE country_code='CA' AND level='country' AND code='CA'), 'province', 'NT', 'Northwest Territories'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('CA', (SELECT id FROM public.jurisdictions WHERE country_code='CA' AND level='country' AND code='CA'), 'province', 'NS', 'Nova Scotia'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('CA', (SELECT id FROM public.jurisdictions WHERE country_code='CA' AND level='country' AND code='CA'), 'province', 'NU', 'Nunavut'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('CA', (SELECT id FROM public.jurisdictions WHERE country_code='CA' AND level='country' AND code='CA'), 'province', 'ON', 'Ontario'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('CA', (SELECT id FROM public.jurisdictions WHERE country_code='CA' AND level='country' AND code='CA'), 'province', 'PE', 'Prince Edward Island'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('CA', (SELECT id FROM public.jurisdictions WHERE country_code='CA' AND level='country' AND code='CA'), 'province', 'QC', 'Quebec'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('CA', (SELECT id FROM public.jurisdictions WHERE country_code='CA' AND level='country' AND code='CA'), 'province', 'SK', 'Saskatchewan'::text, 'BLOCKED_MISSING_EVIDENCE'),
  ('CA', (SELECT id FROM public.jurisdictions WHERE country_code='CA' AND level='country' AND code='CA'), 'province', 'YT', 'Yukon'::text, 'BLOCKED_MISSING_EVIDENCE')
ON CONFLICT (country_code, level, code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.us_jurisdiction_meta (
  country_code text NOT NULL DEFAULT 'US' CHECK (country_code = 'US'),
  state_code text NOT NULL,
  official_dor_url text NOT NULL,
  prepared_food_model text NOT NULL DEFAULT 'PENDING_DOR_EVIDENCE',
  marketplace_facilitator text NOT NULL DEFAULT 'PENDING_DOR_EVIDENCE',
  PRIMARY KEY (country_code, state_code)
);

INSERT INTO public.us_jurisdiction_meta (country_code, state_code, official_dor_url, prepared_food_model, marketplace_facilitator)
VALUES
  ('US', 'AL', 'https://www.revenue.alabama.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'AK', 'https://tax.alaska.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'AZ', 'https://azdor.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'AR', 'https://www.dfa.arkansas.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'CA', 'https://www.cdtfa.ca.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'CO', 'https://tax.colorado.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'CT', 'https://portal.ct.gov/DRS', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'DE', 'https://revenue.delaware.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'DC', 'https://otr.cfo.dc.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'FL', 'https://floridarevenue.com/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'GA', 'https://dor.georgia.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'HI', 'https://tax.hawaii.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'ID', 'https://tax.idaho.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'IL', 'https://tax.illinois.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'IN', 'https://www.in.gov/dor/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'IA', 'https://tax.iowa.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'KS', 'https://www.ksrevenue.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'KY', 'https://revenue.ky.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'LA', 'https://revenue.louisiana.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'ME', 'https://www.maine.gov/revenue/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'MD', 'https://www.marylandtaxes.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'MA', 'https://www.mass.gov/orgs/massachusetts-department-of-revenue', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'MI', 'https://www.michigan.gov/taxes', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'MN', 'https://www.revenue.state.mn.us/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'MS', 'https://www.dor.ms.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'MO', 'https://dor.mo.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'MT', 'https://mtrevenue.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'NE', 'https://revenue.nebraska.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'NV', 'https://tax.nv.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'NH', 'https://www.revenue.nh.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'NJ', 'https://www.nj.gov/treasury/taxation/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'NM', 'https://www.tax.newmexico.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'NY', 'https://www.tax.ny.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'NC', 'https://www.ncdor.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'ND', 'https://www.tax.nd.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'OH', 'https://tax.ohio.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'OK', 'https://oklahoma.gov/tax.html', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'OR', 'https://www.oregon.gov/dor/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'PA', 'https://www.revenue.pa.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'RI', 'https://tax.ri.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'SC', 'https://dor.sc.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'SD', 'https://dor.sd.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'TN', 'https://www.tn.gov/revenue.html', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'TX', 'https://comptroller.texas.gov/taxes/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'UT', 'https://tax.utah.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'VT', 'https://tax.vermont.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'VA', 'https://www.tax.virginia.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'WA', 'https://dor.wa.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'WV', 'https://tax.wv.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'WI', 'https://www.revenue.wi.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE'),
  ('US', 'WY', 'https://revenue.wyo.gov/', 'PENDING_DOR_EVIDENCE', 'PENDING_DOR_EVIDENCE')
ON CONFLICT (country_code, state_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ca_jurisdiction_meta (
  country_code text NOT NULL DEFAULT 'CA' CHECK (country_code = 'CA'),
  province_code text NOT NULL,
  tax_model text NOT NULL CHECK (tax_model IN ('GST','HST','GST_PST','GST_QST')),
  gst_or_hst_bps_researched integer NOT NULL,
  provincial_bps_researched integer,
  official_federal_source_url text NOT NULL,
  PRIMARY KEY (country_code, province_code)
);

INSERT INTO public.ca_jurisdiction_meta (
  country_code, province_code, tax_model, gst_or_hst_bps_researched, provincial_bps_researched, official_federal_source_url
) VALUES
  ('CA', 'AB', 'GST', 500, NULL, 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html'),
  ('CA', 'BC', 'GST_PST', 500, 700, 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html'),
  ('CA', 'MB', 'GST_PST', 500, 700, 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html'),
  ('CA', 'NB', 'HST', 1500, NULL, 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html'),
  ('CA', 'NL', 'HST', 1500, NULL, 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html'),
  ('CA', 'NT', 'GST', 500, NULL, 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html'),
  ('CA', 'NS', 'HST', 1400, NULL, 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html'),
  ('CA', 'NU', 'GST', 500, NULL, 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html'),
  ('CA', 'ON', 'HST', 1300, NULL, 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html'),
  ('CA', 'PE', 'HST', 1500, NULL, 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html'),
  ('CA', 'QC', 'GST_QST', 500, 9975, 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html'),
  ('CA', 'SK', 'GST_PST', 500, 600, 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html'),
  ('CA', 'YT', 'GST', 500, NULL, 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html')
ON CONFLICT (country_code, province_code) DO NOTHING;

ALTER TABLE public.us_jurisdiction_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ca_jurisdiction_meta ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.us_jurisdiction_meta FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.ca_jurisdiction_meta FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.us_jurisdiction_meta TO authenticated, service_role;
GRANT SELECT ON TABLE public.ca_jurisdiction_meta TO authenticated, service_role;
GRANT ALL ON TABLE public.us_jurisdiction_meta TO service_role;
GRANT ALL ON TABLE public.ca_jurisdiction_meta TO service_role;

DROP POLICY IF EXISTS us_jurisdiction_meta_read ON public.us_jurisdiction_meta;
CREATE POLICY us_jurisdiction_meta_read ON public.us_jurisdiction_meta FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ca_jurisdiction_meta_read ON public.ca_jurisdiction_meta;
CREATE POLICY ca_jurisdiction_meta_read ON public.ca_jurisdiction_meta FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 3) Marketplace legal models + e-invoice capabilities
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketplace_legal_models (
  country_code text PRIMARY KEY CHECK (country_code ~ '^[A-Z]{2}$'),
  platform_legal_role text NOT NULL,
  supplier_of_food text NOT NULL,
  contracting_party text NOT NULL,
  invoice_issuer text NOT NULL,
  tax_liable_party text NOT NULL,
  refund_credit_owner text NOT NULL,
  commission_invoice_issuer text NOT NULL DEFAULT 'platform',
  commission_bps integer NOT NULL DEFAULT 500 CHECK (commission_bps = 500),
  commission_tax_treatment text NOT NULL DEFAULT 'pending_legal',
  delivery_responsibility text NOT NULL,
  allergen_info_responsibility text NOT NULL DEFAULT 'provider',
  data_controller_role text NOT NULL,
  data_processor_role text NOT NULL,
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','REVIEWED','APPROVED','BLOCKED')),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.marketplace_legal_models (
  country_code, platform_legal_role, supplier_of_food, contracting_party, invoice_issuer,
  tax_liable_party, refund_credit_owner, delivery_responsibility, data_controller_role,
  data_processor_role, status, notes
)
SELECT c, 'disclosed_agent', 'provider', 'provider', 'provider', 'provider', 'provider',
  'provider', 'platform', 'platform', 'DRAFT',
  'Draft default — requires legal/tax APPROVED before READY_FOR_GLOBAL_CUTOVER'
FROM unnest(ARRAY[
  'NO','SE','DK','FI','GB','DE','FR','ES','IT','NL',
  'BE','CH','AT','IE','PL','RO','CZ','PT','GR','US','CA'
]) AS c
ON CONFLICT (country_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.e_invoice_capabilities (
  country_code text PRIMARY KEY,
  channels text[] NOT NULL,
  requirement_status text NOT NULL DEFAULT 'RESEARCHED'
    CHECK (requirement_status IN ('RESEARCHED','REQUIRED','OPTIONAL','NOT_APPLICABLE','APPROVED')),
  adapter_status text NOT NULL DEFAULT 'STUB'
    CHECK (adapter_status IN ('NOT_BUILT','STUB','STAGING_READY','PRODUCTION_READY','NOT_APPLICABLE')),
  official_source_url text,
  effective_date date,
  staging_delivery_proof text,
  reviewer_approval text NOT NULL DEFAULT 'NONE'
    CHECK (reviewer_approval IN ('NONE','APPROVED')),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.e_invoice_capabilities (country_code, channels, requirement_status, adapter_status, notes)
SELECT c,
  CASE WHEN c = 'US' THEN ARRAY['pdf_email','accounting_export']
       WHEN c IN ('NO','SE','DK','FI','DE','NL','BE','AT','IE') THEN ARRAY['pdf_email','peppol','accounting_export']
       ELSE ARRAY['pdf_email','accounting_export'] END,
  CASE WHEN c = 'US' THEN 'NOT_APPLICABLE' ELSE 'RESEARCHED' END,
  CASE WHEN c = 'US' THEN 'NOT_APPLICABLE' ELSE 'STUB' END,
  'Phase 15G.1 stub — no fake legal invoice issuance'
FROM unnest(ARRAY[
  'NO','SE','DK','FI','GB','DE','FR','ES','IT','NL',
  'BE','CH','AT','IE','PL','RO','CZ','PT','GR','US','CA'
]) AS c
ON CONFLICT (country_code) DO NOTHING;

ALTER TABLE public.marketplace_legal_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.e_invoice_capabilities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.marketplace_legal_models FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.e_invoice_capabilities FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.marketplace_legal_models TO authenticated, service_role;
GRANT SELECT ON TABLE public.e_invoice_capabilities TO authenticated, service_role;
GRANT ALL ON TABLE public.marketplace_legal_models TO service_role;
GRANT ALL ON TABLE public.e_invoice_capabilities TO service_role;
DROP POLICY IF EXISTS marketplace_legal_models_read ON public.marketplace_legal_models;
CREATE POLICY marketplace_legal_models_read ON public.marketplace_legal_models FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS e_invoice_capabilities_read ON public.e_invoice_capabilities;
CREATE POLICY e_invoice_capabilities_read ON public.e_invoice_capabilities FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 4) Review workflow (append-only history)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.compliance_review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL CHECK (domain IN (
    'tax','legal','invoice','e_invoice','privacy','localization','marketplace'
  )),
  country_code text NOT NULL,
  locale text,
  subject_id text NOT NULL,
  evidence_checksum text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED'
    CHECK (status IN ('QUEUED','IN_REVIEW','APPROVED','BLOCKED','EXPIRED')),
  subject_author_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.compliance_review_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id uuid NOT NULL REFERENCES public.compliance_review_queue(id),
  reviewer_id text NOT NULL,
  reviewer_role text NOT NULL CHECK (reviewer_role IN (
    'tax_reviewer','legal_reviewer','native_language_reviewer','security_reviewer','product_owner'
  )),
  decision text NOT NULL CHECK (decision IN ('APPROVE','REJECT','REQUEST_CHANGES')),
  evidence_checksum text NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  notes text NOT NULL DEFAULT ''
);

ALTER TABLE public.compliance_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_review_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.compliance_review_queue FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.compliance_review_history FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.compliance_review_queue TO authenticated, service_role;
GRANT SELECT ON TABLE public.compliance_review_history TO authenticated, service_role;
GRANT ALL ON TABLE public.compliance_review_queue TO service_role;
GRANT ALL ON TABLE public.compliance_review_history TO service_role;
DROP POLICY IF EXISTS compliance_review_queue_read ON public.compliance_review_queue;
CREATE POLICY compliance_review_queue_read ON public.compliance_review_queue FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS compliance_review_history_read ON public.compliance_review_history;
CREATE POLICY compliance_review_history_read ON public.compliance_review_history FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 5) Legal document versions (24 locales × document types) — stubs only
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  locale text NOT NULL,
  document_type text NOT NULL,
  version text NOT NULL,
  valid_from date NOT NULL,
  checksum text NOT NULL,
  official_legal_sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewer_status text NOT NULL DEFAULT 'DRAFT'
    CHECK (reviewer_status IN ('DRAFT','MACHINE_TRANSLATED','NATIVE_REVIEWED','LEGAL_APPROVED','REJECTED','EXPIRED')),
  native_reviewer_status text NOT NULL DEFAULT 'DRAFT'
    CHECK (native_reviewer_status IN ('DRAFT','MACHINE_TRANSLATED','NATIVE_REVIEWED','LEGAL_APPROVED','REJECTED','EXPIRED')),
  body_stub text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, locale, document_type, version)
);

ALTER TABLE public.legal_document_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.legal_document_versions FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.legal_document_versions TO authenticated, service_role;
GRANT ALL ON TABLE public.legal_document_versions TO service_role;
DROP POLICY IF EXISTS legal_document_versions_read ON public.legal_document_versions;
CREATE POLICY legal_document_versions_read ON public.legal_document_versions FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 6) Researched tax rules (RESEARCHED only) linked to source records
-- ---------------------------------------------------------------------------
INSERT INTO public.tax_evidence (
  id, country_code, authority_name, source_url, source_title, legal_reference,
  confidence, review_status, notes
) VALUES
  (
    'b1000000-0000-4000-8000-000000000001',
    'NO', 'Skatteetaten',
    'https://www.skatteetaten.no/satser/merverdiavgift/',
    'Merverdiavgiftssatser',
    'Merverdiavgiftsloven',
    'official_primary', 'RESEARCHED',
    'Phase 15G.1 researched pointer — not human APPROVED'
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'GB', 'HM Revenue & Customs',
    'https://www.gov.uk/guidance/catering-takeaway-food-and-vat-notice-7091',
    'VAT Notice 709/1',
    NULL,
    'official_primary', 'RESEARCHED',
    'Phase 15G.1 researched pointer — not human APPROVED'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.tax_rules (
  country_code, jurisdiction_id, tax_category, customer_type, fulfillment_type,
  rate_bps, inclusive, reverse_charge, tax_code, invoice_wording_key, evidence_id,
  valid_from, valid_to, review_status
)
SELECT
  'NO',
  j.id,
  r.cat,
  'any',
  'any',
  r.bps,
  false,
  false,
  r.tax_code,
  r.wording,
  'b1000000-0000-4000-8000-000000000001',
  '2026-01-01',
  NULL,
  'RESEARCHED'
FROM public.jurisdictions j
CROSS JOIN (VALUES
  ('restaurant_service', 2500, 'NO-MVA-25', 'no.mva.standard'),
  ('cold_food', 1500, 'NO-MVA-15-FOOD', 'no.mva.food'),
  ('hot_food', 2500, 'NO-MVA-HOT-CANDIDATE', 'no.mva.standard'),
  ('platform_commission', 2500, 'NO-MVA-COMMISSION-CANDIDATE', 'no.mva.standard')
) AS r(cat, bps, tax_code, wording)
WHERE j.country_code = 'NO' AND j.level = 'country'
  AND NOT EXISTS (
    SELECT 1 FROM public.tax_rules tr
    WHERE tr.tax_code = r.tax_code AND tr.country_code = 'NO' AND tr.review_status = 'RESEARCHED'
  );

INSERT INTO public.tax_rules (
  country_code, jurisdiction_id, tax_category, customer_type, fulfillment_type,
  rate_bps, inclusive, reverse_charge, tax_code, invoice_wording_key, evidence_id,
  valid_from, valid_to, review_status
)
SELECT
  'GB',
  j.id,
  r.cat,
  'any',
  r.fulfill,
  r.bps,
  false,
  false,
  r.tax_code,
  r.wording,
  'b1000000-0000-4000-8000-000000000002',
  '2012-10-01',
  NULL,
  'RESEARCHED'
FROM public.jurisdictions j
CROSS JOIN (VALUES
  ('catering_service', 'any', 2000, 'GB-VAT-STD', 'gb.vat.standard'),
  ('hot_food', 'takeaway', 2000, 'GB-VAT-HOT-TAKEAWAY', 'gb.vat.standard'),
  ('cold_food', 'takeaway', 0, 'GB-VAT-ZERO-COLD', 'gb.vat.zero'),
  ('restaurant_service', 'on_premise', 2000, 'GB-VAT-ON-PREMISE', 'gb.vat.standard')
) AS r(cat, fulfill, bps, tax_code, wording)
WHERE j.country_code = 'GB' AND j.level = 'country'
  AND NOT EXISTS (
    SELECT 1 FROM public.tax_rules tr
    WHERE tr.tax_code = r.tax_code AND tr.country_code = 'GB' AND tr.review_status = 'RESEARCHED'
  );

-- ---------------------------------------------------------------------------
-- 7) Evidence checksum change → expire APPROVED queue items (trigger)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_expire_reviews_on_source_checksum_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.checksum IS DISTINCT FROM OLD.checksum THEN
    UPDATE public.compliance_review_queue q
      SET status = 'EXPIRED'
    WHERE q.evidence_checksum = OLD.checksum
      AND q.status = 'APPROVED';

    UPDATE public.tax_source_records
      SET reviewer_status = 'EXPIRED'
    WHERE id = NEW.id
      AND reviewer_status = 'APPROVED';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tax_source_checksum_expire ON public.tax_source_records;
CREATE TRIGGER trg_tax_source_checksum_expire
  AFTER UPDATE OF checksum ON public.tax_source_records
  FOR EACH ROW
  EXECUTE FUNCTION public.lp_expire_reviews_on_source_checksum_change();

-- ---------------------------------------------------------------------------
-- 8) Compatibility / rollback notes (comment only)
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.tax_source_records IS
  '15G.1 additive. Old app ignores table. Rollback: stop writing; do not DROP in prod without approved plan.';
COMMENT ON TABLE public.us_jurisdiction_meta IS
  '15G.1 US DOR pointers. coverage remains BLOCKED_MISSING_EVIDENCE until human APPROVED rules.';
COMMENT ON TABLE public.ca_jurisdiction_meta IS
  '15G.1 CRA researched GST/HST bps. Food classification still blocked for launch.';

COMMIT;
