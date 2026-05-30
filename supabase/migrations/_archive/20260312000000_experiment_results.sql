-- Phase 39: Experiment analytics. Superadmin-only RLS.

CREATE TABLE IF NOT EXISTS public.experiment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id text NOT NULL,
  variant text NOT NULL,
  views int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  conversions int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS experiment_results_idx ON public.experiment_results (experiment_id);

ALTER TABLE public.experiment_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS experiment_results_superadmin_only ON public.experiment_results;
CREATE POLICY experiment_results_superadmin_only ON public.experiment_results
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  );