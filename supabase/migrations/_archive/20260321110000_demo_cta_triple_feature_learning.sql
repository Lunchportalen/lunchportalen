-- Full triple patterns: tone + verb + framing in feature_learning.
update public.ai_demo_cta_ab_state
set
  feature_learning =
    coalesce(feature_learning, '{}'::jsonb)
    || jsonb_build_object(
      'tone_verb_framing',
      coalesce((coalesce(feature_learning, '{}'::jsonb) -> 'tone_verb_framing'), '{}'::jsonb)
    ),
  updated_at = now()
where experiment_key = 'demo_cta_v1';
