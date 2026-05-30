-- Self-learning layer: optional outcome columns on ai_memory (additive; existing rows stay null).

ALTER TABLE public.ai_memory
  ADD COLUMN IF NOT EXISTS outcome_score numeric,
  ADD COLUMN IF NOT EXISTS success boolean,
  ADD COLUMN IF NOT EXISTS action_type text;

CREATE INDEX IF NOT EXISTS ai_memory_action_type_learning_idx
  ON public.ai_memory (action_type)
  WHERE action_type IS NOT NULL AND outcome_score IS NOT NULL;

COMMENT ON COLUMN public.ai_memory.outcome_score IS 'Observed metric delta or score for learning (e.g. conversion delta).';
COMMENT ON COLUMN public.ai_memory.success IS 'Whether the observed outcome was positive for the recorded action.';
COMMENT ON COLUMN public.ai_memory.action_type IS 'Singularity / automation action type for experience aggregation (experiment, variant, optimize).';
