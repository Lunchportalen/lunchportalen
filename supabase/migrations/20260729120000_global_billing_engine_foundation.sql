-- Global billing engine foundation (additive, no runtime cutover).
-- Scope:
--   - explicit market registry (locale/country/currency/tax/timezone/slug separated)
--   - provider billing profiles and payment-method metadata (no raw card data)
--   - immutable order-line commercial snapshots (not wired to lp_order_set)
--   - versioned commission rules, append-only ledger, period close, invoice snapshots
--   - RLS and service/provider/superadmin access contracts
--
-- Protected Golden Path impact: schema + opt-in RPCs only. No trigger on orders,
-- no change to lp_order_set, menu publish, week API, cutoff, or provider status flow.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Shared helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_billing_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_billing_is_provider_admin(p_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT public.is_platform_admin()
    OR EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.provider_id = p_provider_id
        AND pm.role = 'provider_admin'::public.provider_role
    );
$$;

CREATE OR REPLACE FUNCTION public.lp_billing_can_access_provider(p_provider_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT public.is_platform_admin() OR public.can_access_provider(p_provider_id);
$$;

-- ---------------------------------------------------------------------------
-- 1) Markets (language/slug is not legal/tax country)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  locale text NOT NULL,
  slug text NOT NULL,
  default_currency text NOT NULL,
  default_timezone text NOT NULL,
  tax_country_code text NOT NULL,
  default_language text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT markets_country_code_chk CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT markets_tax_country_code_chk CHECK (tax_country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT markets_locale_chk CHECK (locale ~ '^[a-z]{2}-[A-Z]{2}$'),
  CONSTRAINT markets_currency_chk CHECK (default_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT markets_slug_chk CHECK (slug ~ '^[a-z0-9][a-z0-9_]*[a-z0-9]$'),
  CONSTRAINT markets_default_language_chk CHECK (default_language ~ '^[a-z]{2}$'),
  CONSTRAINT markets_locale_slug_uniq UNIQUE (locale, slug),
  CONSTRAINT markets_slug_uniq UNIQUE (slug)
);

COMMENT ON TABLE public.markets IS
  'Global market registry. Separates locale/public slug from legal country, tax country, currency, and timezone.';

CREATE INDEX IF NOT EXISTS markets_country_code_idx ON public.markets (country_code);
CREATE INDEX IF NOT EXISTS markets_tax_country_code_idx ON public.markets (tax_country_code);
CREATE INDEX IF NOT EXISTS markets_active_idx ON public.markets (is_active, default_currency);

DROP TRIGGER IF EXISTS markets_set_updated_at ON public.markets;
CREATE TRIGGER markets_set_updated_at
  BEFORE UPDATE ON public.markets
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_set_updated_at();

INSERT INTO public.markets (
  country_code, locale, slug, default_currency, default_timezone,
  tax_country_code, default_language, is_active
)
VALUES
  ('US', 'en-US', 'us_office_lunch', 'USD', 'America/New_York', 'US', 'en', false),
  ('CA', 'en-CA', 'canadian_office_lunch', 'CAD', 'America/Toronto', 'CA', 'en', false),
  ('NL', 'nl-NL', 'dutch_office_lunch', 'EUR', 'Europe/Amsterdam', 'NL', 'nl', false),
  ('BE', 'nl-BE', 'belgian_dutch_office_lunch', 'EUR', 'Europe/Brussels', 'BE', 'nl', false),
  ('BE', 'fr-BE', 'belgian_french_office_lunch', 'EUR', 'Europe/Brussels', 'BE', 'fr', false),
  ('AT', 'de-AT', 'austrian_office_lunch', 'EUR', 'Europe/Vienna', 'AT', 'de', false),
  ('CH', 'de-CH', 'swiss_german_office_lunch', 'CHF', 'Europe/Zurich', 'CH', 'de', false),
  ('CH', 'fr-CH', 'swiss_french_office_lunch', 'CHF', 'Europe/Zurich', 'CH', 'fr', false),
  ('IE', 'en-IE', 'irish_office_lunch', 'EUR', 'Europe/Dublin', 'IE', 'en', false),
  ('LU', 'fr-LU', 'luxembourg_office_lunch', 'EUR', 'Europe/Luxembourg', 'LU', 'fr', false),
  ('AU', 'en-AU', 'australian_office_lunch', 'AUD', 'Australia/Sydney', 'AU', 'en', false),
  ('SG', 'en-SG', 'singapore_office_lunch', 'SGD', 'Asia/Singapore', 'SG', 'en', false),
  ('NO', 'nb-NO', 'norwegian_office_lunch', 'NOK', 'Europe/Oslo', 'NO', 'nb', true),
  ('SE', 'sv-SE', 'swedish_office_lunch', 'SEK', 'Europe/Stockholm', 'SE', 'sv', false),
  ('DK', 'da-DK', 'danish_office_lunch', 'DKK', 'Europe/Copenhagen', 'DK', 'da', false),
  ('FI', 'fi-FI', 'finnish_office_lunch', 'EUR', 'Europe/Helsinki', 'FI', 'fi', false),
  ('GB', 'en-GB', 'uk_office_lunch', 'GBP', 'Europe/London', 'GB', 'en', false),
  ('DE', 'de-DE', 'german_office_lunch', 'EUR', 'Europe/Berlin', 'DE', 'de', false),
  ('FR', 'fr-FR', 'french_office_lunch', 'EUR', 'Europe/Paris', 'FR', 'fr', false),
  ('ES', 'es-ES', 'spanish_office_lunch', 'EUR', 'Europe/Madrid', 'ES', 'es', false),
  ('IT', 'it-IT', 'italian_office_lunch', 'EUR', 'Europe/Rome', 'IT', 'it', false)
ON CONFLICT (locale, slug) DO UPDATE SET
  country_code = EXCLUDED.country_code,
  default_currency = EXCLUDED.default_currency,
  default_timezone = EXCLUDED.default_timezone,
  tax_country_code = EXCLUDED.tax_country_code,
  default_language = EXCLUDED.default_language,
  is_active = public.markets.is_active OR EXCLUDED.is_active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 2) Provider billing profile + payment metadata
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organization_billing_profiles (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.markets (id),
  legal_name text NOT NULL,
  legal_country_code text NOT NULL,
  tax_country_code text NOT NULL,
  billing_currency text NOT NULL,
  billing_timezone text NOT NULL,
  billing_email_current text NULL,
  billing_email_updated_by_user_id uuid NULL REFERENCES auth.users (id),
  billing_email_updated_at timestamptz NULL,
  payment_provider text NULL,
  payment_provider_customer_id text NULL,
  default_payment_method_id uuid NULL,
  tax_registration_id text NULL,
  tax_registration_status text NOT NULL DEFAULT 'not_provided',
  billing_status text NOT NULL DEFAULT 'setup_required',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organization_billing_profiles_legal_country_chk CHECK (legal_country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT organization_billing_profiles_tax_country_chk CHECK (tax_country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT organization_billing_profiles_currency_chk CHECK (billing_currency ~ '^[A-Z]{3}$'),
  CONSTRAINT organization_billing_profiles_email_chk CHECK (
    billing_email_current IS NULL
    OR billing_email_current ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  CONSTRAINT organization_billing_profiles_tax_status_chk CHECK (
    tax_registration_status IN ('not_provided', 'pending', 'verified', 'rejected')
  ),
  CONSTRAINT organization_billing_profiles_status_chk CHECK (
    billing_status IN ('setup_required', 'active', 'payment_failed', 'suspended', 'closed')
  )
);

COMMENT ON TABLE public.organization_billing_profiles IS
  'Provider billing profile: legal/tax/currency/timezone/payment references. No raw card data.';

CREATE INDEX IF NOT EXISTS organization_billing_profiles_market_idx
  ON public.organization_billing_profiles (market_id);
CREATE INDEX IF NOT EXISTS organization_billing_profiles_status_idx
  ON public.organization_billing_profiles (billing_status);

DROP TRIGGER IF EXISTS organization_billing_profiles_set_updated_at ON public.organization_billing_profiles;
CREATE TRIGGER organization_billing_profiles_set_updated_at
  BEFORE UPDATE ON public.organization_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_set_updated_at();

CREATE OR REPLACE FUNCTION public.lp_billing_assert_provider_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_type public.org_type;
BEGIN
  SELECT o.type INTO v_type
  FROM public.organizations o
  WHERE o.id = NEW.organization_id;

  IF v_type IS DISTINCT FROM 'provider'::public.org_type THEN
    RAISE EXCEPTION 'organization_billing_profiles requires provider organization, got %', NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_billing_profiles_assert_provider_org
  ON public.organization_billing_profiles;
CREATE TRIGGER organization_billing_profiles_assert_provider_org
  BEFORE INSERT OR UPDATE OF organization_id ON public.organization_billing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_assert_provider_org();

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_payment_method_id text NOT NULL,
  brand text NOT NULL,
  last4 text NOT NULL,
  exp_month integer NOT NULL,
  exp_year integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  replaced_at timestamptz NULL,
  CONSTRAINT payment_methods_provider_chk CHECK (provider IN ('stripe', 'adyen', 'nets', 'vipps', 'manual')),
  CONSTRAINT payment_methods_last4_chk CHECK (last4 ~ '^[0-9]{4}$'),
  CONSTRAINT payment_methods_exp_month_chk CHECK (exp_month BETWEEN 1 AND 12),
  CONSTRAINT payment_methods_exp_year_chk CHECK (exp_year BETWEEN 2024 AND 2100),
  CONSTRAINT payment_methods_status_chk CHECK (status IN ('active', 'replaced', 'expired', 'failed', 'detached')),
  CONSTRAINT payment_methods_provider_ref_uniq UNIQUE (provider, provider_payment_method_id)
);

COMMENT ON TABLE public.payment_methods IS
  'Payment-method metadata only. Raw card number, CVV, and provider payloads are forbidden.';

CREATE INDEX IF NOT EXISTS payment_methods_org_status_idx
  ON public.payment_methods (organization_id, status, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_billing_profiles_default_payment_method_fkey'
  ) THEN
    ALTER TABLE public.organization_billing_profiles
      ADD CONSTRAINT organization_billing_profiles_default_payment_method_fkey
      FOREIGN KEY (default_payment_method_id) REFERENCES public.payment_methods (id);
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3) Order-line commercial snapshots (opt-in, immutable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_line_commercial_snapshots (
  order_line_id uuid PRIMARY KEY REFERENCES public.order_items (id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  market_id uuid NULL REFERENCES public.markets (id),
  locale text NOT NULL,
  country_code text NOT NULL,
  tax_country_code text NOT NULL,
  menu_item_id uuid NULL,
  title_snapshot text NOT NULL,
  quantity integer NOT NULL,
  unit_price_gross_minor integer NOT NULL,
  unit_price_net_minor integer NOT NULL,
  tax_amount_minor integer NOT NULL,
  tax_rate_snapshot numeric(8, 6) NOT NULL,
  tax_included boolean NOT NULL DEFAULT false,
  currency text NOT NULL,
  ordered_at timestamptz NOT NULL,
  commission_rule_id uuid NOT NULL,
  commission_rate_bps integer NOT NULL,
  commission_basis_amount_minor integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_line_snapshots_locale_chk CHECK (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  CONSTRAINT order_line_snapshots_country_chk CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT order_line_snapshots_tax_country_chk CHECK (tax_country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT order_line_snapshots_currency_chk CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT order_line_snapshots_quantity_chk CHECK (quantity > 0),
  CONSTRAINT order_line_snapshots_money_chk CHECK (
    unit_price_gross_minor >= 0
    AND unit_price_net_minor >= 0
    AND tax_amount_minor >= 0
    AND commission_basis_amount_minor >= 0
  ),
  CONSTRAINT order_line_snapshots_tax_rate_chk CHECK (tax_rate_snapshot >= 0 AND tax_rate_snapshot <= 1),
  CONSTRAINT order_line_snapshots_commission_rate_chk CHECK (commission_rate_bps >= 0 AND commission_rate_bps <= 10000)
);

COMMENT ON TABLE public.order_line_commercial_snapshots IS
  'Immutable commercial truth for commission. Created from order_items snapshots; never from current menu price.';

CREATE INDEX IF NOT EXISTS order_line_snapshots_order_idx
  ON public.order_line_commercial_snapshots (order_id);
CREATE INDEX IF NOT EXISTS order_line_snapshots_provider_currency_idx
  ON public.order_line_commercial_snapshots (provider_id, currency, ordered_at);

CREATE OR REPLACE FUNCTION public.lp_billing_prevent_order_line_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  RAISE EXCEPTION 'order_line_commercial_snapshots is append-only; create a correction ledger event instead';
END;
$$;

DROP TRIGGER IF EXISTS order_line_snapshots_no_update ON public.order_line_commercial_snapshots;
CREATE TRIGGER order_line_snapshots_no_update
  BEFORE UPDATE ON public.order_line_commercial_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_prevent_order_line_snapshot_mutation();

DROP TRIGGER IF EXISTS order_line_snapshots_no_delete ON public.order_line_commercial_snapshots;
CREATE TRIGGER order_line_snapshots_no_delete
  BEFORE DELETE ON public.order_line_commercial_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_prevent_order_line_snapshot_mutation();

-- ---------------------------------------------------------------------------
-- 4) Commission rules, ledger, periods, invoices, deliveries, audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  version integer NOT NULL,
  rate_bps integer NOT NULL,
  basis text NOT NULL,
  applies_to text NOT NULL,
  active_from timestamptz NOT NULL DEFAULT now(),
  active_to timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_rules_code_version_uniq UNIQUE (code, version),
  CONSTRAINT commission_rules_code_chk CHECK (code ~ '^[A-Z0-9_]+$'),
  CONSTRAINT commission_rules_version_chk CHECK (version > 0),
  CONSTRAINT commission_rules_rate_chk CHECK (rate_bps >= 0 AND rate_bps <= 10000),
  CONSTRAINT commission_rules_basis_chk CHECK (basis IN ('NET_LUNCH_MENU_SALES_EX_TAX')),
  CONSTRAINT commission_rules_applies_to_chk CHECK (applies_to IN ('COMPLETED_LUNCH_ORDERS')),
  CONSTRAINT commission_rules_active_range_chk CHECK (active_to IS NULL OR active_to > active_from)
);

COMMENT ON TABLE public.commission_rules IS
  'Versioned commission policy. Default Lunchportalen rule is 5 percent of net lunch sales ex tax.';

INSERT INTO public.commission_rules (code, version, rate_bps, basis, applies_to, active_from)
VALUES ('LP_GLOBAL_5P', 1, 500, 'NET_LUNCH_MENU_SALES_EX_TAX', 'COMPLETED_LUNCH_ORDERS', '2026-01-01T00:00:00Z')
ON CONFLICT (code, version) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_line_snapshots_commission_rule_id_fkey'
  ) THEN
    ALTER TABLE public.order_line_commercial_snapshots
      ADD CONSTRAINT order_line_snapshots_commission_rule_id_fkey
      FOREIGN KEY (commission_rule_id) REFERENCES public.commission_rules (id);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.commission_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  order_id uuid NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  order_line_id uuid NULL REFERENCES public.order_items (id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  commission_rule_id uuid NOT NULL REFERENCES public.commission_rules (id),
  commission_rate_bps integer NOT NULL,
  market_id uuid NULL REFERENCES public.markets (id),
  country_code text NOT NULL,
  tax_country_code text NOT NULL,
  currency text NOT NULL,
  commission_basis_amount_minor integer NOT NULL,
  commission_amount_exact numeric(20, 6) NOT NULL,
  billing_period text NULL,
  idempotency_key text NOT NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users (id),
  CONSTRAINT commission_ledger_event_type_chk CHECK (
    event_type IN (
      'ORDER_COMPLETED',
      'ORDER_CANCELLED',
      'ORDER_REFUNDED',
      'ORDER_CORRECTED',
      'MANUAL_ADJUSTMENT',
      'ROUNDING_ADJUSTMENT',
      'CREDIT_NOTE'
    )
  ),
  CONSTRAINT commission_ledger_rate_chk CHECK (commission_rate_bps >= 0 AND commission_rate_bps <= 10000),
  CONSTRAINT commission_ledger_country_chk CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT commission_ledger_tax_country_chk CHECK (tax_country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT commission_ledger_currency_chk CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT commission_ledger_manual_reason_chk CHECK (
    event_type <> 'MANUAL_ADJUSTMENT'
    OR nullif(trim(coalesce(reason, '')), '') IS NOT NULL
  ),
  CONSTRAINT commission_ledger_idempotency_key_uniq UNIQUE (idempotency_key)
);

COMMENT ON TABLE public.commission_ledger IS
  'Append-only commission ledger. Corrections are new events; historical rows are never updated or deleted.';

CREATE INDEX IF NOT EXISTS commission_ledger_provider_currency_created_idx
  ON public.commission_ledger (provider_id, currency, created_at);
CREATE INDEX IF NOT EXISTS commission_ledger_order_idx
  ON public.commission_ledger (order_id, order_line_id)
  WHERE order_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.lp_billing_prevent_commission_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  RAISE EXCEPTION 'commission_ledger is append-only; write a correction event instead';
END;
$$;

DROP TRIGGER IF EXISTS commission_ledger_no_update ON public.commission_ledger;
CREATE TRIGGER commission_ledger_no_update
  BEFORE UPDATE ON public.commission_ledger
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_prevent_commission_ledger_mutation();

DROP TRIGGER IF EXISTS commission_ledger_no_delete ON public.commission_ledger;
CREATE TRIGGER commission_ledger_no_delete
  BEFORE DELETE ON public.commission_ledger
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_prevent_commission_ledger_mutation();

CREATE TABLE IF NOT EXISTS public.commission_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  period_start date NOT NULL,
  period_end date NOT NULL,
  billing_timezone text NOT NULL,
  currency text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  total_basis_amount_minor bigint NOT NULL DEFAULT 0,
  total_commission_exact numeric(20, 6) NOT NULL DEFAULT 0,
  rounded_commission_minor bigint NOT NULL DEFAULT 0,
  rounding_adjustment_minor bigint NOT NULL DEFAULT 0,
  closed_at timestamptz NULL,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_periods_range_chk CHECK (period_end > period_start),
  CONSTRAINT commission_periods_currency_chk CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT commission_periods_status_chk CHECK (status IN ('open', 'closing', 'closed', 'invoiced', 'paid', 'failed')),
  CONSTRAINT commission_periods_provider_period_currency_uniq UNIQUE (provider_id, period_start, period_end, currency),
  CONSTRAINT commission_periods_idempotency_key_uniq UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS commission_periods_provider_status_idx
  ON public.commission_periods (provider_id, status, period_start DESC);

DROP TRIGGER IF EXISTS commission_periods_set_updated_at ON public.commission_periods;
CREATE TRIGGER commission_periods_set_updated_at
  BEFORE UPDATE ON public.commission_periods
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_set_updated_at();

CREATE TABLE IF NOT EXISTS public.provider_commission_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  commission_period_id uuid NOT NULL REFERENCES public.commission_periods (id) ON DELETE RESTRICT,
  invoice_number text NULL,
  payment_provider_invoice_id text NULL,
  payment_provider_payment_intent_id text NULL,
  amount_ex_tax_minor bigint NOT NULL,
  tax_amount_minor bigint NOT NULL DEFAULT 0,
  total_amount_minor bigint NOT NULL,
  currency text NOT NULL,
  billing_email_snapshot text NULL,
  admin_email_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  sent_to_emails_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  invoice_pdf_url text NULL,
  hosted_invoice_url text NULL,
  payment_status text NOT NULL DEFAULT 'pending',
  issued_at timestamptz NULL,
  paid_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_commission_invoices_period_uniq UNIQUE (commission_period_id),
  CONSTRAINT provider_commission_invoices_invoice_number_uniq UNIQUE (invoice_number),
  CONSTRAINT provider_commission_invoices_currency_chk CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT provider_commission_invoices_amount_chk CHECK (
    amount_ex_tax_minor >= 0 AND tax_amount_minor >= 0 AND total_amount_minor >= 0
  ),
  CONSTRAINT provider_commission_invoices_payment_status_chk CHECK (
    payment_status IN ('draft', 'pending', 'processing', 'paid', 'failed', 'action_required', 'void')
  ),
  CONSTRAINT provider_commission_invoices_admin_snapshot_chk CHECK (jsonb_typeof(admin_email_snapshot) = 'array'),
  CONSTRAINT provider_commission_invoices_sent_snapshot_chk CHECK (jsonb_typeof(sent_to_emails_snapshot) = 'array'),
  CONSTRAINT provider_commission_invoices_recipient_snapshot_nonempty_chk CHECK (
    jsonb_array_length(sent_to_emails_snapshot) > 0
  )
);

COMMENT ON TABLE public.provider_commission_invoices IS
  'Commission invoices/bilag with immutable recipient snapshots. Existing provider_invoices remains SaaS invoice track.';

CREATE INDEX IF NOT EXISTS provider_commission_invoices_provider_status_idx
  ON public.provider_commission_invoices (provider_id, payment_status, created_at DESC);

DROP TRIGGER IF EXISTS provider_commission_invoices_set_updated_at ON public.provider_commission_invoices;
CREATE TRIGGER provider_commission_invoices_set_updated_at
  BEFORE UPDATE ON public.provider_commission_invoices
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_set_updated_at();

CREATE OR REPLACE FUNCTION public.lp_billing_guard_provider_commission_invoice_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  IF OLD.provider_id IS DISTINCT FROM NEW.provider_id
     OR OLD.organization_id IS DISTINCT FROM NEW.organization_id
     OR OLD.commission_period_id IS DISTINCT FROM NEW.commission_period_id
     OR OLD.amount_ex_tax_minor IS DISTINCT FROM NEW.amount_ex_tax_minor
     OR OLD.tax_amount_minor IS DISTINCT FROM NEW.tax_amount_minor
     OR OLD.total_amount_minor IS DISTINCT FROM NEW.total_amount_minor
     OR OLD.currency IS DISTINCT FROM NEW.currency
     OR OLD.billing_email_snapshot IS DISTINCT FROM NEW.billing_email_snapshot
     OR OLD.admin_email_snapshot IS DISTINCT FROM NEW.admin_email_snapshot
     OR OLD.sent_to_emails_snapshot IS DISTINCT FROM NEW.sent_to_emails_snapshot
     OR OLD.issued_at IS DISTINCT FROM NEW.issued_at
  THEN
    RAISE EXCEPTION 'provider_commission_invoices immutable invoice facts cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provider_commission_invoices_guard_immutable_update
  ON public.provider_commission_invoices;
CREATE TRIGGER provider_commission_invoices_guard_immutable_update
  BEFORE UPDATE ON public.provider_commission_invoices
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_guard_provider_commission_invoice_update();

CREATE TABLE IF NOT EXISTS public.invoice_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.provider_commission_invoices (id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_type text NOT NULL,
  delivery_status text NOT NULL DEFAULT 'queued',
  provider_message_id text NULL,
  sent_at timestamptz NULL,
  delivered_at timestamptz NULL,
  failed_at timestamptz NULL,
  failed_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_deliveries_email_chk CHECK (recipient_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT invoice_deliveries_recipient_type_chk CHECK (
    recipient_type IN ('billing_email', 'admin', 'owner', 'billing_admin', 'accountant')
  ),
  CONSTRAINT invoice_deliveries_status_chk CHECK (
    delivery_status IN ('queued', 'pending', 'sent', 'delivered', 'failed', 'bounced', 'skipped')
  ),
  CONSTRAINT invoice_deliveries_invoice_recipient_uniq UNIQUE (invoice_id, recipient_email, recipient_type)
);

CREATE INDEX IF NOT EXISTS invoice_deliveries_invoice_status_idx
  ON public.invoice_deliveries (invoice_id, delivery_status);

DROP TRIGGER IF EXISTS invoice_deliveries_set_updated_at ON public.invoice_deliveries;
CREATE TRIGGER invoice_deliveries_set_updated_at
  BEFORE UPDATE ON public.invoice_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_set_updated_at();

CREATE TABLE IF NOT EXISTS public.billing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  actor_user_id uuid NULL REFERENCES auth.users (id),
  action text NOT NULL,
  before_json jsonb NULL,
  after_json jsonb NULL,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_audit_log_action_chk CHECK (char_length(trim(action)) BETWEEN 3 AND 128)
);

COMMENT ON TABLE public.billing_audit_log IS
  'Append-only audit log for billing email/payment/ledger/period/invoice/payment events.';

CREATE INDEX IF NOT EXISTS billing_audit_log_org_created_idx
  ON public.billing_audit_log (organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.lp_billing_prevent_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  RAISE EXCEPTION 'billing_audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS billing_audit_log_no_update ON public.billing_audit_log;
CREATE TRIGGER billing_audit_log_no_update
  BEFORE UPDATE ON public.billing_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_prevent_audit_mutation();

DROP TRIGGER IF EXISTS billing_audit_log_no_delete ON public.billing_audit_log;
CREATE TRIGGER billing_audit_log_no_delete
  BEFORE DELETE ON public.billing_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.lp_billing_prevent_audit_mutation();

-- ---------------------------------------------------------------------------
-- 5) RPCs (opt-in; no automatic order-path wiring)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_provider_update_billing_email(
  p_organization_id uuid,
  p_billing_email text,
  p_reason text DEFAULT NULL
)
RETURNS public.organization_billing_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_before jsonb;
  v_row public.organization_billing_profiles;
  v_email text;
BEGIN
  IF NOT public.lp_billing_is_provider_admin(p_organization_id) THEN
    RAISE EXCEPTION 'BILLING_EMAIL_FORBIDDEN';
  END IF;

  v_email := lower(nullif(trim(coalesce(p_billing_email, '')), ''));
  IF v_email IS NOT NULL AND v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'BILLING_EMAIL_INVALID';
  END IF;

  SELECT to_jsonb(obp.*)
  INTO v_before
  FROM public.organization_billing_profiles obp
  WHERE obp.organization_id = p_organization_id
  FOR UPDATE;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'BILLING_PROFILE_NOT_FOUND';
  END IF;

  UPDATE public.organization_billing_profiles
  SET
    billing_email_current = v_email,
    billing_email_updated_by_user_id = auth.uid(),
    billing_email_updated_at = now()
  WHERE organization_id = p_organization_id
  RETURNING * INTO v_row;

  INSERT INTO public.billing_audit_log (
    organization_id, actor_user_id, action, before_json, after_json, reason
  )
  VALUES (
    p_organization_id,
    auth.uid(),
    'billing_email.changed',
    v_before,
    to_jsonb(v_row),
    p_reason
  );

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_billing_create_order_line_snapshot(
  p_order_line_id uuid,
  p_market_id uuid DEFAULT NULL
)
RETURNS public.order_line_commercial_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_rule public.commission_rules;
  v_row public.order_line_commercial_snapshots;
BEGIN
  IF NOT public.is_platform_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'ORDER_LINE_SNAPSHOT_FORBIDDEN';
  END IF;

  SELECT *
  INTO v_rule
  FROM public.commission_rules
  WHERE code = 'LP_GLOBAL_5P'
    AND version = 1
    AND active_to IS NULL
  LIMIT 1;

  IF v_rule.id IS NULL THEN
    RAISE EXCEPTION 'COMMISSION_RULE_NOT_FOUND';
  END IF;

  INSERT INTO public.order_line_commercial_snapshots (
    order_line_id,
    order_id,
    provider_id,
    organization_id,
    market_id,
    locale,
    country_code,
    tax_country_code,
    menu_item_id,
    title_snapshot,
    quantity,
    unit_price_gross_minor,
    unit_price_net_minor,
    tax_amount_minor,
    tax_rate_snapshot,
    tax_included,
    currency,
    ordered_at,
    commission_rule_id,
    commission_rate_bps,
    commission_basis_amount_minor
  )
  SELECT
    oi.id,
    o.id,
    o.provider_id,
    o.provider_id,
    coalesce(p_market_id, obp.market_id),
    m.locale,
    m.country_code,
    m.tax_country_code,
    oi.product_id,
    oi.product_name_snapshot,
    oi.quantity,
    round(oi.line_total_cents_inc_vat::numeric / greatest(oi.quantity, 1))::integer,
    oi.unit_price_cents_ex_vat,
    oi.line_vat_cents,
    oi.vat_rate_snapshot,
    false,
    coalesce(nullif(o.currency_code, ''), obp.billing_currency),
    o.created_at,
    v_rule.id,
    v_rule.rate_bps,
    oi.line_subtotal_cents_ex_vat
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.organization_billing_profiles obp ON obp.organization_id = o.provider_id
  JOIN public.markets m ON m.id = coalesce(p_market_id, obp.market_id)
  WHERE oi.id = p_order_line_id
  ON CONFLICT (order_line_id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.order_line_id IS NULL THEN
    SELECT *
    INTO v_row
    FROM public.order_line_commercial_snapshots
    WHERE order_line_id = p_order_line_id;
  END IF;

  IF v_row.order_line_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_LINE_NOT_FOUND_OR_NOT_SNAPSHOTABLE';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_billing_post_commission_for_order(
  p_order_id uuid,
  p_event_type text DEFAULT 'ORDER_COMPLETED',
  p_reason text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_order public.orders;
  v_item record;
  v_snapshot public.order_line_commercial_snapshots;
  v_sign integer := 1;
  v_inserted integer := 0;
  v_rows integer := 0;
BEGIN
  IF NOT public.is_platform_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'COMMISSION_POST_FORBIDDEN';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF p_event_type = 'ORDER_COMPLETED' AND v_order.status IS DISTINCT FROM 'DELIVERED'::public.order_status THEN
    RAISE EXCEPTION 'ORDER_NOT_DELIVERED';
  END IF;

  IF p_event_type NOT IN (
    'ORDER_COMPLETED',
    'ORDER_CANCELLED',
    'ORDER_REFUNDED',
    'ORDER_CORRECTED',
    'MANUAL_ADJUSTMENT',
    'ROUNDING_ADJUSTMENT',
    'CREDIT_NOTE'
  ) THEN
    RAISE EXCEPTION 'COMMISSION_EVENT_TYPE_INVALID';
  END IF;

  IF p_event_type = 'MANUAL_ADJUSTMENT'
     AND nullif(trim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'MANUAL_ADJUSTMENT_REASON_REQUIRED';
  END IF;

  IF p_event_type IN ('ORDER_CANCELLED', 'ORDER_REFUNDED', 'CREDIT_NOTE') THEN
    v_sign := -1;
  END IF;

  FOR v_item IN
    SELECT oi.id
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    SELECT public.lp_billing_create_order_line_snapshot(v_item.id, NULL)
    INTO v_snapshot;

    INSERT INTO public.commission_ledger (
      provider_id,
      organization_id,
      order_id,
      order_line_id,
      event_type,
      commission_rule_id,
      commission_rate_bps,
      market_id,
      country_code,
      tax_country_code,
      currency,
      commission_basis_amount_minor,
      commission_amount_exact,
      billing_period,
      idempotency_key,
      reason,
      created_by
    )
    VALUES (
      v_snapshot.provider_id,
      v_snapshot.organization_id,
      v_snapshot.order_id,
      v_snapshot.order_line_id,
      p_event_type,
      v_snapshot.commission_rule_id,
      v_snapshot.commission_rate_bps,
      v_snapshot.market_id,
      v_snapshot.country_code,
      v_snapshot.tax_country_code,
      v_snapshot.currency,
      v_sign * v_snapshot.commission_basis_amount_minor,
      (v_sign * v_snapshot.commission_basis_amount_minor::numeric * v_snapshot.commission_rate_bps::numeric) / 10000,
      (
        SELECT to_char(v_snapshot.ordered_at AT TIME ZONE obp.billing_timezone, 'YYYY-MM')
        FROM public.organization_billing_profiles obp
        WHERE obp.organization_id = v_snapshot.provider_id
      ),
      concat('commission:', p_event_type, ':', v_snapshot.order_id, ':', v_snapshot.order_line_id),
      p_reason,
      auth.uid()
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_inserted := v_inserted + v_rows;
  END LOOP;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_billing_close_commission_period(
  p_provider_id uuid,
  p_period_start date,
  p_period_end date,
  p_currency text,
  p_billing_timezone text DEFAULT NULL
)
RETURNS public.commission_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_profile public.organization_billing_profiles;
  v_row public.commission_periods;
  v_total_basis bigint;
  v_total_exact numeric(20, 6);
  v_rounded bigint;
  v_idem text;
  v_inserted boolean := false;
BEGIN
  IF NOT public.is_platform_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'COMMISSION_PERIOD_CLOSE_FORBIDDEN';
  END IF;

  IF p_period_end <= p_period_start THEN
    RAISE EXCEPTION 'COMMISSION_PERIOD_INVALID_RANGE';
  END IF;

  SELECT * INTO v_profile
  FROM public.organization_billing_profiles
  WHERE organization_id = p_provider_id;

  IF v_profile.organization_id IS NULL THEN
    RAISE EXCEPTION 'BILLING_PROFILE_NOT_FOUND';
  END IF;

  SELECT
    coalesce(sum(commission_basis_amount_minor), 0)::bigint,
    coalesce(sum(commission_amount_exact), 0)::numeric(20, 6)
  INTO v_total_basis, v_total_exact
  FROM public.commission_ledger cl
  WHERE cl.provider_id = p_provider_id
    AND cl.currency = upper(trim(p_currency))
    AND cl.billing_period = to_char(p_period_start, 'YYYY-MM');

  v_rounded := round(v_total_exact)::bigint;
  v_idem := concat('commission-period:', p_provider_id, ':', p_period_start, ':', p_period_end, ':', upper(trim(p_currency)));

  INSERT INTO public.commission_periods (
    provider_id,
    organization_id,
    period_start,
    period_end,
    billing_timezone,
    currency,
    status,
    total_basis_amount_minor,
    total_commission_exact,
    rounded_commission_minor,
    rounding_adjustment_minor,
    closed_at,
    idempotency_key
  )
  VALUES (
    p_provider_id,
    p_provider_id,
    p_period_start,
    p_period_end,
    coalesce(nullif(trim(p_billing_timezone), ''), v_profile.billing_timezone),
    upper(trim(p_currency)),
    'closed',
    v_total_basis,
    v_total_exact,
    v_rounded,
    v_rounded - trunc(v_total_exact)::bigint,
    now(),
    v_idem
  )
  ON CONFLICT (provider_id, period_start, period_end, currency) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NOT NULL THEN
    v_inserted := true;
  ELSE
    SELECT *
    INTO v_row
    FROM public.commission_periods
    WHERE provider_id = p_provider_id
      AND period_start = p_period_start
      AND period_end = p_period_end
      AND currency = upper(trim(p_currency));
  END IF;

  IF v_inserted THEN
    INSERT INTO public.billing_audit_log (organization_id, actor_user_id, action, after_json, reason)
    VALUES (p_provider_id, auth.uid(), 'commission_period.closed', to_jsonb(v_row), 'idempotent close');
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_billing_create_provider_commission_invoice(
  p_commission_period_id uuid
)
RETURNS public.provider_commission_invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_period public.commission_periods;
  v_profile public.organization_billing_profiles;
  v_billing_email text;
  v_admin_emails jsonb;
  v_sent jsonb;
  v_invoice public.provider_commission_invoices;
  v_email text;
  v_inserted boolean := false;
BEGIN
  IF NOT public.is_platform_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'COMMISSION_INVOICE_CREATE_FORBIDDEN';
  END IF;

  SELECT * INTO v_period
  FROM public.commission_periods
  WHERE id = p_commission_period_id
  FOR UPDATE;

  IF v_period.id IS NULL THEN
    RAISE EXCEPTION 'COMMISSION_PERIOD_NOT_FOUND';
  END IF;

  IF v_period.status NOT IN ('closed', 'invoiced') THEN
    RAISE EXCEPTION 'COMMISSION_PERIOD_NOT_CLOSED';
  END IF;

  SELECT * INTO v_profile
  FROM public.organization_billing_profiles
  WHERE organization_id = v_period.provider_id;

  IF v_profile.organization_id IS NULL THEN
    RAISE EXCEPTION 'BILLING_PROFILE_NOT_FOUND';
  END IF;

  v_billing_email := lower(nullif(trim(coalesce(v_profile.billing_email_current, '')), ''));

  SELECT coalesce(jsonb_agg(DISTINCT lower(u.email)) FILTER (WHERE u.email IS NOT NULL), '[]'::jsonb)
  INTO v_admin_emails
  FROM public.provider_memberships pm
  JOIN auth.users u ON u.id = pm.user_id
  WHERE pm.provider_id = v_period.provider_id
    AND pm.role = 'provider_admin'::public.provider_role
    AND u.email_confirmed_at IS NOT NULL;

  SELECT coalesce(jsonb_agg(DISTINCT email), '[]'::jsonb)
  INTO v_sent
  FROM (
    SELECT v_billing_email AS email
    WHERE v_billing_email IS NOT NULL
    UNION
    SELECT jsonb_array_elements_text(v_admin_emails) AS email
  ) s
  WHERE email IS NOT NULL;

  IF jsonb_array_length(v_sent) = 0 THEN
    RAISE EXCEPTION 'COMMISSION_INVOICE_NO_RECIPIENTS';
  END IF;

  INSERT INTO public.provider_commission_invoices (
    provider_id,
    organization_id,
    commission_period_id,
    amount_ex_tax_minor,
    tax_amount_minor,
    total_amount_minor,
    currency,
    billing_email_snapshot,
    admin_email_snapshot,
    sent_to_emails_snapshot,
    payment_status,
    issued_at
  )
  VALUES (
    v_period.provider_id,
    v_period.organization_id,
    v_period.id,
    v_period.rounded_commission_minor,
    0,
    v_period.rounded_commission_minor,
    v_period.currency,
    v_billing_email,
    v_admin_emails,
    v_sent,
    'pending',
    now()
  )
  ON CONFLICT (commission_period_id) DO NOTHING
  RETURNING * INTO v_invoice;

  IF v_invoice.id IS NOT NULL THEN
    v_inserted := true;
  ELSE
    SELECT *
    INTO v_invoice
    FROM public.provider_commission_invoices
    WHERE commission_period_id = v_period.id;
  END IF;

  IF v_inserted THEN
    UPDATE public.commission_periods
    SET status = 'invoiced'
    WHERE id = v_period.id
      AND status = 'closed';
  END IF;

  FOR v_email IN SELECT jsonb_array_elements_text(v_sent)
  LOOP
    INSERT INTO public.invoice_deliveries (
      invoice_id,
      recipient_email,
      recipient_type,
      delivery_status
    )
    VALUES (
      v_invoice.id,
      v_email,
      CASE WHEN v_email = v_billing_email THEN 'billing_email' ELSE 'admin' END,
      'queued'
    )
    ON CONFLICT (invoice_id, recipient_email, recipient_type) DO NOTHING;
  END LOOP;

  IF v_inserted THEN
    INSERT INTO public.billing_audit_log (organization_id, actor_user_id, action, after_json, reason)
    VALUES (v_period.provider_id, auth.uid(), 'provider_commission_invoice.created', to_jsonb(v_invoice), NULL);
  END IF;

  RETURN v_invoice;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6) RLS and grants
-- ---------------------------------------------------------------------------
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_billing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_line_commercial_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_commission_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_audit_log ENABLE ROW LEVEL SECURITY;

-- markets
DROP POLICY IF EXISTS markets_authenticated_select ON public.markets;
CREATE POLICY markets_authenticated_select
  ON public.markets FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS markets_service_role_all ON public.markets;
CREATE POLICY markets_service_role_all
  ON public.markets FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS markets_platform_admin_all ON public.markets;
CREATE POLICY markets_platform_admin_all
  ON public.markets FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- profiles/payment methods
DROP POLICY IF EXISTS organization_billing_profiles_provider_select ON public.organization_billing_profiles;
CREATE POLICY organization_billing_profiles_provider_select
  ON public.organization_billing_profiles FOR SELECT TO authenticated
  USING (public.lp_billing_can_access_provider(organization_id));

DROP POLICY IF EXISTS organization_billing_profiles_service_role_all ON public.organization_billing_profiles;
CREATE POLICY organization_billing_profiles_service_role_all
  ON public.organization_billing_profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS payment_methods_provider_select ON public.payment_methods;
CREATE POLICY payment_methods_provider_select
  ON public.payment_methods FOR SELECT TO authenticated
  USING (public.lp_billing_can_access_provider(organization_id));

DROP POLICY IF EXISTS payment_methods_service_role_all ON public.payment_methods;
CREATE POLICY payment_methods_service_role_all
  ON public.payment_methods FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- snapshots
DROP POLICY IF EXISTS order_line_snapshots_provider_select ON public.order_line_commercial_snapshots;
CREATE POLICY order_line_snapshots_provider_select
  ON public.order_line_commercial_snapshots FOR SELECT TO authenticated
  USING (public.lp_billing_can_access_provider(provider_id));

DROP POLICY IF EXISTS order_line_snapshots_service_role_all ON public.order_line_commercial_snapshots;
CREATE POLICY order_line_snapshots_service_role_all
  ON public.order_line_commercial_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- commission objects
DROP POLICY IF EXISTS commission_rules_authenticated_select ON public.commission_rules;
CREATE POLICY commission_rules_authenticated_select
  ON public.commission_rules FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS commission_rules_service_role_all ON public.commission_rules;
CREATE POLICY commission_rules_service_role_all
  ON public.commission_rules FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS commission_rules_platform_admin_all ON public.commission_rules;
CREATE POLICY commission_rules_platform_admin_all
  ON public.commission_rules FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS commission_ledger_provider_select ON public.commission_ledger;
CREATE POLICY commission_ledger_provider_select
  ON public.commission_ledger FOR SELECT TO authenticated
  USING (public.lp_billing_can_access_provider(provider_id));

DROP POLICY IF EXISTS commission_ledger_service_role_insert ON public.commission_ledger;
CREATE POLICY commission_ledger_service_role_insert
  ON public.commission_ledger FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS commission_ledger_platform_admin_insert ON public.commission_ledger;
CREATE POLICY commission_ledger_platform_admin_insert
  ON public.commission_ledger FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS commission_periods_provider_select ON public.commission_periods;
CREATE POLICY commission_periods_provider_select
  ON public.commission_periods FOR SELECT TO authenticated
  USING (public.lp_billing_can_access_provider(provider_id));

DROP POLICY IF EXISTS commission_periods_service_role_all ON public.commission_periods;
CREATE POLICY commission_periods_service_role_all
  ON public.commission_periods FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS commission_periods_platform_admin_all ON public.commission_periods;
CREATE POLICY commission_periods_platform_admin_all
  ON public.commission_periods FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS provider_commission_invoices_provider_select ON public.provider_commission_invoices;
CREATE POLICY provider_commission_invoices_provider_select
  ON public.provider_commission_invoices FOR SELECT TO authenticated
  USING (public.lp_billing_can_access_provider(provider_id));

DROP POLICY IF EXISTS provider_commission_invoices_service_role_all ON public.provider_commission_invoices;
CREATE POLICY provider_commission_invoices_service_role_all
  ON public.provider_commission_invoices FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS provider_commission_invoices_platform_admin_all ON public.provider_commission_invoices;
CREATE POLICY provider_commission_invoices_platform_admin_all
  ON public.provider_commission_invoices FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS invoice_deliveries_provider_select ON public.invoice_deliveries;
CREATE POLICY invoice_deliveries_provider_select
  ON public.invoice_deliveries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.provider_commission_invoices pci
      WHERE pci.id = invoice_deliveries.invoice_id
        AND public.lp_billing_can_access_provider(pci.provider_id)
    )
  );

DROP POLICY IF EXISTS invoice_deliveries_service_role_all ON public.invoice_deliveries;
CREATE POLICY invoice_deliveries_service_role_all
  ON public.invoice_deliveries FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS invoice_deliveries_platform_admin_all ON public.invoice_deliveries;
CREATE POLICY invoice_deliveries_platform_admin_all
  ON public.invoice_deliveries FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS billing_audit_log_platform_admin_select ON public.billing_audit_log;
CREATE POLICY billing_audit_log_platform_admin_select
  ON public.billing_audit_log FOR SELECT TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS billing_audit_log_service_role_insert ON public.billing_audit_log;
CREATE POLICY billing_audit_log_service_role_insert
  ON public.billing_audit_log FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS billing_audit_log_platform_admin_insert ON public.billing_audit_log;
CREATE POLICY billing_audit_log_platform_admin_insert
  ON public.billing_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_admin());

REVOKE ALL ON TABLE
  public.markets,
  public.organization_billing_profiles,
  public.payment_methods,
  public.order_line_commercial_snapshots,
  public.commission_rules,
  public.commission_ledger,
  public.commission_periods,
  public.provider_commission_invoices,
  public.invoice_deliveries,
  public.billing_audit_log
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.markets TO authenticated;
GRANT SELECT ON TABLE public.commission_rules TO authenticated;
GRANT SELECT ON TABLE
  public.organization_billing_profiles,
  public.payment_methods,
  public.order_line_commercial_snapshots,
  public.commission_ledger,
  public.commission_periods,
  public.provider_commission_invoices,
  public.invoice_deliveries
TO authenticated;

GRANT ALL ON TABLE
  public.markets,
  public.organization_billing_profiles,
  public.payment_methods,
  public.order_line_commercial_snapshots,
  public.commission_rules,
  public.commission_ledger,
  public.commission_periods,
  public.provider_commission_invoices,
  public.invoice_deliveries,
  public.billing_audit_log
TO service_role;

GRANT EXECUTE ON FUNCTION public.lp_provider_update_billing_email(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lp_billing_create_order_line_snapshot(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lp_billing_post_commission_for_order(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lp_billing_close_commission_period(uuid, date, date, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lp_billing_create_provider_commission_invoice(uuid) TO authenticated, service_role;

COMMIT;
