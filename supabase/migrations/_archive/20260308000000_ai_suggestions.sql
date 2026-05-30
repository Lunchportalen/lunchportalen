-- Phase 26: AI suggestions store

create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid null references public.content_pages(id) on delete set null,
  variant_id uuid null references public.content_page_variants(id) on delete set null,
  environment text not null check (environment in ('prod','staging','preview')),
  locale text not null,
  tool text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  status text not null check (status in ('proposed','applied','discarded')) default 'proposed',
  created_by text null,
  created_at timestamptz not null default now(),
  applied_at timestamptz null,
  discarded_at timestamptz null
);

create index if not exists ai_suggestions_created_at_idx on public.ai_suggestions (created_at desc);
create index if not exists ai_suggestions_page_variant_idx on public.ai_suggestions (page_id, variant_id, created_at desc);
create index if not exists ai_suggestions_status_idx on public.ai_suggestions (status, created_at desc);

alter table public.ai_suggestions enable row level security;

drop policy if exists ai_suggestions_all_superadmin on public.ai_suggestions;
create policy ai_suggestions_all_superadmin on public.ai_suggestions
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));