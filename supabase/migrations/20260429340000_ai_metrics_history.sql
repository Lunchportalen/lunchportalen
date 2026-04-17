-- Time-series samples per metric name for predictive (z-score) anomaly detection (append-only).

CREATE TABLE IF NOT EXISTS public.ai_metrics_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  value double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_metrics_history_metric_created ON public.ai_metrics_history (metric_name, created_at DESC);

COMMENT ON TABLE public.ai_metrics_history IS 'KPI history for statistical baselines; service-role writes from observability cron.';

ALTER TABLE public.ai_metrics_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_metrics_history_superadmin ON public.ai_metrics_history;
CREATE POLICY ai_metrics_history_superadmin ON public.ai_metrics_history
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  );
