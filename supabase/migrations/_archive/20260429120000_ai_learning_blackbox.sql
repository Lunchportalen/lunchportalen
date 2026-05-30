-- Append-only learning log for blackbox / controlled autonomy cycles (service role writes).

CREATE TABLE public.ai_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'blackbox',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_learning_source_created_at_idx ON public.ai_learning (source, created_at DESC);
CREATE INDEX ai_learning_created_at_idx ON public.ai_learning (created_at DESC);

ALTER TABLE public.ai_learning ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ai_learning IS 'Append-only snapshots for explainable AI cycles (blackbox); reversible audit via stored JSON.';
