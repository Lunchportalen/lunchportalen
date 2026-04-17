-- Enterprise growth: revenue attribution per experiment variant + session stitching for public telemetry.

CREATE TABLE public.experiment_revenue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES public.experiments (id) ON DELETE CASCADE,
  variant_id text NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  revenue numeric(16, 4) NOT NULL DEFAULT 0 CHECK (revenue >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX experiment_revenue_experiment_id_idx ON public.experiment_revenue (experiment_id);
CREATE INDEX experiment_revenue_company_id_idx ON public.experiment_revenue (company_id);
CREATE INDEX experiment_revenue_created_at_idx ON public.experiment_revenue (created_at DESC);

COMMENT ON TABLE public.experiment_revenue IS 'Order revenue attributed to running experiment variant (service-role writes).';

CREATE TABLE public.experiment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id uuid NOT NULL REFERENCES public.experiments (id) ON DELETE CASCADE,
  variant_id text NOT NULL,
  session_id text NOT NULL,
  company_id uuid NULL REFERENCES public.companies (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT experiment_sessions_experiment_session_uq UNIQUE (experiment_id, session_id)
);

CREATE INDEX experiment_sessions_experiment_id_idx ON public.experiment_sessions (experiment_id);
CREATE INDEX experiment_sessions_session_id_idx ON public.experiment_sessions (session_id);

COMMENT ON TABLE public.experiment_sessions IS 'First-seen session per experiment for attribution (upsert from track-event).';

ALTER TABLE public.experiment_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_sessions ENABLE ROW LEVEL SECURITY;
