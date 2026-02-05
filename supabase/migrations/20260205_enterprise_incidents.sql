-- supabase/migrations/20260205_enterprise_incidents.sql
create extension if not exists "pgcrypto";

create table if not exists public.enterprise_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  orgnr text null,
  created_at timestamptz not null default now()
);

alter table public.companies
  add column if not exists enterprise_group_id uuid null references public.enterprise_groups(id);

alter table public.company_locations
  add column if not exists name text,
  add column if not exists address text,
  add column if not exists slot_policy text,
  add column if not exists status text not null default 'ACTIVE';

create index if not exists companies_enterprise_group_id_idx on public.companies (enterprise_group_id);
create index if not exists company_locations_status_idx on public.company_locations (status);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  severity text not null,
  rid text null,
  message text not null,
  meta jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists incidents_created_at_idx on public.incidents (created_at desc);
create index if not exists incidents_severity_idx on public.incidents (severity);
create index if not exists incidents_scope_idx on public.incidents (scope);
