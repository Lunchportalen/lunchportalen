-- Additive: markedsisolering (market_id) + ai_activity_log.global_learning.

begin;

alter table if exists public.social_posts add column if not exists market_id text;
alter table if exists public.orders add column if not exists market_id text;
alter table if exists public.lead_pipeline add column if not exists market_id text;

comment on column public.social_posts.market_id is 'Markeds-ID (f.eks. NO) — ingen blind mixing på tvers.';
comment on column public.orders.market_id is 'Markeds-ID for ordre (vekst/MVO/global læring).';
comment on column public.lead_pipeline.market_id is 'Markeds-ID for lead (isolert pipeline).';

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
    'learning_pattern',
    'budget_allocation',
    'valuation_run',
    'order_attributed',
    'lead_closed',
    'deal_prioritized',
    'pipeline_action_executed',
    'sales_loop_run',
    'sales_loop_draft_saved',
    'closing_suggested',
    'objection_handled',
    'objection_reply_logged',
    'sequence_step',
    'revenue_autopilot_run',
    'multi_channel_analysis',
    'market_expansion',
    'mvo_learning',
    'global_learning'
  ));

commit;
