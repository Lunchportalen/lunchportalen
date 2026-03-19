-- Stable page identity for backoffice tree and bindings.
-- Adds page_key to content_pages and backfills known system pages.
-- page_key is used as authoritative classification instead of mutable slug strings.

alter table public.content_pages
  add column if not exists page_key text;

-- Backfill known system pages by their current slugs.
update public.content_pages
set page_key = 'home'
where slug = 'home' and (page_key is null or page_key = '');

update public.content_pages
set page_key = 'employee_week'
where slug = 'week' and (page_key is null or page_key = '');

update public.content_pages
set page_key = 'superadmin'
where slug = 'superadmin' and (page_key is null or page_key = '');

update public.content_pages
set page_key = 'company_admin'
where slug = 'company-admin' and (page_key is null or page_key = '');

update public.content_pages
set page_key = 'kitchen'
where slug = 'kitchen' and (page_key is null or page_key = '');

update public.content_pages
set page_key = 'driver'
where slug = 'driver' and (page_key is null or page_key = '');

update public.content_pages
set page_key = 'overlay_dashboard'
where slug = 'dashboard' and (page_key is null or page_key = '');

update public.content_pages
set page_key = 'global_header'
where slug = 'header' and (page_key is null or page_key = '');

update public.content_pages
set page_key = 'global_footer'
where slug = 'footer' and (page_key is null or page_key = '');

update public.content_pages
set page_key = 'design_tokens'
where slug = 'design-tokens' and (page_key is null or page_key = '');

