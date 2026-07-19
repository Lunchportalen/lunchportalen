-- PHASE 18SCALE — immutable provider production snapshots at local cutoff.
-- Non-production first. Opt-in freeze path; does not alter lp_order_set body.

CREATE TABLE IF NOT EXISTS public.provider_production_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id),
  service_date date NOT NULL,
  cutoff_at timestamptz NOT NULL,
  snapshot_version text NOT NULL DEFAULT 'phase18.v1',
  total_portions integer NOT NULL DEFAULT 0,
  packing_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  item_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  allergen_totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_event_hwm text,
  checksum text NOT NULL,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, service_date, snapshot_version)
);

CREATE INDEX IF NOT EXISTS idx_provider_production_snapshots_provider_date
  ON public.provider_production_snapshots (provider_id, service_date);

ALTER TABLE public.provider_production_snapshots ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.provider_production_snapshot_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  service_date date NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pps_outbox_pending
  ON public.provider_production_snapshot_outbox (status, created_at)
  WHERE status = 'pending';

-- Fast path: enqueue delta on cancel/set via optional trigger later; freeze RPC aggregates once.

CREATE OR REPLACE FUNCTION public.lp_production_freeze_snapshot(
  p_provider_id uuid,
  p_service_date date,
  p_cutoff_at timestamptz DEFAULT now()
)
RETURNS public.provider_production_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer := 0;
  v_items jsonb := '{}'::jsonb;
  v_checksum text;
  v_row public.provider_production_snapshots;
BEGIN
  SELECT COALESCE(SUM(oi.quantity), 0)
  INTO v_total
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.provider_id = p_provider_id
    AND o.date = p_service_date
    AND o.status = 'ACTIVE';

  SELECT COALESCE(jsonb_object_agg(sku, qty), '{}'::jsonb)
  INTO v_items
  FROM (
    SELECT COALESCE(p.sku, oi.product_id::text) AS sku, SUM(oi.quantity)::int AS qty
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    LEFT JOIN public.products p ON p.id = oi.product_id
    WHERE o.provider_id = p_provider_id
      AND o.date = p_service_date
      AND o.status = 'ACTIVE'
    GROUP BY 1
  ) s;

  v_checksum := encode(
    extensions.digest(
      convert_to(
        p_provider_id::text || '|' || p_service_date::text || '|' || v_total::text || '|' || v_items::text,
        'utf8'
      ),
      'sha256'
    ),
    'hex'
  );

  INSERT INTO public.provider_production_snapshots (
    provider_id, service_date, cutoff_at, total_portions, item_totals, checksum, source_event_hwm
  ) VALUES (
    p_provider_id, p_service_date, p_cutoff_at, v_total, v_items, v_checksum, v_checksum
  )
  ON CONFLICT (provider_id, service_date, snapshot_version)
  DO UPDATE SET
    -- Immutable after first freeze: keep original totals/checksum
    frozen_at = public.provider_production_snapshots.frozen_at
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.lp_production_freeze_snapshot(uuid, date, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lp_production_freeze_snapshot(uuid, date, timestamptz) TO service_role;

-- Helpful indexes for scale paths (safe additive).
CREATE INDEX IF NOT EXISTS idx_orders_provider_date_status
  ON public.orders (provider_id, date, status);

CREATE INDEX IF NOT EXISTS idx_orders_company_date_status
  ON public.orders (company_id, date, status);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
  ON public.order_items (order_id);
