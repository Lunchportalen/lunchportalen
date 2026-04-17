-- Production A/B traffic: experiments, weighted variants, event stream (views / clicks / conversions).
-- Accessed via Next.js API + service role (RLS on; service_role bypasses).

CREATE TABLE public.experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX experiments_content_id_idx ON public.experiments (content_id);
CREATE INDEX experiments_status_idx ON public.experiments (status);
CREATE INDEX experiments_created_at_idx ON public.experiments (created_at DESC);

CREATE TABLE public.experiment_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES public.experiments (id) ON DELETE CASCADE,
  variant_id text NOT NULL,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  weight double precision NOT NULL DEFAULT 1.0 CHECK (weight > 0),
  CONSTRAINT experiment_variants_unique_key UNIQUE (experiment_id, variant_id)
);

CREATE INDEX experiment_variants_experiment_id_idx ON public.experiment_variants (experiment_id);

CREATE TABLE public.experiment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES public.experiments (id) ON DELETE CASCADE,
  variant_id text NOT NULL,
  user_id uuid NULL,
  event_type text NOT NULL CHECK (event_type IN ('view', 'click', 'conversion')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX experiment_events_experiment_id_idx ON public.experiment_events (experiment_id);
CREATE INDEX experiment_events_variant_idx ON public.experiment_events (experiment_id, variant_id);
CREATE INDEX experiment_events_type_idx ON public.experiment_events (experiment_id, event_type);
CREATE INDEX experiment_events_created_at_idx ON public.experiment_events (created_at DESC);

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.experiments IS 'Traffic A/B experiments keyed by content_id; status draft|running|completed.';
COMMENT ON TABLE public.experiment_variants IS 'Weighted variants with block payloads for render.';
COMMENT ON TABLE public.experiment_events IS 'Append-only events: view, click, conversion. user_id optional (use stable UUID for anonymous subjects).';
