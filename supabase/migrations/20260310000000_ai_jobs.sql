-- Phase 37: AI Job Queue (async tasks). Superadmin-only RLS.

CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb NULL,
  error text NULL,
  created_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NULL,
  finished_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS ai_jobs_status_idx ON public.ai_jobs (status, created_at DESC);

ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_jobs_superadmin_only ON public.ai_jobs;
CREATE POLICY ai_jobs_superadmin_only ON public.ai_jobs
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  );