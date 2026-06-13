-- CMS AI audit: extend ai_activity_log.action so all current routes and flows use allowed values.
-- Fixes broken inserts: suggest_failed, design_suggestions_generated, page_compose, seo_intelligence_scored, design_suggestion_applied.
-- Adds actions for flows that now log: text_improve, cta_improve, block_build, image_prompts, image_metadata.
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
