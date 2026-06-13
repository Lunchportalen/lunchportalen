-- Additive CRO / A/B growth: optional page link, variant labels, impression events, resolution audit blob.

ALTER TABLE public.experiments
  ADD COLUMN IF NOT EXISTS page_id uuid REFERENCES public.content_pages (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS experiments_page_id_idx ON public.experiments (page_id);

ALTER TABLE public.experiments
  ADD COLUMN IF NOT EXISTS resolution_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.experiment_variants
  ADD COLUMN IF NOT EXISTS name text NULL;

COMMENT ON COLUMN public.experiment_variants.name IS 'Optional label (e.g. A, B) for editors; traffic key remains variant_id.';

ALTER TABLE public.experiment_events DROP CONSTRAINT IF EXISTS experiment_events_event_type_check;

ALTER TABLE public.experiment_events
  ADD CONSTRAINT experiment_events_event_type_check
  CHECK (event_type IN ('view', 'impression', 'click', 'conversion'));

COMMENT ON COLUMN public.experiments.resolution_meta IS 'Audit snapshot for reversibility (preview/prod bodies before apply, winner, timestamps).';
