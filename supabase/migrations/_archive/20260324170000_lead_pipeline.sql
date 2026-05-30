-- Superadmin / growth: lead-pipeline (manuell oppfølging — ingen auto-close).

create table if not exists public.lead_pipeline (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source_post_id text not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'meeting', 'closed', 'lost')),
  value_estimate numeric,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists lead_pipeline_source_post_id_idx on public.lead_pipeline (source_post_id);
create index if not exists lead_pipeline_status_idx on public.lead_pipeline (status);
create index if not exists lead_pipeline_created_at_idx on public.lead_pipeline (created_at desc);

alter table public.lead_pipeline enable row level security;
