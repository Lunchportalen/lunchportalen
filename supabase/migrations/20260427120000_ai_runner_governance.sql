-- Per-company + platform governance for unified AI runner (blocks, model tier, notes).
-- Enforced in lib/ai/runner.ts and backoffice suggest; mutations via POST /api/ai/recommendation/apply (superadmin).

begin;

alter table public.companies
  add column if not exists ai_runner_governance jsonb not null default '{}'::jsonb;

comment on column public.companies.ai_runner_governance is
  'Runner governance: { "model_tier": "default"|"economy", "blocked_tools": string[], "policy_notes": string }.';

create table if not exists public.ai_platform_governance (
  id smallint primary key default 1,
  constraint ai_platform_governance_single_row check (id = 1),
  data jsonb not null default '{"blocked_tools":[],"policy_notes":null}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.ai_platform_governance (id, data)
values (1, '{"blocked_tools":[],"policy_notes":null}'::jsonb)
on conflict (id) do nothing;

alter table public.ai_platform_governance enable row level security;

comment on table public.ai_platform_governance is
  'Singleton (id=1): platform-wide runner blocks and notes; superadmin-only writes via service role.';

commit;
