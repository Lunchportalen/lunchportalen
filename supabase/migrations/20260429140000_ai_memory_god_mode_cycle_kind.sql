-- God Mode / business engine: one ai_memory row per cron cycle (state, leaks, pricing suggestions, strategy, executed).

ALTER TABLE public.ai_memory DROP CONSTRAINT IF EXISTS ai_memory_kind_check;
ALTER TABLE public.ai_memory ADD CONSTRAINT ai_memory_kind_check
  CHECK (kind IN (
    'experiment',
    'seo_learning',
    'conversion_pattern',
    'outcome',
    'singularity_cycle',
    'god_mode_cycle'
  ));

COMMENT ON TABLE public.ai_memory IS 'AI Memory: experiment, SEO, conversion, outcome, singularity_cycle, god_mode_cycle.';
