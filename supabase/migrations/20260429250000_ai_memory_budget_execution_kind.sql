-- Budget execution: capital allocation → prioritized symbolic actions → safe internal execution trace.

ALTER TABLE public.ai_memory DROP CONSTRAINT IF EXISTS ai_memory_kind_check;
ALTER TABLE public.ai_memory ADD CONSTRAINT ai_memory_kind_check
  CHECK (kind IN (
    'experiment',
    'seo_learning',
    'conversion_pattern',
    'outcome',
    'singularity_cycle',
    'god_mode_cycle',
    'omniscient_cycle',
    'revenue_mode_cycle',
    'autonomous_cycle',
    'strategy_cycle',
    'org_cycle',
    'market_cycle',
    'monopoly_cycle',
    'reality_cycle',
    'control_decision',
    'budget_execution'
  ));

COMMENT ON TABLE public.ai_memory IS 'AI Memory: experiment, SEO, conversion, outcome, singularity, god_mode, omniscient, revenue_mode, autonomous_cycle, strategy_cycle, org_cycle, market_cycle, monopoly_cycle, reality_cycle, control_decision, budget_execution.';
