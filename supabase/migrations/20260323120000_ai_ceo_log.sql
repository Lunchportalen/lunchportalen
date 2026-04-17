-- Controlled AI CEO layer: append-only audit trail (service role / admin client writes).
create table if not exists public.ai_ceo_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  rid text not null default '',
  entry_type text not null,
  actor_user_id uuid null,
  company_id uuid null references public.companies (id) on delete set null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists ai_ceo_log_created_at_idx on public.ai_ceo_log (created_at desc);
create index if not exists ai_ceo_log_entry_type_idx on public.ai_ceo_log (entry_type);
create index if not exists ai_ceo_log_rid_idx on public.ai_ceo_log (rid);

alter table public.ai_ceo_log enable row level security;

drop policy if exists ai_ceo_log_superadmin_all on public.ai_ceo_log;
create policy ai_ceo_log_superadmin_all on public.ai_ceo_log
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));

revoke all on public.ai_ceo_log from anon;
grant select, insert, update, delete on public.ai_ceo_log to authenticated;
