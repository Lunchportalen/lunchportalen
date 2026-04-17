-- Defense-in-depth: eksplisitt service_role-tilgang på kjerne tabeller (PostgREST bypasser ofte RLS for service_role;
-- dette sikrer også direkte SQL-klienter og fremtidige endringer).

begin;

-- social_posts
drop policy if exists social_posts_service_role_full on public.social_posts;
create policy social_posts_service_role_full
  on public.social_posts
  for all
  to service_role
  using (true)
  with check (true);

-- lead_pipeline
drop policy if exists lead_pipeline_service_role_full on public.lead_pipeline;
create policy lead_pipeline_service_role_full
  on public.lead_pipeline
  for all
  to service_role
  using (true)
  with check (true);

-- orders (tillegg til eksisterende tenant policies)
drop policy if exists orders_service_role_full on public.orders;
create policy orders_service_role_full
  on public.orders
  for all
  to service_role
  using (true)
  with check (true);

-- ai_activity_log
drop policy if exists ai_activity_log_service_role_full on public.ai_activity_log;
create policy ai_activity_log_service_role_full
  on public.ai_activity_log
  for all
  to service_role
  using (true)
  with check (true);

commit;
