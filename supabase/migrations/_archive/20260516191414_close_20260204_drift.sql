-- Forward-fix: lukker prod-drift for objekter som hører til serien
-- 20260204000001_audit_events … 20260204000005_mega_motor_phase3 (tidl. felles 20260204_-prefiks).
-- Idempotent: IF NOT EXISTS / CREATE OR REPLACE. Trygg når de fem migrasjonene allerede har kjørt
-- (f.eks. lokalt etter db reset); i prod kjører typisk kun denne fila for disse tre delene.
-- Ingen audit_events-indekser her (egen sak). Se FASE 13.5-FIX-5.
create extension if not exists "pgcrypto";

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

create or replace function public.claim_repair_jobs(p_limit int)
returns setof public.repair_jobs
language sql
as $$
  with cte as (
    select id
    from public.repair_jobs
    where state = 'pending'
      and next_run_at <= now()
    order by next_run_at asc
    limit p_limit
    for update skip locked
  )
  update public.repair_jobs
  set state = 'running',
      updated_at = now()
  where id in (select id from cte)
  returning *;
$$;

create index if not exists repair_jobs_state_next_run_idx on public.repair_jobs (state, next_run_at);
