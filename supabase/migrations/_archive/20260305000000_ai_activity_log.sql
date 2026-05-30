-- Phase 25 Foundation: AI activity log. Superadmin-only RLS.
create table if not exists public.ai_activity_log (
  id uuid primary key default gen_random_uuid(),
  page_id uuid null references public.content_pages(id) on delete set null,
  variant_id uuid null references public.content_page_variants(id) on delete set null,
  environment text not null check (environment in ('prod','staging','preview')),
  locale text not null,
  action text not null check (action in ('suggest','apply')),
  tool text not null,
  prompt_tokens int null,
  completion_tokens int null,
  model text null,
  created_by text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_activity_log_created_at_idx on public.ai_activity_log (created_at desc);
create index if not exists ai_activity_log_page_variant_idx on public.ai_activity_log (page_id, variant_id);

alter table public.ai_activity_log enable row level security;

drop policy if exists ai_activity_log_all_superadmin on public.ai_activity_log;
create policy ai_activity_log_all_superadmin on public.ai_activity_log
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));