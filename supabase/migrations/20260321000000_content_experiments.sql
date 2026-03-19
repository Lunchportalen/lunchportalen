-- CRO / Experiment foundation: editorial experiments with status and audit.
-- experiment_id links to experiment_results (existing). No traffic routing in this migration; foundation only.

CREATE TABLE IF NOT EXISTS public.content_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NOT NULL REFERENCES public.content_pages(id) ON DELETE CASCADE,
  variant_id uuid NULL REFERENCES public.content_page_variants(id) ON DELETE SET NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('headline', 'cta', 'hero_body')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  experiment_id text NOT NULL UNIQUE,
  config jsonb NOT NULL DEFAULT '{}',
  created_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS content_experiments_page_id ON public.content_experiments (page_id);
CREATE INDEX IF NOT EXISTS content_experiments_status ON public.content_experiments (status);
CREATE INDEX IF NOT EXISTS content_experiments_experiment_id ON public.content_experiments (experiment_id);

COMMENT ON TABLE public.content_experiments IS 'Editorial A/B experiments (headline, CTA, hero/body). experiment_id is used in experiment_results. Status: draft, active, paused, completed.';

ALTER TABLE public.content_experiments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_experiments_superadmin ON public.content_experiments;
CREATE POLICY content_experiments_superadmin ON public.content_experiments
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  );
