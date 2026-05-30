-- Add status and timestamps to content_pages for backoffice persistence API.
alter table public.content_pages
  add column if not exists status text not null default 'draft' check (status in ('draft','published')),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz null,
  add column if not exists published_at timestamptz null;
