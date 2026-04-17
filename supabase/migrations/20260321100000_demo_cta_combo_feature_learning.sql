-- Combo dimensions for feature_learning (tone+verb, framing+tone). Preserves existing nested objects.
update public.ai_demo_cta_ab_state
set
  feature_learning =
    coalesce(feature_learning, '{}'::jsonb)
    || jsonb_build_object(
      'tone_verb',
      coalesce((coalesce(feature_learning, '{}'::jsonb) -> 'tone_verb'), '{}'::jsonb),
      'framing_tone',
      coalesce((coalesce(feature_learning, '{}'::jsonb) -> 'framing_tone'), '{}'::jsonb)
    ),
  updated_at = now()
where experiment_key = 'demo_cta_v1';
