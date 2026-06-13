-- Add locale, environment and timestamps to content_page_variants for deterministic variant selection.
alter table public.content_page_variants
  add column if not exists locale text not null default 'nb',
  add column if not exists environment text not null default 'prod' check (environment in ('prod','staging','preview')),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz null,
  add column if not exists published_at timestamptz null;

create unique index if not exists content_page_variants_unique_page_locale_env
  on public.content_page_variants (page_id, locale, environment);
