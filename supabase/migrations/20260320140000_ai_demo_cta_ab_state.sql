-- A/B-vekter for offentlig AI-demo CTA (server-styrt, auto-rebalansert).
create table if not exists public.ai_demo_cta_ab_state (
  experiment_key text primary key,
  weights jsonb not null,
  last_rebalanced_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_demo_cta_ab_state_weights_object check (jsonb_typeof(weights) = 'object')
);

alter table public.ai_demo_cta_ab_state enable row level security;

revoke all on public.ai_demo_cta_ab_state from anon, authenticated;

insert into public.ai_demo_cta_ab_state (experiment_key, weights, last_rebalanced_at, updated_at)
values ('demo_cta_v1', '{"a":0.5,"b":0.5}'::jsonb, now(), now())
on conflict (experiment_key) do nothing;
