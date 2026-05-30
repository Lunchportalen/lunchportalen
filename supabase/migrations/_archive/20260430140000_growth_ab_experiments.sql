-- Additive: SoMe A/B (innhold) + vekst-mønstre i ai_activity_log.
-- social_posts.id er text (ikke uuid) — FK følger det.

begin;

create table if not exists public.ab_experiments (
  id uuid primary key default gen_random_uuid(),
  name text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  created_at timestamptz not null default now()
);

create index if not exists ab_experiments_status_idx on public.ab_experiments (status);
create index if not exists ab_experiments_created_at_idx on public.ab_experiments (created_at desc);

create table if not exists public.ab_variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.ab_experiments (id) on delete cascade,
  social_post_id text not null references public.social_posts (id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  constraint ab_variants_experiment_social_uq unique (experiment_id, social_post_id)
);

create index if not exists ab_variants_experiment_id_idx on public.ab_variants (experiment_id);
create index if not exists ab_variants_social_post_id_idx on public.ab_variants (social_post_id);

alter table public.ab_experiments enable row level security;
alter table public.ab_variants enable row level security;

comment on table public.ab_experiments is 'SoMe A/B-eksperimenter (vekst). Status draft|active|paused|completed.';
comment on table public.ab_variants is 'Variant per eksperiment; koblet til konkret social_posts-rad (innhold/arm).';

-- ai_activity_log: læringsmønstre fra vekst-motoren
alter table public.ai_activity_log drop constraint if exists ai_activity_log_action_check;
alter table public.ai_activity_log add constraint ai_activity_log_action_check
  check (action in (
    'suggest',
    'suggest_failed',
    'apply',
    'job_completed',
    'job_failed',
    'agent_run',
    'experiment_event',
    'editor_ai_metric',
    'design_suggestions_generated',
    'page_compose',
    'seo_intelligence_scored',
    'design_suggestion_applied',
    'text_improve',
    'cta_improve',
    'block_build',
    'image_prompts',
    'image_metadata',
    'improve',
    'audit',
    'image',
    'batch',
    'social_click',
    'conversion',
    'learning_pattern'
  ));

commit;
