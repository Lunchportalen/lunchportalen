-- AI Experiment Engine: experiment definitions (A/B tests, winner, status).
-- Dette er der systemet begynner å bli autonomt.

CREATE TABLE IF NOT EXISTS public.ai_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  target_type text NULL,
  primary_metric text NULL,
  variants jsonb NOT NULL DEFAULT '[]',
  winner_variant text NULL,
  page_id uuid NULL REFERENCES public.content_pages(id) ON DELETE SET NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS ai_experiments_status ON public.ai_experiments (status);
CREATE INDEX IF NOT EXISTS ai_experiments_page_id ON public.ai_experiments (page_id);
CREATE INDEX IF NOT EXISTS ai_experiments_created_at ON public.ai_experiments (created_at DESC);

COMMENT ON TABLE public.ai_experiments IS 'AI Experiment Engine: A/B-testdefinisjoner. Status: draft, active, paused, completed. winner_variant settes når forbedring implementeres.';

ALTER TABLE public.ai_experiments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_experiments_superadmin ON public.ai_experiments;
CREATE POLICY ai_experiments_superadmin ON public.ai_experiments
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  );
