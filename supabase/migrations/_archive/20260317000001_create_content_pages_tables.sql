-- Create CMS content tables expected by backoffice.
-- Idempotent: uses IF NOT EXISTS for tables and indexes.

create table if not exists public.content_pages (
  id uuid primary key default gen_random_uuid(),
  title text not null default ''Ny side'',
  slug text not null,
  status text not null default ''draft'' check (status in (''draft'',''published'')),
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  published_at timestamptz null
);

create unique index if not exists content_pages_slug_unique
on public.content_pages (slug);

create table if not exists public.content_page_variants (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.content_pages(id) on delete cascade,
  locale text not null default ''nb'',
  environment text not null default ''prod'' check (environment in (''prod'',''staging'',''preview'')),
  body jsonb not null default ''{""version"":1,""blocks"":[] }''::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz null,
  published_at timestamptz null
);

create unique index if not exists content_page_variants_unique_page_locale_env
on public.content_page_variants (page_id, locale, environment);