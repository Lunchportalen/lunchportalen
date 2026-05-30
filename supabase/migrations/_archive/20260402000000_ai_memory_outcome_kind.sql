-- AI Memory System: legg til kind 'outcome' for "hva som fungerer / ikke fungerer".
-- Eksisterende: experiment, seo_learning, conversion_pattern.

ALTER TABLE public.ai_memory DROP CONSTRAINT IF EXISTS ai_memory_kind_check;
ALTER TABLE public.ai_memory ADD CONSTRAINT ai_memory_kind_check
  CHECK (kind IN ('experiment', 'seo_learning', 'conversion_pattern', 'outcome'));

COMMENT ON TABLE public.ai_memory IS 'AI Memory System: eksperimentresultater, SEO-effekt, konverteringsendringer, hva som fungerer/ikke fungerer. Selvforbedrende.';
