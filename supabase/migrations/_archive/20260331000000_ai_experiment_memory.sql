-- Experiment learning memory: store historical experiment results for AI/analytics.
-- One row per variant per snapshot; outcome = winner | runner_up | other.

CREATE TABLE IF NOT EXISTS public.ai_experiment_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id text NOT NULL,
  page_id uuid NULL REFERENCES public.content_pages(id) ON DELETE SET NULL,
  variant text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('winner', 'runner_up', 'other')),
  views int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  conversions int NOT NULL DEFAULT 0,
  primary_metric text NOT NULL DEFAULT 'conversions' CHECK (primary_metric IN ('conversions', 'clicks', 'views')),
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_experiment_memory_experiment_id ON public.ai_experiment_memory (experiment_id);
CREATE INDEX IF NOT EXISTS ai_experiment_memory_page_id ON public.ai_experiment_memory (page_id);
CREATE INDEX IF NOT EXISTS ai_experiment_memory_snapshot_at ON public.ai_experiment_memory (snapshot_at DESC);
CREATE INDEX IF NOT EXISTS ai_experiment_memory_outcome ON public.ai_experiment_memory (outcome);

COMMENT ON TABLE public.ai_experiment_memory IS 'AI experiment learning memory: historical results per variant (winner/runner_up/other) for future learning and recommendations.';

ALTER TABLE public.ai_experiment_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_experiment_memory_superadmin ON public.ai_experiment_memory;
CREATE POLICY ai_experiment_memory_superadmin ON public.ai_experiment_memory
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  );
