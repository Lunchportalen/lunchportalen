-- supabase/migrations/20260204_mega_motor_phase2.sql
create extension if not exists "pgcrypto";

alter table if exists public.repair_jobs
  alter column state set default 'pending';

create index if not exists repair_jobs_state_next_run_idx on public.repair_jobs (state, next_run_at);

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
