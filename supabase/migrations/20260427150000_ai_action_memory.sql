-- Short-lived automation / control-plane action marks (dedupe + audit). Snake_case columns only.
-- Inserts use service role (bypasses RLS); superadmin may read via policy.

begin;

create table if not exists public.ai_action_memory (
  id uuid primary key default gen_random_uuid(),
  action_key text not null,
  surface text not null,
  action_type text not null,
  target_id text null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_action_memory_expires_at_idx on public.ai_action_memory (expires_at desc);
create index if not exists ai_action_memory_action_key_idx on public.ai_action_memory (action_key);
create index if not exists ai_action_memory_surface_created_idx on public.ai_action_memory (surface, created_at desc);

comment on table public.ai_action_memory is
  'Automation AI action marks: action_key, surface, action_type, target_id, expires_at (snake_case).';

alter table public.ai_action_memory enable row level security;

drop policy if exists ai_action_memory_superadmin on public.ai_action_memory;
create policy ai_action_memory_superadmin on public.ai_action_memory
  for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin')
  );

commit;
