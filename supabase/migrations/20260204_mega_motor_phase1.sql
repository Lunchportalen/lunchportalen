-- supabase/migrations/20260204_mega_motor_phase1.sql
create extension if not exists "pgcrypto";

create table if not exists public.system_health_snapshots (
  id bigserial primary key,
  ts timestamptz not null default now(),
  status text not null,
  checks jsonb not null default '{}'::jsonb,
  rid text
);

create table if not exists public.system_incidents (
  id uuid primary key default gen_random_uuid(),
  severity text not null,
  type text not null,
  scope_company_id uuid null,
  scope_user_id uuid null,
  scope_order_id uuid null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  count int not null default 1,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  rid text
);

create table if not exists public.repair_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  payload jsonb not null default '{}'::jsonb,
  state text not null,
  attempts int not null default 0,
  next_run_at timestamptz not null default now(),
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rid text
);

create table if not exists public.ops_events (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  level text not null,
  event text not null,
  scope_company_id uuid null,
  scope_user_id uuid null,
  data jsonb not null default '{}'::jsonb,
  rid text
);

create index if not exists system_health_snapshots_ts_idx on public.system_health_snapshots (ts desc);
create index if not exists system_incidents_status_idx on public.system_incidents (status);
create index if not exists system_incidents_type_idx on public.system_incidents (type);
create index if not exists ops_events_ts_idx on public.ops_events (ts desc);
