-- PHASE 17MENU.1 — Enterprise contracts + provider price ownership tables (staging-first)
-- PRODUCTION_MIGRATION = NOT_APPROVED — apply only to staging unless owner approves.

BEGIN;

CREATE TABLE IF NOT EXISTS public.provider_enterprise_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.organizations(id),
  company_id uuid NOT NULL,
  country_code text NOT NULL,
  currency text NOT NULL,
  base_price_minor integer NOT NULL CHECK (base_price_minor >= 0),
  base_price_version text NOT NULL,
  included_categories jsonb NOT NULL DEFAULT '["warm_meal"]'::jsonb,
  included_upgrades jsonb NOT NULL DEFAULT '[]'::jsonb,
  paid_upgrades jsonb NOT NULL DEFAULT '[]'::jsonb,
  minimum_daily_quantity integer NOT NULL DEFAULT 1 CHECK (minimum_daily_quantity >= 1),
  contractual_volume integer NULL,
  delivery_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_windows jsonb NOT NULL DEFAULT '[]'::jsonb,
  capacity integer NOT NULL DEFAULT 0,
  cutoff text NOT NULL DEFAULT '08:00',
  operating_days jsonb NOT NULL DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb,
  effective_from date NOT NULL,
  effective_to date NULL,
  cost_centers jsonb NOT NULL DEFAULT '[]'::jsonb,
  reporting_needs jsonb NOT NULL DEFAULT '[]'::jsonb,
  version text NOT NULL,
  audit_event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_enterprise_contracts_country_chk CHECK (char_length(country_code) = 2)
);

CREATE INDEX IF NOT EXISTS provider_enterprise_contracts_provider_company_idx
  ON public.provider_enterprise_contracts (provider_id, company_id);

ALTER TABLE public.provider_enterprise_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_enterprise_contracts_service_role_all ON public.provider_enterprise_contracts;
CREATE POLICY provider_enterprise_contracts_service_role_all
  ON public.provider_enterprise_contracts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.provider_enterprise_contracts IS
  'PHASE 17MENU.1: Enterprise is a provider-company contract product; not automatic Luxus.';

-- Exact commission remainder carry ledger (period settlement)
CREATE TABLE IF NOT EXISTS public.commission_remainder_carry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.organizations(id),
  currency text NOT NULL,
  period_key text NOT NULL,
  carry_in integer NOT NULL DEFAULT 0 CHECK (carry_in >= 0 AND carry_in < 10000),
  carry_out integer NOT NULL DEFAULT 0 CHECK (carry_out >= 0 AND carry_out < 10000),
  period_numerator bigint NOT NULL DEFAULT 0,
  commission_invoice_minor integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, currency, period_key)
);

ALTER TABLE public.commission_remainder_carry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS commission_remainder_carry_service_role_all ON public.commission_remainder_carry;
CREATE POLICY commission_remainder_carry_service_role_all
  ON public.commission_remainder_carry
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
