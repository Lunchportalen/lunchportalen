-- Optional audit trail for autonomy layer (decision + automation preview/execute).
-- No automatic inserts from app in v1 — table ready for superadmin tooling / future worker.
create table if not exists public.ai_autonomy_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  decision_type text not null,
  recommendation text not null,
  confidence double precision null,
  mode text not null check (mode in ('preview', 'execute')),
  executed boolean not null default false,
  approved boolean null,
  policy_explain text null,
  action_preview text null,
  result_explain text null,
  based_on jsonb not null default '[]'::jsonb,
  rid text null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ai_autonomy_audit_created_at_idx on public.ai_autonomy_audit (created_at desc);
create index if not exists ai_autonomy_audit_decision_type_idx on public.ai_autonomy_audit (decision_type);

alter table public.ai_autonomy_audit enable row level security;

drop policy if exists ai_autonomy_audit_all_superadmin on public.ai_autonomy_audit;
create policy ai_autonomy_audit_all_superadmin on public.ai_autonomy_audit
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));

comment on table public.ai_autonomy_audit is 'Autonomy decisions and automation outcomes; superadmin-only; no auto-spend or publish.';
