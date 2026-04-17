-- Self-learning demo CTA: feature aggregates, exploration rate, performance history, strategy mode.
alter table public.ai_demo_cta_ab_state
  add column if not exists feature_learning jsonb,
  add column if not exists exploration_rate double precision,
  add column if not exists variant_performance_history jsonb,
  add column if not exists strategy_mode text;

update public.ai_demo_cta_ab_state
set
  feature_learning = coalesce(
    feature_learning,
    '{"tone":{},"verb":{},"framing":{},"length":{}}'::jsonb
  ),
  exploration_rate = coalesce(exploration_rate, 0.14),
  variant_performance_history = coalesce(variant_performance_history, '[]'::jsonb),
  strategy_mode = coalesce(strategy_mode, 'balance'),
  updated_at = now()
where experiment_key = 'demo_cta_v1';

alter table public.ai_demo_ab_context_state
  add column if not exists intent_seg text not null default 'demo_auto';

alter table public.ai_demo_ab_context_state drop constraint if exists ai_demo_ab_context_state_pkey;

alter table public.ai_demo_ab_context_state
  add primary key (experiment_key, device_seg, source_seg, intent_seg);
