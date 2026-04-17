-- Context-aware pattern learning (full FeatureLearningState per d:device|i:intent).
alter table public.ai_demo_cta_ab_state
  add column if not exists pattern_learning_by_context jsonb;

update public.ai_demo_cta_ab_state
set
  pattern_learning_by_context = coalesce(pattern_learning_by_context, '{}'::jsonb),
  updated_at = now()
where experiment_key = 'demo_cta_v1';
