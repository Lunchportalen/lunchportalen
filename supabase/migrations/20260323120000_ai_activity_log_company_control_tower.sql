-- Company Control Tower audit actions (deterministic AI layer; no silent execution without log).
ALTER TABLE public.ai_activity_log DROP CONSTRAINT IF EXISTS ai_activity_log_action_check;
ALTER TABLE public.ai_activity_log ADD CONSTRAINT ai_activity_log_action_check
  CHECK (action IN (
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
    'company_control_tower_run',
    'company_control_tower_act',
    'company_control_tower_execute'
  ));
