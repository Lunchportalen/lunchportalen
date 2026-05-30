-- Seed fixed Backoffice Content tree pages so every tree node has a real content_page (no 404 on by-slug).
-- Idempotent: inserts only when slug missing; adds nb/prod variant per page when missing.
-- Slugs match tree: home, app-overlay-*, header, footer, design-tokens, global, design.

insert into public.content_pages (title, slug, status, updated_at)
values
  ('Hjem', 'home', 'draft', now()),
  ('Week (overlay)', 'app-overlay-week', 'draft', now()),
  ('Dashboard (overlay)', 'app-overlay-dashboard', 'draft', now()),
  ('Company Admin (overlay)', 'app-overlay-company-admin', 'draft', now()),
  ('Superadmin (overlay)', 'app-overlay-superadmin', 'draft', now()),
  ('Kitchen (overlay)', 'app-overlay-kitchen', 'draft', now()),
  ('Driver (overlay)', 'app-overlay-driver', 'draft', now()),
  ('Global', 'global', 'draft', now()),
  ('Design', 'design', 'draft', now()),
  ('Header', 'header', 'draft', now()),
  ('Footer', 'footer', 'draft', now()),
  ('Design tokens', 'design-tokens', 'draft', now())
on conflict (slug) do nothing;

insert into public.content_page_variants (page_id, locale, environment, body, updated_at)
select p.id, 'nb', 'prod', '{"version":1,"blocks":[]}'::jsonb, now()
from public.content_pages p
where p.slug in (
  'home',
  'app-overlay-week',
  'app-overlay-dashboard',
  'app-overlay-company-admin',
  'app-overlay-superadmin',
  'app-overlay-kitchen',
  'app-overlay-driver',
  'global',
  'design',
  'header',
  'footer',
  'design-tokens'
)
on conflict (page_id, locale, environment) do nothing;
