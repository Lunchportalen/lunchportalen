-- Enable RLS for public tables that were exposed without row-level security.
-- WARNING: `backoffice` is not a valid value in public.user_role as defined in
-- 20260201000000_legacy_bootstrap_minimal.sql. Content/backoffice tables are
-- therefore restricted to superadmin until a canonical backoffice role exists.

begin;

-- GRUPPE A: superadmin only
alter table public.agreement_cleanup_audit enable row level security;
drop policy if exists "superadmin_only" on public.agreement_cleanup_audit;
create policy "superadmin_only" on public.agreement_cleanup_audit
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'superadmin'
    )
  );

alter table public.agreement_requests enable row level security;
drop policy if exists "superadmin_only" on public.agreement_requests;
create policy "superadmin_only" on public.agreement_requests
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'superadmin'
    )
  );

alter table public.lead_pipeline enable row level security;
drop policy if exists "superadmin_only" on public.lead_pipeline;
create policy "superadmin_only" on public.lead_pipeline
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'superadmin'
    )
  );

-- GRUPPE B: superadmin only until `backoffice` exists as a canonical role
alter table public.content_pages enable row level security;
drop policy if exists "superadmin_only" on public.content_pages;
create policy "superadmin_only" on public.content_pages
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'superadmin'
    )
  );

alter table public.content_page_variants enable row level security;
drop policy if exists "superadmin_only" on public.content_page_variants;
create policy "superadmin_only" on public.content_page_variants
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'superadmin'
    )
  );

alter table public.social_posts enable row level security;
drop policy if exists "superadmin_only" on public.social_posts;
create policy "superadmin_only" on public.social_posts
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'superadmin'
    )
  );

-- GRUPPE C: service_role only. No policies means normal JWT clients have no direct access.
alter table public._migration_legacy_stub_invoice_lines_archive enable row level security;
alter table public._migration_legacy_stub_order_items_archive enable row level security;
alter table public._migration_legacy_stub_orders_archive enable row level security;
alter table public._migration_legacy_stub_orders_manifest enable row level security;
alter table public._migration_orders_location_id_backup enable row level security;

commit;
