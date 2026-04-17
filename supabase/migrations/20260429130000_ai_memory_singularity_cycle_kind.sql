-- Singularity / growth orchestrator: one ai_memory row per cron cycle (context + plan + outcomes).

ALTER TABLE public.ai_memory DROP CONSTRAINT IF EXISTS ai_memory_kind_check;
ALTER TABLE public.ai_memory ADD CONSTRAINT ai_memory_kind_check
  CHECK (kind IN (
    'experiment',
    'seo_learning',
    'conversion_pattern',
    'outcome',
    'singularity_cycle'
  ));

COMMENT ON TABLE public.ai_memory IS 'AI Memory System: eksperiment, SEO, konvertering, outcome, singularity_cycle (vekst-orkestrator).';
