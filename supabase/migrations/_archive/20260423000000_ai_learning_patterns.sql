-- Aggregated experiment → AI feedback (adaptive scoring). Accessed via Next.js service role only.
CREATE TABLE public.ai_learning_patterns (
  pattern_key text PRIMARY KEY,
  weight double precision NOT NULL DEFAULT 0,
  evidence_count integer NOT NULL DEFAULT 0,
  last_reason text,
  based_on text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_learning_patterns_weight_range CHECK (weight >= -5 AND weight <= 5)
);

CREATE INDEX ai_learning_patterns_weight_idx ON public.ai_learning_patterns (weight DESC);

ALTER TABLE public.ai_learning_patterns ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.ai_learning_patterns IS 'Explainable pattern weights from A/B results; used to nudge AI scores only (no auto-publish).';
