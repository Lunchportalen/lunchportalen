-- Additive: MVO-dimensjoner på ordre (kanal/segment/timing) + ai_activity_log for mvo_learning.

begin;

alter table if exists public.orders
  add column if not exists variant_channel text,
  add column if not exists variant_segment text,
  add column if not exists variant_timing text;

comment on column public.orders.variant_channel is 'MVO/vekst: kanal-arm (f.eks. linkedin, email).';
comment on column public.orders.variant_segment is 'MVO/vekst: segment-arm (company_size-bånd).';
comment on column public.orders.variant_timing is 'MVO/vekst: timing-arm (morning|afternoon|evening).';

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
    'mvo_learning'
  ));

commit;
