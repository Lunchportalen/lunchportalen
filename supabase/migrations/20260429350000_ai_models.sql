-- Persisted ML model artifacts (JSON); service-role writes from training cron.

CREATE TABLE IF NOT EXISTS public.ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_models_created_at_desc ON public.ai_models (created_at DESC);

COMMENT ON TABLE public.ai_models IS 'Serialized ML models (e.g. linear regression weights); append-only history, latest row used for inference.';

ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_models_superadmin ON public.ai_models;
CREATE POLICY ai_models_superadmin ON public.ai_models
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  );
