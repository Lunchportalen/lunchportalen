-- Enterprise security audit trail: append-only, tenant-scoped read, writes via service role only.

begin;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on update cascade on delete set null,
  user_id uuid references auth.users (id) on update cascade on delete set null,
  action text not null,
  resource text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_nonempty check (char_length(trim(action)) > 0),
  constraint audit_logs_resource_nonempty check (char_length(trim(resource)) > 0)
);

create index if not exists audit_logs_company_created_idx
  on public.audit_logs (company_id, created_at desc);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

comment on table public.audit_logs is 'SOC2-oriented append-only security audit; INSERT via service role; SELECT via RLS.';

alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from authenticated;
grant select on public.audit_logs to authenticated;

drop policy if exists audit_logs_select_company_admin on public.audit_logs;
create policy audit_logs_select_company_admin
  on public.audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'company_admin'
        and p.company_id is not null
        and audit_logs.company_id is not distinct from p.company_id
    )
  );

drop policy if exists audit_logs_select_superadmin on public.audit_logs;
create policy audit_logs_select_superadmin
  on public.audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'superadmin'
    )
  );

-- Append-only at database level (blocks UPDATE/DELETE including accidental service misuse)
create or replace function public.audit_logs_reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;

drop trigger if exists audit_logs_reject_update on public.audit_logs;
create trigger audit_logs_reject_update
  before update on public.audit_logs
  for each row
  execute function public.audit_logs_reject_mutation();

drop trigger if exists audit_logs_reject_delete on public.audit_logs;
create trigger audit_logs_reject_delete
  before delete on public.audit_logs
  for each row
  execute function public.audit_logs_reject_mutation();

commit;
