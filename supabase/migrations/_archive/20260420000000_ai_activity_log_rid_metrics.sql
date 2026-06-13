-- Lightweight route metrics: rid, block/node refs, status, duration (ms). Extends action allowlist for /api/ai/* helpers.
ALTER TABLE public.ai_activity_log
  ADD COLUMN IF NOT EXISTS rid text null,
  ADD COLUMN IF NOT EXISTS block_id text null,
  ADD COLUMN IF NOT EXISTS node_id text null,
  ADD COLUMN IF NOT EXISTS status text null,
  ADD COLUMN IF NOT EXISTS duration_ms integer null;

ALTER TABLE public.ai_activity_log DROP CONSTRAINT IF EXISTS ai_activity_log_ai_route_status_check;
ALTER TABLE public.ai_activity_log ADD CONSTRAINT ai_activity_log_ai_route_status_check
  CHECK (status IS NULL OR status IN ('success', 'error'));

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
    'batch'
  ));

CREATE INDEX IF NOT EXISTS ai_activity_log_rid_idx ON public.ai_activity_log (rid) WHERE rid IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_activity_log_action_status_created_idx ON public.ai_activity_log (action, status, created_at DESC);
