-- Lærte A/B-vekter per kontekst (enhet + trafikkilde) for offentlig AI-demo-funnel.
create table if not exists public.ai_demo_ab_context_state (
  experiment_key text not null,
  device_seg text not null,
  source_seg text not null,
  weights jsonb not null,
  winning_variant text null,
  impressions_total bigint not null default 0,
  last_rebalanced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (experiment_key, device_seg, source_seg),
  constraint ai_demo_ab_context_weights_object check (jsonb_typeof(weights) = 'object')
);

create index if not exists idx_ai_demo_ab_context_updated on public.ai_demo_ab_context_state (updated_at desc);

alter table public.ai_demo_ab_context_state enable row level security;

revoke all on public.ai_demo_ab_context_state from anon, authenticated;
