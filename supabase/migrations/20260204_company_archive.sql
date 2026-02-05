-- supabase/migrations/20260204_company_archive.sql
create extension if not exists "pgcrypto";

alter table public.companies
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists delete_reason text;

alter table public.profiles
  add column if not exists archived_at timestamptz;

create table if not exists public.company_deletions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  company_name_snapshot text,
  orgnr_snapshot text,
  deleted_at timestamptz not null default now(),
  deleted_by uuid,
  reason text,
  counts_json jsonb not null default '{}'::jsonb,
  mode text not null default 'archive+kill-access'
);

create unique index if not exists company_deletions_company_id_uq on public.company_deletions (company_id);
create index if not exists company_deletions_deleted_at_idx on public.company_deletions (deleted_at desc);
