-- Add slug, title to content_pages and body to content_page_variants for CMS to public red thread.
alter table public.content_pages
  add column if not exists slug text,
  add column if not exists title text;
alter table public.content_page_variants
  add column if not exists body jsonb;
create unique index if not exists idx_content_pages_slug on public.content_pages (slug) where slug is not null;
