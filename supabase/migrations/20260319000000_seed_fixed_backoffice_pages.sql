-- Seed fixed Backoffice Content pages (idempotent). All 9 system slugs must exist so tree click never 404s.
-- Tables: content_pages (slug unique), content_page_variants (page_id, locale, environment unique).
-- Same structure as Home: page row + one variant (nb/prod) with body.

insert into public.content_pages (title, slug, status, updated_at)
values
  ('Hjem', 'home', 'draft', now()),
  ('Week', 'week', 'draft', now()),
  ('Dashboard', 'dashboard', 'draft', now()),
  ('Company Admin', 'company-admin', 'draft', now()),
  ('Superadmin', 'superadmin', 'draft', now()),
  ('Kitchen', 'kitchen', 'draft', now()),
  ('Driver', 'driver', 'draft', now()),
  ('Global', 'global', 'draft', now()),
  ('Design', 'design', 'draft', now())
on conflict (slug) do nothing;

insert into public.content_page_variants (page_id, locale, environment, body, updated_at)
select p.id, 'nb', 'prod', '{"version":1,"blocks":[]}'::jsonb, now()
from public.content_pages p
where p.slug in ('home','week','dashboard','company-admin','superadmin','kitchen','driver','global','design')
on conflict (page_id, locale, environment) do nothing;
