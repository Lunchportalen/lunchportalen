-- Global Billing Engine phase: invoice close dry-run.
--
-- Scope:
-- - Read-only preview of provider commission period close.
-- - No commission_period insert/update, no invoice insert, no payment intent, no card charge,
--   no invoice delivery, no email sending, no Stripe call.

BEGIN;

CREATE OR REPLACE FUNCTION public.lp_billing_invoice_close_dry_run(
  p_provider_id uuid,
  p_period_start date,
  p_period_end date,
  p_currency text
)
RETURNS TABLE (
  provider_id uuid,
  organization_id uuid,
  period_start date,
  period_end date,
  currency text,
  ledger_rows_count integer,
  positive_basis_amount_minor bigint,
  negative_basis_amount_minor bigint,
  net_basis_amount_minor bigint,
  positive_commission_amount_exact numeric,
  negative_commission_amount_exact numeric,
  net_commission_amount_exact numeric,
  rounded_commission_amount_minor bigint,
  rounding_adjustment_minor numeric,
  invoice_ready boolean,
  payment_charge_ready boolean,
  missing_requirements text[],
  recipient_emails_snapshot_preview jsonb,
  has_mixed_currency boolean,
  has_closed_period_conflict boolean,
  credit_note_required_count integer,
  can_close boolean,
  can_charge boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, private
AS $$
  WITH readiness AS (
    SELECT *
    FROM public.lp_billing_payment_readiness(
      p_provider_id,
      p_period_start,
      p_period_end,
      p_currency
    )
  ),
  ledger AS (
    SELECT
      cl.*
    FROM public.commission_ledger cl
    WHERE cl.provider_id = p_provider_id
      AND cl.billing_period = to_char(p_period_start, 'YYYY-MM')
  ),
  ledger_summary AS (
    SELECT
      count(*)::integer AS ledger_rows_count,
      count(DISTINCT currency)::integer AS currency_count,
      coalesce(sum(CASE WHEN commission_basis_amount_minor > 0 THEN commission_basis_amount_minor ELSE 0 END), 0)::bigint
        AS positive_basis_amount_minor,
      coalesce(sum(CASE WHEN commission_basis_amount_minor < 0 THEN commission_basis_amount_minor ELSE 0 END), 0)::bigint
        AS negative_basis_amount_minor,
      coalesce(sum(commission_basis_amount_minor), 0)::bigint AS net_basis_amount_minor,
      coalesce(sum(CASE WHEN commission_amount_exact > 0 THEN commission_amount_exact ELSE 0 END), 0)::numeric
        AS positive_commission_amount_exact,
      coalesce(sum(CASE WHEN commission_amount_exact < 0 THEN commission_amount_exact ELSE 0 END), 0)::numeric
        AS negative_commission_amount_exact,
      coalesce(sum(commission_amount_exact), 0)::numeric AS net_commission_amount_exact
    FROM ledger
    WHERE currency = upper(trim(p_currency))
  ),
  mixed_currency AS (
    SELECT count(DISTINCT cl.currency)::integer > 1 AS has_mixed_currency
    FROM public.commission_ledger cl
    WHERE cl.provider_id = p_provider_id
      AND cl.billing_period = to_char(p_period_start, 'YYYY-MM')
  ),
  closed_conflict AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.commission_periods cp
      WHERE cp.provider_id = p_provider_id
        AND cp.period_start = p_period_start
        AND cp.period_end = p_period_end
        AND cp.currency = upper(trim(p_currency))
        AND cp.status IN ('closed', 'invoiced', 'paid')
    ) AS has_closed_period_conflict
  ),
  credit_note_candidates AS (
    SELECT count(*)::integer AS credit_note_required_count
    FROM ledger neg
    WHERE neg.currency = upper(trim(p_currency))
      AND neg.event_type IN ('ORDER_CANCELLED', 'ORDER_REFUNDED', 'ORDER_CORRECTED', 'CREDIT_NOTE')
      AND EXISTS (
        SELECT 1
        FROM public.commission_periods cp
        JOIN public.commission_ledger pos
          ON pos.provider_id = cp.provider_id
         AND pos.currency = cp.currency
         AND pos.order_id = neg.order_id
         AND pos.order_line_id = neg.order_line_id
         AND pos.event_type = 'ORDER_COMPLETED'
         AND pos.billing_period = to_char(cp.period_start, 'YYYY-MM')
        WHERE cp.provider_id = neg.provider_id
          AND cp.status IN ('closed', 'invoiced', 'paid')
          AND cp.period_end <= p_period_start
      )
  ),
  recipients AS (
    SELECT coalesce(jsonb_agg(DISTINCT email) FILTER (WHERE email IS NOT NULL), '[]'::jsonb) AS emails
    FROM (
      SELECT lower(nullif(trim(obp.billing_email_current), '')) AS email
      FROM public.organization_billing_profiles obp
      WHERE obp.organization_id = p_provider_id
      UNION
      SELECT lower(u.email) AS email
      FROM public.provider_memberships pm
      JOIN auth.users u ON u.id = pm.user_id
      WHERE pm.provider_id = p_provider_id
        AND pm.role = 'provider_admin'::public.provider_role
        AND u.email IS NOT NULL
        AND u.email_confirmed_at IS NOT NULL
    ) s
  ),
  calc AS (
    SELECT
      ls.*,
      round(ls.net_commission_amount_exact)::bigint AS rounded_commission_amount_minor,
      (round(ls.net_commission_amount_exact)::numeric - ls.net_commission_amount_exact) AS rounding_adjustment_minor,
      coalesce(mc.has_mixed_currency, false) AS has_mixed_currency,
      coalesce(cc.has_closed_period_conflict, false) AS has_closed_period_conflict,
      coalesce(cn.credit_note_required_count, 0)::integer AS credit_note_required_count,
      coalesce(r.emails, '[]'::jsonb) AS recipient_emails_snapshot_preview
    FROM ledger_summary ls
    CROSS JOIN mixed_currency mc
    CROSS JOIN closed_conflict cc
    CROSS JOIN credit_note_candidates cn
    CROSS JOIN recipients r
  ),
  missing AS (
    SELECT ARRAY(
      SELECT DISTINCT req
      FROM (
        SELECT unnest(coalesce((SELECT missing_requirements FROM readiness LIMIT 1), '{}'::text[])) AS req
        UNION ALL SELECT 'period_ledger_empty' WHERE (SELECT ledger_rows_count FROM calc) = 0
        UNION ALL SELECT 'period_mixed_currency' WHERE (SELECT has_mixed_currency FROM calc)
        UNION ALL SELECT 'period_already_closed_or_invoiced' WHERE (SELECT has_closed_period_conflict FROM calc)
        UNION ALL SELECT 'invoice_recipient_missing' WHERE jsonb_array_length((SELECT recipient_emails_snapshot_preview FROM calc)) = 0
        UNION ALL SELECT 'credit_note_policy_required' WHERE (SELECT credit_note_required_count FROM calc) > 0
      ) reqs
      WHERE req IS NOT NULL
      ORDER BY req
    ) AS requirements
  )
  SELECT
    p_provider_id,
    (SELECT organization_id FROM readiness LIMIT 1),
    p_period_start,
    p_period_end,
    upper(trim(p_currency)),
    calc.ledger_rows_count,
    calc.positive_basis_amount_minor,
    calc.negative_basis_amount_minor,
    calc.net_basis_amount_minor,
    calc.positive_commission_amount_exact,
    calc.negative_commission_amount_exact,
    calc.net_commission_amount_exact,
    calc.rounded_commission_amount_minor,
    calc.rounding_adjustment_minor,
    coalesce((SELECT invoice_ready FROM readiness LIMIT 1), false),
    coalesce((SELECT payment_charge_ready FROM readiness LIMIT 1), false),
    missing.requirements,
    calc.recipient_emails_snapshot_preview,
    calc.has_mixed_currency,
    calc.has_closed_period_conflict,
    calc.credit_note_required_count,
    (
      coalesce((SELECT invoice_ready FROM readiness LIMIT 1), false)
      AND calc.ledger_rows_count > 0
      AND calc.has_mixed_currency = false
      AND calc.has_closed_period_conflict = false
      AND jsonb_array_length(calc.recipient_emails_snapshot_preview) > 0
      AND NOT ('credit_note_policy_required' = ANY(missing.requirements))
    ) AS can_close,
    (
      coalesce((SELECT payment_charge_ready FROM readiness LIMIT 1), false)
      AND calc.ledger_rows_count > 0
      AND calc.has_mixed_currency = false
      AND calc.has_closed_period_conflict = false
      AND jsonb_array_length(calc.recipient_emails_snapshot_preview) > 0
      AND NOT ('credit_note_policy_required' = ANY(missing.requirements))
    ) AS can_charge
  FROM calc
  CROSS JOIN missing;
$$;

COMMENT ON FUNCTION public.lp_billing_invoice_close_dry_run(uuid, date, date, text) IS
  'Read-only provider commission invoice close preview. Sums append-only commission_ledger only. Does not create periods, invoices, payment intents, charges, deliveries, or emails.';

GRANT EXECUTE ON FUNCTION public.lp_billing_invoice_close_dry_run(uuid, date, date, text)
  TO authenticated, service_role;

COMMIT;
