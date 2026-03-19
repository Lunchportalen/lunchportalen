-- Phase 20: Content releases. Superadmin-only.
create table if not exists public.content_pages ( id uuid primary key default gen_random_uuid() );
create table if not exists public.content_page_variants ( id uuid primary key default gen_random_uuid(), page_id uuid references public.content_pages(id) on delete cascade );
create table if not exists public.content_releases ( id uuid primary key default gen_random_uuid(), name text not null, environment text not null check (environment in ('prod','staging')), status text not null check (status in ('draft','scheduled','executed','cancelled')), publish_at timestamptz null, created_by text null, created_at timestamptz not null default now(), updated_at timestamptz not null default now() );
create index if not exists idx_releases_env_status_publish_at on public.content_releases (environment, status, publish_at);
create index if not exists idx_releases_created_at on public.content_releases (created_at desc);
alter table public.content_releases enable row level security;
drop policy if exists content_releases_select_superadmin on public.content_releases;
create policy content_releases_select_superadmin on public.content_releases for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));
drop policy if exists content_releases_all_superadmin on public.content_releases;
create policy content_releases_all_superadmin on public.content_releases for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));
revoke all on public.content_releases from anon, authenticated;
grant select, insert, update on public.content_releases to authenticated;
create table if not exists public.content_release_items ( id uuid primary key default gen_random_uuid(), release_id uuid not null references public.content_releases(id) on delete cascade, variant_id uuid not null references public.content_page_variants(id) on delete cascade, page_id uuid not null references public.content_pages(id) on delete cascade, locale text not null, environment text not null, created_at timestamptz not null default now(), unique(release_id, variant_id) );
create index if not exists idx_release_items_release on public.content_release_items (release_id);
create index if not exists idx_release_items_variant on public.content_release_items (variant_id);
alter table public.content_release_items enable row level security;
drop policy if exists content_release_items_select_superadmin on public.content_release_items;
create policy content_release_items_select_superadmin on public.content_release_items for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));
drop policy if exists content_release_items_all_superadmin on public.content_release_items;
create policy content_release_items_all_superadmin on public.content_release_items for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'superadmin'));
revoke all on public.content_release_items from anon, authenticated;
grant select, insert, update, delete on public.content_release_items to authenticated;

