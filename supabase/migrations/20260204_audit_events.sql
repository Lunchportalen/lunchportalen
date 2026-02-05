-- supabase/migrations/20260204_audit_events.sql
create extension if not exists "pgcrypto";

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  rid text,
  created_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_email text,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  company_id uuid,
  location_id uuid,
  summary text,
  detail jsonb,
  scope text,
  performed_by uuid,
  metadata jsonb default '{}'::jsonb
);

create index if not exists audit_events_created_at_idx on public.audit_events (created_at desc);
create index if not exists audit_events_company_id_idx on public.audit_events (company_id);
create index if not exists audit_events_action_idx on public.audit_events (action);
