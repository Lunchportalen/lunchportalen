-- Patch 15 (Phase E.15) — provider SaaS subscriptions + invoice skeleton

CREATE TABLE IF NOT EXISTS public.provider_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('SAAS_FIXED', 'SAAS_PER_COMPANY', 'CUSTOM')),
  monthly_amount numeric(10, 2) NOT NULL CHECK (monthly_amount >= 0),
  currency text NOT NULL DEFAULT 'NOK',
  tax_code_id text NOT NULL DEFAULT 'MVA_25' REFERENCES public.billing_tax_codes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  billing_email text NOT NULL,
  billing_org_number text,
  billing_address text,
  active_from timestamptz NOT NULL DEFAULT now(),
  active_to timestamptz,
  status text NOT NULL CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELLED')),
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, active_to)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_subscriptions_active
  ON public.provider_subscriptions (provider_id)
  WHERE active_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_provider_subscriptions_provider
  ON public.provider_subscriptions (provider_id);

CREATE INDEX IF NOT EXISTS idx_provider_subscriptions_status
  ON public.provider_subscriptions (status)
  WHERE active_to IS NULL;

COMMENT ON TABLE public.provider_subscriptions IS
  'SaaS license per provider. One active row (active_to IS NULL) at a time.';

CREATE TABLE IF NOT EXISTS public.provider_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES public.provider_subscriptions(id) ON DELETE RESTRICT,
  invoice_number text UNIQUE,
  invoice_period date NOT NULL,
  amount_net numeric(10, 2) NOT NULL,
  amount_tax numeric(10, 2) NOT NULL,
  amount_total numeric(10, 2) NOT NULL,
  tax_code_id text NOT NULL REFERENCES public.billing_tax_codes(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID')),
  due_date date,
  sent_at timestamptz,
  paid_at timestamptz,
  tripletex_invoice_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, invoice_period)
);

CREATE INDEX IF NOT EXISTS idx_provider_invoices_provider
  ON public.provider_invoices (provider_id);

CREATE INDEX IF NOT EXISTS idx_provider_invoices_period
  ON public.provider_invoices (invoice_period DESC);

COMMENT ON TABLE public.provider_invoices IS
  'Monthly SaaS invoices to providers (skeleton; Tripletex sync later).';

ALTER TABLE public.provider_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_invoices ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.provider_subscriptions TO authenticated;
GRANT SELECT ON public.provider_invoices TO authenticated;

DROP POLICY IF EXISTS subscriptions_superadmin_all ON public.provider_subscriptions;
CREATE POLICY subscriptions_superadmin_all ON public.provider_subscriptions
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS subscriptions_provider_select ON public.provider_subscriptions;
CREATE POLICY subscriptions_provider_select ON public.provider_subscriptions
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_access_provider(provider_id));

DROP POLICY IF EXISTS invoices_superadmin_all ON public.provider_invoices;
CREATE POLICY invoices_superadmin_all ON public.provider_invoices
  AS PERMISSIVE FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS invoices_provider_select ON public.provider_invoices;
CREATE POLICY invoices_provider_select ON public.provider_invoices
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.can_access_provider(provider_id));

CREATE OR REPLACE FUNCTION public.lp_provider_set_subscription(
  p_provider_id uuid,
  p_plan text,
  p_monthly_amount numeric,
  p_billing_email text,
  p_billing_org_number text DEFAULT NULL,
  p_billing_address text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_plan text := upper(btrim(coalesce(p_plan, '')));
  v_email text := lower(btrim(coalesce(p_billing_email, '')));
  v_old_subscription_id uuid;
  v_new_subscription_id uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  IF v_plan NOT IN ('SAAS_FIXED', 'SAAS_PER_COMPANY', 'CUSTOM') THEN
    RAISE EXCEPTION 'INVALID_PLAN' USING ERRCODE = '22023';
  END IF;

  IF p_monthly_amount IS NULL OR p_monthly_amount < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING ERRCODE = '22023';
  END IF;

  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'INVALID_BILLING_EMAIL' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.providers p WHERE p.id = p_provider_id AND p.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'PROVIDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.provider_subscriptions
     SET active_to = now(),
         status = CASE WHEN status = 'ACTIVE' THEN 'CANCELLED' ELSE status END
   WHERE provider_id = p_provider_id
     AND active_to IS NULL
  RETURNING id INTO v_old_subscription_id;

  INSERT INTO public.provider_subscriptions (
    provider_id,
    plan,
    monthly_amount,
    tax_code_id,
    billing_email,
    billing_org_number,
    billing_address,
    status,
    notes,
    created_by
  )
  VALUES (
    p_provider_id,
    v_plan,
    p_monthly_amount,
    'MVA_25',
    v_email,
    nullif(btrim(coalesce(p_billing_org_number, '')), ''),
    nullif(btrim(coalesce(p_billing_address, '')), ''),
    'ACTIVE',
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  RETURNING id INTO v_new_subscription_id;

  INSERT INTO public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  VALUES (
    auth.uid(),
    'subscription_set',
    'provider',
    p_provider_id,
    format('SaaS-fee satt til %s NOK/mnd (%s)', p_monthly_amount, v_plan),
    jsonb_build_object(
      'old_subscription_id', v_old_subscription_id,
      'new_subscription_id', v_new_subscription_id,
      'plan', v_plan,
      'monthly_amount', p_monthly_amount
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'subscription_id', v_new_subscription_id,
    'replaced_subscription_id', v_old_subscription_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lp_provider_set_subscription(uuid, text, numeric, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.lp_provider_update_billing_contact(
  p_provider_id uuid,
  p_billing_email text,
  p_billing_org_number text DEFAULT NULL,
  p_billing_address text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_email text := lower(btrim(coalesce(p_billing_email, '')));
  v_sub_id uuid;
BEGIN
  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'INVALID_BILLING_EMAIL' USING ERRCODE = '22023';
  END IF;

  IF public.is_platform_admin() THEN
    NULL;
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.provider_memberships pm
    WHERE pm.user_id = auth.uid()
      AND pm.provider_id = p_provider_id
      AND pm.role = 'provider_admin'::public.provider_role
  ) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.provider_subscriptions
     SET billing_email = v_email,
         billing_org_number = nullif(btrim(coalesce(p_billing_org_number, '')), ''),
         billing_address = nullif(btrim(coalesce(p_billing_address, '')), '')
   WHERE provider_id = p_provider_id
     AND active_to IS NULL
     AND status = 'ACTIVE'
  RETURNING id INTO v_sub_id;

  IF v_sub_id IS NULL THEN
    RAISE EXCEPTION 'ACTIVE_SUBSCRIPTION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  VALUES (
    auth.uid(),
    'subscription_billing_contact_updated',
    'provider_subscription',
    v_sub_id,
    'Provider billing contact updated',
    jsonb_build_object(
      'provider_id', p_provider_id,
      'billing_email', v_email
    )
  );

  RETURN jsonb_build_object('ok', true, 'subscription_id', v_sub_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.lp_provider_update_billing_contact(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.lp_provider_generate_invoice_for_period(
  p_provider_id uuid,
  p_invoice_period date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_period date := date_trunc('month', coalesce(p_invoice_period, current_date))::date;
  v_sub public.provider_subscriptions%rowtype;
  v_rate numeric;
  v_net numeric(10, 2);
  v_tax numeric(10, 2);
  v_total numeric(10, 2);
  v_invoice_id uuid;
  v_invoice_number text;
  v_existing uuid;
  v_slug text;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_existing
  FROM public.provider_invoices
  WHERE provider_id = p_provider_id
    AND invoice_period = v_period;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'invoice_id', v_existing, 'idempotent', true);
  END IF;

  SELECT * INTO v_sub
  FROM public.provider_subscriptions
  WHERE provider_id = p_provider_id
    AND active_to IS NULL
    AND status = 'ACTIVE'
  ORDER BY active_from DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTIVE_SUBSCRIPTION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT btc.rate INTO v_rate
  FROM public.billing_tax_codes btc
  WHERE btc.id = v_sub.tax_code_id;

  IF v_rate IS NULL THEN
    RAISE EXCEPTION 'TAX_CODE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_net := round(v_sub.monthly_amount, 2);
  v_tax := round(v_net * v_rate, 2);
  v_total := v_net + v_tax;

  SELECT p.slug INTO v_slug FROM public.providers p WHERE p.id = p_provider_id;
  v_invoice_number := format(
    'LP-SAAS-%s-%s',
    upper(coalesce(nullif(btrim(v_slug), ''), 'PROV')),
    to_char(v_period, 'YYYYMM')
  );

  INSERT INTO public.provider_invoices (
    provider_id,
    subscription_id,
    invoice_number,
    invoice_period,
    amount_net,
    amount_tax,
    amount_total,
    tax_code_id,
    status,
    due_date,
    metadata
  )
  VALUES (
    p_provider_id,
    v_sub.id,
    v_invoice_number,
    v_period,
    v_net,
    v_tax,
    v_total,
    v_sub.tax_code_id,
    'DRAFT',
    (v_period + interval '1 month' + interval '14 days')::date,
    jsonb_build_object('plan', v_sub.plan, 'generated_by', 'lp_provider_generate_invoice_for_period')
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  VALUES (
    auth.uid(),
    'provider_invoice_generated',
    'provider_invoice',
    v_invoice_id,
    format('Invoice %s for period %s', v_invoice_number, v_period),
    jsonb_build_object(
      'provider_id', p_provider_id,
      'subscription_id', v_sub.id,
      'invoice_period', v_period,
      'amount_total', v_total
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'amount_net', v_net,
    'amount_tax', v_tax,
    'amount_total', v_total,
    'idempotent', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.lp_provider_generate_invoice_for_period(uuid, date) TO authenticated;
