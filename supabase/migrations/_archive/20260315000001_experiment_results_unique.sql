-- Phase 43C: Unique key for experiment_results upserts.

ALTER TABLE public.experiment_results
  DROP CONSTRAINT IF EXISTS experiment_results_experiment_variant_uniq;

ALTER TABLE public.experiment_results
  ADD CONSTRAINT experiment_results_experiment_variant_uniq UNIQUE (experiment_id, variant);
