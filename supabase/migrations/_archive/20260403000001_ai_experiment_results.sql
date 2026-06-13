-- AI Experiment Engine: resultater per variant (views, clicks, conversions).

CREATE TABLE IF NOT EXISTS public.ai_experiment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES public.ai_experiments(id) ON DELETE CASCADE,
  variant text NOT NULL,
  views int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  conversions int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_experiment_results_experiment_variant_uniq
  ON public.ai_experiment_results (experiment_id, variant);

CREATE INDEX IF NOT EXISTS ai_experiment_results_experiment_id ON public.ai_experiment_results (experiment_id);

COMMENT ON TABLE public.ai_experiment_results IS 'AI Experiment Engine: resultater per variant for A/B-tester. Oppdateres ved view/click/conversion.';

ALTER TABLE public.ai_experiment_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_experiment_results_superadmin ON public.ai_experiment_results;
CREATE POLICY ai_experiment_results_superadmin ON public.ai_experiment_results
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  );
