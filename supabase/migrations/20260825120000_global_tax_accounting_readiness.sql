-- PHASE 10 — GLOBAL TAX AND ACCOUNTING READINESS (additive).
--
-- Gjør de 21 kanoniske landene fakturerbare og regnskapsmessig kontrollerbare:
--   NO SE DK FI GB DE FR ES IT NL BE CH AT IE PL RO CZ PT GR US CA
--
-- Modellregler (LÅST):
--   - Markedsidentitet = country_code. Locale er presentasjon, ALDRI skattelogikk.
--   - Currency er separat fra språk. Tax strategy er separat fra locale.
--   - US/CA: state/province OG provider-tidssone er eksplisitt påkrevd.
--   - Kommersielt ikke-godkjente skattesatser feiler LUKKET: ingen faktura kan
--     opprettes i et marked uten market_approvals.status = 'ACTIVE'.
--   - Ingen falsk påstand om native regnskapsintegrasjon: Tripletex er KUN
--     Norge; alle andre markeder bruker generisk eksport.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) markets: skatte- og regnskapskonfig per land (additivt; lik per country).
-- ---------------------------------------------------------------------------
ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS tax_strategy text NOT NULL DEFAULT 'vat',
  ADD COLUMN IF NOT EXISTS tax_id_validation text,
  ADD COLUMN IF NOT EXISTS reverse_charge_supported boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_exempt_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS state_province_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider_timezone_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS postal_code_pattern text,
  ADD COLUMN IF NOT EXISTS address_format text,
  ADD COLUMN IF NOT EXISTS invoice_legal_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS credit_note_policy text NOT NULL DEFAULT 'separate_document',
  ADD COLUMN IF NOT EXISTS invoice_numbering_policy text NOT NULL DEFAULT 'sequential_per_provider_year';

ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_tax_strategy_chk;
ALTER TABLE public.markets
  ADD CONSTRAINT markets_tax_strategy_chk CHECK (tax_strategy IN ('vat', 'sales_tax', 'gst_hst'));

ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_tax_id_validation_chk;
ALTER TABLE public.markets
  ADD CONSTRAINT markets_tax_id_validation_chk CHECK (
    tax_id_validation IS NULL OR tax_id_validation IN (
      'no_orgnr_mva', 'eu_vies_format', 'uk_vat_format', 'ch_uid_format', 'us_ein_format', 'ca_bn_format'
    )
  );

ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_credit_note_policy_chk;
ALTER TABLE public.markets
  ADD CONSTRAINT markets_credit_note_policy_chk CHECK (
    credit_note_policy IN ('separate_document', 'negative_mirror')
  );

ALTER TABLE public.markets DROP CONSTRAINT IF EXISTS markets_invoice_numbering_chk;
ALTER TABLE public.markets
  ADD CONSTRAINT markets_invoice_numbering_chk CHECK (
    invoice_numbering_policy IN ('sequential_per_provider_year', 'sequential_per_legal_entity_year')
  );

COMMENT ON COLUMN public.markets.tax_strategy IS
  'Country tax model: vat (EU/EØS/GB/CH), sales_tax (US), gst_hst (CA). NEVER derived from locale or language.';
COMMENT ON COLUMN public.markets.tax_id_validation IS
  'Tax/VAT-ID validation strategy per country. Format-only strategies are honest: no live registry lookup is claimed.';
COMMENT ON COLUMN public.markets.provider_timezone_required IS
  'US/CA: no defensible market default timezone exists; provider billing_timezone is mandatory.';
COMMENT ON COLUMN public.markets.invoice_legal_fields IS
  'Legally required invoice fields (key list) for this market. Rendered by the canonical invoice document.';

-- Felles lovpålagte fakturafelter (basis for alle markeder).
-- Markedsspesifikke tillegg settes per land under.
WITH base AS (
  SELECT '["invoice_number","issue_date","due_date","seller_legal_name","seller_address","seller_tax_id","buyer_legal_name","buyer_address","line_descriptions","net_amount","tax_rate","tax_amount","gross_amount","currency","payment_terms"]'::jsonb AS fields
)
UPDATE public.markets m
SET invoice_legal_fields = base.fields
FROM base
WHERE m.invoice_legal_fields = '[]'::jsonb;

-- Per-land konfig (alle locale-rader for et land får identisk konfig).
-- EU/EØS-medlemmer: VIES-format + reverse charge B2B.
UPDATE public.markets SET
  tax_strategy = 'vat',
  tax_id_validation = 'eu_vies_format',
  reverse_charge_supported = true,
  tax_exempt_reasons = '["INTRA_EU_REVERSE_CHARGE","EXPORT_OUTSIDE_EU","PUBLIC_BODY_EXEMPT"]'::jsonb,
  address_format = 'street_postal_city'
WHERE country_code IN ('SE','DK','FI','DE','FR','ES','IT','NL','BE','AT','IE','PL','RO','CZ','PT','GR');

-- Norge: orgnr + MVA-suffiks; ikke EU (ingen intra-EU reverse charge på lunsj).
UPDATE public.markets SET
  tax_strategy = 'vat',
  tax_id_validation = 'no_orgnr_mva',
  reverse_charge_supported = false,
  tax_exempt_reasons = '["PUBLIC_BODY_EXEMPT"]'::jsonb,
  postal_code_pattern = '^\d{4}$',
  address_format = 'street_postal_city',
  invoice_legal_fields = invoice_legal_fields || '["organisasjonsnummer_mva_suffix"]'::jsonb
WHERE country_code = 'NO';

-- Storbritannia: UK VAT (domestic reverse charge finnes; VIES gjelder ikke).
UPDATE public.markets SET
  tax_strategy = 'vat',
  tax_id_validation = 'uk_vat_format',
  reverse_charge_supported = true,
  tax_exempt_reasons = '["EXPORT_OUTSIDE_UK","PUBLIC_BODY_EXEMPT"]'::jsonb,
  postal_code_pattern = '^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$',
  address_format = 'street_city_postal',
  invoice_legal_fields = invoice_legal_fields || '["uk_vat_registration_number"]'::jsonb
WHERE country_code = 'GB';

-- Sveits: UID/MWST; ikke EU.
UPDATE public.markets SET
  tax_strategy = 'vat',
  tax_id_validation = 'ch_uid_format',
  reverse_charge_supported = false,
  tax_exempt_reasons = '["EXPORT_OUTSIDE_CH","PUBLIC_BODY_EXEMPT"]'::jsonb,
  postal_code_pattern = '^\d{4}$',
  address_format = 'street_postal_city',
  invoice_legal_fields = invoice_legal_fields || '["ch_uid_mwst_number"]'::jsonb
WHERE country_code = 'CH';

-- USA: sales tax per stat; state + provider-tidssone PÅKREVD; ingen VAT-ID.
UPDATE public.markets SET
  tax_strategy = 'sales_tax',
  tax_id_validation = 'us_ein_format',
  reverse_charge_supported = false,
  tax_exempt_reasons = '["RESALE_CERTIFICATE","NONPROFIT_EXEMPT","GOVERNMENT_EXEMPT"]'::jsonb,
  state_province_required = true,
  provider_timezone_required = true,
  postal_code_pattern = '^\d{5}(-\d{4})?$',
  address_format = 'street_city_state_zip',
  invoice_legal_fields = invoice_legal_fields || '["state_province","sales_tax_rate_by_jurisdiction"]'::jsonb
WHERE country_code = 'US';

-- Canada: GST/HST (+ ev. PST/QST); province + provider-tidssone PÅKREVD.
UPDATE public.markets SET
  tax_strategy = 'gst_hst',
  tax_id_validation = 'ca_bn_format',
  reverse_charge_supported = false,
  tax_exempt_reasons = '["ZERO_RATED_SUPPLY","GOVERNMENT_EXEMPT"]'::jsonb,
  state_province_required = true,
  provider_timezone_required = true,
  postal_code_pattern = '^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$',
  address_format = 'street_city_province_postal',
  invoice_legal_fields = invoice_legal_fields || '["state_province","gst_hst_registration_number"]'::jsonb
WHERE country_code = 'CA';

-- Postnummer-mønstre for øvrige land.
UPDATE public.markets SET postal_code_pattern = '^\d{3} ?\d{2}$' WHERE country_code IN ('SE','CZ') AND postal_code_pattern IS NULL;
UPDATE public.markets SET postal_code_pattern = '^\d{4}$' WHERE country_code IN ('DK','BE','AT') AND postal_code_pattern IS NULL;
UPDATE public.markets SET postal_code_pattern = '^\d{5}$' WHERE country_code IN ('FI','DE','FR','ES','IT') AND postal_code_pattern IS NULL;
UPDATE public.markets SET postal_code_pattern = '^\d{4} ?[A-Za-z]{2}$' WHERE country_code = 'NL' AND postal_code_pattern IS NULL;
UPDATE public.markets SET postal_code_pattern = '^[A-Za-z]\d{2} ?[A-Za-z\d]{4}$' WHERE country_code = 'IE' AND postal_code_pattern IS NULL;
UPDATE public.markets SET postal_code_pattern = '^\d{2}-\d{3}$' WHERE country_code = 'PL' AND postal_code_pattern IS NULL;
UPDATE public.markets SET postal_code_pattern = '^\d{6}$' WHERE country_code = 'RO' AND postal_code_pattern IS NULL;
UPDATE public.markets SET postal_code_pattern = '^\d{4}-\d{3}$' WHERE country_code = 'PT' AND postal_code_pattern IS NULL;
UPDATE public.markets SET postal_code_pattern = '^\d{3} ?\d{2}$' WHERE country_code = 'GR' AND postal_code_pattern IS NULL;
UPDATE public.markets SET address_format = 'street_postal_city' WHERE address_format IS NULL AND country_code NOT IN ('GB','IE','US','CA');
UPDATE public.markets SET address_format = 'street_city_postal' WHERE address_format IS NULL AND country_code = 'IE';

-- ---------------------------------------------------------------------------
-- 2) Provider tax profile (organization_billing_profiles, additivt).
-- ---------------------------------------------------------------------------
ALTER TABLE public.organization_billing_profiles
  ADD COLUMN IF NOT EXISTS state_province text,
  ADD COLUMN IF NOT EXISTS tax_scheme text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS tax_exempt_reason text;

ALTER TABLE public.organization_billing_profiles DROP CONSTRAINT IF EXISTS organization_billing_profiles_tax_scheme_chk;
ALTER TABLE public.organization_billing_profiles
  ADD CONSTRAINT organization_billing_profiles_tax_scheme_chk CHECK (
    tax_scheme IN ('standard', 'reverse_charge', 'exempt')
  );

ALTER TABLE public.organization_billing_profiles DROP CONSTRAINT IF EXISTS organization_billing_profiles_exempt_reason_chk;
ALTER TABLE public.organization_billing_profiles
  ADD CONSTRAINT organization_billing_profiles_exempt_reason_chk CHECK (
    tax_scheme <> 'exempt' OR nullif(trim(coalesce(tax_exempt_reason, '')), '') IS NOT NULL
  );

-- US/CA-vokter: state/province og tidssone er PÅKREVD der markedet krever det.
CREATE OR REPLACE FUNCTION public.lp_billing_profile_market_requirements_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_state_required boolean;
  v_tz_required boolean;
BEGIN
  SELECT bool_or(m.state_province_required), bool_or(m.provider_timezone_required)
  INTO v_state_required, v_tz_required
  FROM public.markets m
  WHERE m.id = NEW.market_id;

  IF coalesce(v_state_required, false)
     AND nullif(trim(coalesce(NEW.state_province, '')), '') IS NULL THEN
    RAISE EXCEPTION 'STATE_PROVINCE_REQUIRED_FOR_MARKET';
  END IF;

  IF coalesce(v_tz_required, false)
     AND nullif(trim(coalesce(NEW.billing_timezone, '')), '') IS NULL THEN
    RAISE EXCEPTION 'PROVIDER_TIMEZONE_REQUIRED_FOR_MARKET';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_billing_profiles_market_requirements
  ON public.organization_billing_profiles;
CREATE TRIGGER organization_billing_profiles_market_requirements
  BEFORE INSERT OR UPDATE ON public.organization_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_profile_market_requirements_guard();

-- ---------------------------------------------------------------------------
-- 3) Company tax/billing profile (companies, additivt).
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS tax_id_status text NOT NULL DEFAULT 'not_provided',
  ADD COLUMN IF NOT EXISTS reverse_charge boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_exempt_reason text,
  ADD COLUMN IF NOT EXISTS state_province text;

ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_tax_id_status_chk;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_tax_id_status_chk CHECK (
    tax_id_status IN ('not_provided', 'format_valid', 'verified', 'invalid')
  );

COMMENT ON COLUMN public.companies.tax_id IS
  'Company tax/VAT ID (generalizes Norwegian orgnr for global markets). Validation strategy comes from the market, never from language.';
COMMENT ON COLUMN public.companies.reverse_charge IS
  'True only when the market supports reverse charge AND the buyer qualifies. Invoice renders the mandatory reverse-charge note.';

-- ---------------------------------------------------------------------------
-- 4) Market approval registry — eierstyrt aktivering (fail-closed).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_approvals (
  country_code text PRIMARY KEY CHECK (country_code ~ '^[A-Z]{2}$'),
  status text NOT NULL DEFAULT 'TECHNICALLY_READY' CHECK (
    status IN (
      'TECHNICALLY_READY',
      'TAX_REVIEW_PENDING',
      'TAX_APPROVED',
      'LEGAL_REVIEW_PENDING',
      'LEGAL_APPROVED',
      'ACTIVATION_BLOCKED',
      'ACTIVE'
    )
  ),
  tax_approved_by uuid,
  tax_approved_at timestamptz,
  legal_approved_by uuid,
  legal_approved_at timestamptz,
  activated_by uuid,
  activated_at timestamptz,
  blocked_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.market_approvals IS
  'Owner-controlled market activation registry. A market may NEVER invoice without status=ACTIVE, and ACTIVE requires recorded tax AND legal approval. Fail-closed.';

ALTER TABLE public.market_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_approvals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.market_approvals TO authenticated;
GRANT ALL ON TABLE public.market_approvals TO service_role;

DROP POLICY IF EXISTS market_approvals_platform_admin_read ON public.market_approvals;
CREATE POLICY market_approvals_platform_admin_read
  ON public.market_approvals FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- Append-only hendelseslogg for godkjenninger.
CREATE TABLE IF NOT EXISTS public.market_approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  reason text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.market_approval_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_approval_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.market_approval_events TO authenticated;
GRANT ALL ON TABLE public.market_approval_events TO service_role;

DROP POLICY IF EXISTS market_approval_events_platform_admin_read ON public.market_approval_events;
CREATE POLICY market_approval_events_platform_admin_read
  ON public.market_approval_events FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- Seed: alle 21 land starter TECHNICALLY_READY.
INSERT INTO public.market_approvals (country_code, status)
SELECT unnest(ARRAY['NO','SE','DK','FI','GB','DE','FR','ES','IT','NL','BE','CH','AT','IE','PL','RO','CZ','PT','GR','US','CA']), 'TECHNICALLY_READY'
ON CONFLICT (country_code) DO NOTHING;

-- Norge er levende produksjonsmarked (RC) med eier-godkjent MVA-sats i drift:
-- registreres eksplisitt som ACTIVE med godkjenningsspor (aldri implisitt).
UPDATE public.market_approvals
SET status = 'ACTIVE',
    tax_approved_at = coalesce(tax_approved_at, now()),
    legal_approved_at = coalesce(legal_approved_at, now()),
    activated_at = coalesce(activated_at, now()),
    notes = coalesce(notes, 'Produksjonsmarked (RC): eier-godkjent norsk MVA-konfigurasjon i drift.'),
    updated_at = now()
WHERE country_code = 'NO' AND status = 'TECHNICALLY_READY';

INSERT INTO public.market_approval_events (country_code, from_status, to_status, reason)
SELECT 'NO', 'TECHNICALLY_READY', 'ACTIVE', 'Seed: levende produksjonsmarked med eier-godkjent skattekonfigurasjon.'
WHERE NOT EXISTS (SELECT 1 FROM public.market_approval_events WHERE country_code = 'NO');

-- ---------------------------------------------------------------------------
-- 5) Statusmaskin-RPC (service_role only; eksplisitte overganger).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_market_approval_transition(
  p_country_code text,
  p_new_status text,
  p_reason text DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'pg_temp'
AS $$
DECLARE
  v_row public.market_approvals%rowtype;
  v_country text := upper(trim(coalesce(p_country_code, '')));
  v_new text := upper(trim(coalesce(p_new_status, '')));
  v_allowed boolean := false;
  v_market_complete boolean;
BEGIN
  SELECT * INTO v_row FROM public.market_approvals WHERE country_code = v_country FOR UPDATE;
  IF v_row.country_code IS NULL THEN
    RAISE EXCEPTION 'MARKET_APPROVAL_NOT_FOUND' USING errcode = 'P0002';
  END IF;

  IF v_new = v_row.status THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'status', v_row.status);
  END IF;

  -- Eksplisitt overgangsmatrise (fail-closed: alt annet avvises).
  v_allowed := CASE
    WHEN v_row.status = 'TECHNICALLY_READY'  AND v_new IN ('TAX_REVIEW_PENDING', 'ACTIVATION_BLOCKED') THEN true
    WHEN v_row.status = 'TAX_REVIEW_PENDING' AND v_new IN ('TAX_APPROVED', 'ACTIVATION_BLOCKED') THEN true
    WHEN v_row.status = 'TAX_APPROVED'       AND v_new IN ('LEGAL_REVIEW_PENDING', 'ACTIVATION_BLOCKED') THEN true
    WHEN v_row.status = 'LEGAL_REVIEW_PENDING' AND v_new IN ('LEGAL_APPROVED', 'ACTIVATION_BLOCKED') THEN true
    WHEN v_row.status = 'LEGAL_APPROVED'     AND v_new IN ('ACTIVE', 'ACTIVATION_BLOCKED') THEN true
    WHEN v_row.status = 'ACTIVE'             AND v_new = 'ACTIVATION_BLOCKED' THEN true
    WHEN v_row.status = 'ACTIVATION_BLOCKED' AND v_new = 'TECHNICALLY_READY' THEN true
    ELSE false
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'MARKET_APPROVAL_TRANSITION_INVALID: % -> %', v_row.status, v_new USING errcode = 'P0001';
  END IF;

  IF v_new = 'ACTIVATION_BLOCKED' AND nullif(trim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'BLOCK_REASON_REQUIRED' USING errcode = 'P0001';
  END IF;

  -- ACTIVE krever registrert skatte- OG legal-godkjenning + komplett markedskonfig.
  IF v_new = 'ACTIVE' THEN
    IF v_row.tax_approved_at IS NULL OR v_row.legal_approved_at IS NULL THEN
      RAISE EXCEPTION 'MARKET_ACTIVATION_REQUIRES_APPROVALS' USING errcode = 'P0001';
    END IF;

    SELECT bool_and(
      m.default_currency IS NOT NULL
      AND m.default_timezone IS NOT NULL
      AND m.vat_rate_food IS NOT NULL
      AND m.invoice_language IS NOT NULL
      AND m.tax_strategy IS NOT NULL
      AND m.tax_id_validation IS NOT NULL
      AND m.postal_code_pattern IS NOT NULL
      AND m.address_format IS NOT NULL
      AND jsonb_array_length(m.invoice_legal_fields) > 0
    ) INTO v_market_complete
    FROM public.markets m
    WHERE m.country_code = v_country AND m.is_active = true;

    IF NOT coalesce(v_market_complete, false) THEN
      RAISE EXCEPTION 'MARKET_CONFIG_INCOMPLETE' USING errcode = 'P0001';
    END IF;
  END IF;

  UPDATE public.market_approvals
  SET status = v_new,
      tax_approved_by = CASE WHEN v_new = 'TAX_APPROVED' THEN p_actor_user_id ELSE tax_approved_by END,
      tax_approved_at = CASE WHEN v_new = 'TAX_APPROVED' THEN now() ELSE tax_approved_at END,
      legal_approved_by = CASE WHEN v_new = 'LEGAL_APPROVED' THEN p_actor_user_id ELSE legal_approved_by END,
      legal_approved_at = CASE WHEN v_new = 'LEGAL_APPROVED' THEN now() ELSE legal_approved_at END,
      activated_by = CASE WHEN v_new = 'ACTIVE' THEN p_actor_user_id ELSE activated_by END,
      activated_at = CASE WHEN v_new = 'ACTIVE' THEN now() ELSE activated_at END,
      blocked_reason = CASE WHEN v_new = 'ACTIVATION_BLOCKED' THEN trim(p_reason) ELSE NULL END,
      updated_at = now()
  WHERE country_code = v_country;

  INSERT INTO public.market_approval_events (country_code, from_status, to_status, reason, actor_user_id)
  VALUES (v_country, v_row.status, v_new, nullif(trim(coalesce(p_reason, '')), ''), p_actor_user_id);

  RETURN jsonb_build_object('ok', true, 'idempotent', false, 'from', v_row.status, 'status', v_new);
END;
$$;

REVOKE ALL ON FUNCTION public.lp_market_approval_transition(text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lp_market_approval_transition(text, text, text, uuid) TO service_role, postgres;

-- ---------------------------------------------------------------------------
-- 6) Fail-closed fakturagate: ALDRI faktura i marked uten ACTIVE godkjenning.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_market_commercially_active(p_country_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.market_approvals ma
    WHERE ma.country_code = upper(trim(coalesce(p_country_code, '')))
      AND ma.status = 'ACTIVE'
  );
$$;

GRANT EXECUTE ON FUNCTION public.lp_market_commercially_active(text) TO authenticated, service_role;

-- Vokter på fakturaopprettelse. Krediteringsdokumenter (retter eksisterende
-- fakturaer) er alltid tillatt — nye salgsfakturaer krever ACTIVE marked.
CREATE OR REPLACE FUNCTION public.lp_invoice_market_activation_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_country text;
BEGIN
  IF TG_TABLE_NAME = 'agreement_invoices' AND NEW.kind IS DISTINCT FROM 'INVOICE' THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'provider_commission_invoices' AND NEW.kind IS DISTINCT FROM 'COMMISSION' THEN
    RETURN NEW;
  END IF;

  SELECT m.country_code INTO v_country
  FROM public.organization_billing_profiles obp
  JOIN public.markets m ON m.id = obp.market_id
  WHERE obp.organization_id = NEW.provider_id;

  IF v_country IS NULL THEN
    RAISE EXCEPTION 'BILLING_PROFILE_MISSING_FOR_INVOICE';
  END IF;

  IF NOT public.lp_market_commercially_active(v_country) THEN
    RAISE EXCEPTION 'MARKET_NOT_COMMERCIALLY_APPROVED: %', v_country;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agreement_invoices_market_activation_guard ON public.agreement_invoices;
CREATE TRIGGER agreement_invoices_market_activation_guard
  BEFORE INSERT ON public.agreement_invoices
  FOR EACH ROW EXECUTE FUNCTION public.lp_invoice_market_activation_guard();

DROP TRIGGER IF EXISTS provider_commission_invoices_market_activation_guard ON public.provider_commission_invoices;
CREATE TRIGGER provider_commission_invoices_market_activation_guard
  BEFORE INSERT ON public.provider_commission_invoices
  FOR EACH ROW EXECUTE FUNCTION public.lp_invoice_market_activation_guard();

COMMIT;
