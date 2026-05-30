-- Phase 19: Workflow state per variant (env+locale). Superadmin-only RLS.

create table if not exists public.content_pages ( id uuid primary key default gen_random_uuid() );
create table if not exists public.content_page_variants ( id uuid primary key default gen_random_uuid(), page_id uuid references public.content_pages(id) on delete cascade );

create table if not exists public.content_workflow_state (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.content_pages(id) on delete cascade,
  variant_id uuid not null references public.content_page_variants(id) on delete cascade,
  environment text not null check (environment in ('prod','staging')),
  locale text not null,
  state text not null check (state in ('draft','review','approved','rejected')),
  updated_by text null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(variant_id, environment, locale)
);

create index if not exists idx_workflow_variant on public.content_workflow_state (variant_id);
create index if not exists idx_workflow_env_state on public.content_workflow_state (environment, state);

alter table public.content_workflow_state enable row level security;
drop policy if exists content_workflow_state_select_superadmin on public.content_workflow_state;
create policy content_workflow_state_select_superadmin on public.content_workflow_state for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));
drop policy if exists content_workflow_state_all_superadmin on public.content_workflow_state;
create policy content_workflow_state_all_superadmin on public.content_workflow_state for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));
revoke all on public.content_workflow_state from anon, authenticated;
grant select, insert, update on public.content_workflow_state to authenticated;

insert into public.content_workflow_state (page_id, variant_id, environment, locale, state)
select v.page_id, v.id, env.env, loc.locale, 'draft'
from public.content_page_variants v
cross join (values ('prod'), ('staging')) as env(env)
cross join (values ('nb'), ('en')) as loc(locale)
on conflict (variant_id, environment, locale) do nothing;