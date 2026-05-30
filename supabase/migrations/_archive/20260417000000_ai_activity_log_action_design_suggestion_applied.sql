-- Fix: allow design_suggestion_applied when applying AI design suggestions.
-- POST /api/backoffice/ai/design-suggestion/log-apply inserts this action; without it the CHECK
-- constraint rejects the row and the UI shows "Kunne ikke lagre forslag (sporbarhet)".
-- Extend the existing constraint; do not remove action validation.
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
    'image_metadata'
  ));
