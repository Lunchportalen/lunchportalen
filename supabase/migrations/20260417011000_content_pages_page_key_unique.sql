-- Ensure system-level page_key values are globally unique.
-- This hardens authoritative bindings for home + fixed app pages
-- so the tree API can rely on a single, deterministic row per key.

create unique index if not exists idx_content_pages_page_key_system_unique
on public.content_pages (page_key)
where page_key in (
  'home',
  'employee_week',
  'superadmin',
  'company_admin',
  'kitchen',
  'driver',
  'overlay_dashboard',
  'global_header',
  'global_footer',
  'design_tokens'
);

