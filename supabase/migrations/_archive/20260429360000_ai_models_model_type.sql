-- Distinguish linear regression vs sequence model rows (additive; existing rows default to linear).

ALTER TABLE public.ai_models
  ADD COLUMN IF NOT EXISTS model_type text NOT NULL DEFAULT 'linear';

COMMENT ON COLUMN public.ai_models.model_type IS 'linear | sequence — which artifact shape is in `model` jsonb.';

CREATE INDEX IF NOT EXISTS ai_models_type_created_desc ON public.ai_models (model_type, created_at DESC);
