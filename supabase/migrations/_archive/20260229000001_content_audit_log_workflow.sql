-- Phase 19: Content audit log for backoffice (workflow_change, publish, etc.). Superadmin-only.

create table if not exists public.content_audit_log (
  id uuid primary key default gen_random_uuid(),
  page_id uuid null references public.content_pages(id) on delete set null,
  variant_id uuid null references public.content_page_variants(id) on delete set null,
  environment text null,
  locale text null,
  action text not null check (action in ('workflow_change','publish','expire','workflow_blocked')),
  actor_email text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_content_audit_created_at on public.content_audit_log (created_at desc);
create index idx_content_audit_variant on public.content_audit_log (variant_id, created_at desc);

alter table public.content_audit_log enable row level security;
create policy content_audit_log_select_superadmin on public.content_audit_log for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));
create policy content_audit_log_insert_superadmin on public.content_audit_log for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));
revoke all on public.content_audit_log from anon, authenticated;
grant select, insert on public.content_audit_log to authenticated;