-- Dynamisk CTA-katalog (frø + genererte varianter) for AI-demo A/B.
alter table public.ai_demo_cta_ab_state
  add column if not exists variant_catalog jsonb,
  add column if not exists last_spawn_at timestamptz;

update public.ai_demo_cta_ab_state
set
  variant_catalog = coalesce(
    variant_catalog,
    jsonb_build_object(
      'a',
      jsonb_build_object('label', 'Prøv med dine egne tall', 'kind', 'seed'),
      'b',
      jsonb_build_object('label', 'Start med din bedrift — se ekte oppsett', 'kind', 'seed')
    )
  ),
  updated_at = now()
where experiment_key = 'demo_cta_v1';
