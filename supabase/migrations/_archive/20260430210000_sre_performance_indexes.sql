-- Additive SRE indexes: faster filters on hot paths (IF NOT EXISTS = safe re-run).

begin;

create index if not exists idx_orders_post on public.orders (social_post_id);

create index if not exists idx_leads_email on public.lead_pipeline (contact_email);

create index if not exists idx_logs_action on public.ai_activity_log (action);

commit;
