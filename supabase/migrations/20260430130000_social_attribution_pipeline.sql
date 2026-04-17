-- Additive: SoMe → lead → ordre-kobling + utvidet ai_activity_log for sporbarhet.
-- Ingen sletting av eksisterende data.

begin;

-- lead_pipeline: dedup på e-post (valgfritt felt)
alter table if exists public.lead_pipeline
  add column if not exists contact_email text null;

create unique index if not exists lead_pipeline_contact_email_lower_uq
  on public.lead_pipeline (lower(trim(contact_email)))
  where contact_email is not null and length(trim(contact_email)) > 0;

-- social_posts: én-til-én kobling til pipeline-rad (valgfritt)
alter table if exists public.social_posts
  add column if not exists lead_id uuid null references public.lead_pipeline (id) on delete set null;

create index if not exists social_posts_lead_id_idx on public.social_posts (lead_id) where lead_id is not null;

-- orders: direkte FK til SoMe-post (komplement til orders.attribution jsonb)
alter table if exists public.orders
  add column if not exists social_post_id text null references public.social_posts (id) on delete set null;

create index if not exists orders_social_post_id_idx on public.orders (social_post_id) where social_post_id is not null;

comment on column public.orders.social_post_id is
  'Valgfri FK til social_posts.id — speiler typisk orders.attribution.postId for spørringer og rapporter.';

-- ai_activity_log: nye handlinger (klikk + konvertering)
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
    'conversion'
  ));

commit;

-- Validering (kjør manuelt etter migrering):
-- select sp.id, count(o.id) as orders
-- from public.social_posts sp
-- left join public.orders o on o.social_post_id = sp.id
-- group by sp.id;
