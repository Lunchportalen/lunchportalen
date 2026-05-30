-- Add editor_ai_metric to ai_activity_log action constraint (editor-AI metrics trinn 2)
ALTER TABLE public.ai_activity_log DROP CONSTRAINT IF EXISTS ai_activity_log_action_check;
ALTER TABLE public.ai_activity_log ADD CONSTRAINT ai_activity_log_action_check
  CHECK (action IN ('suggest', 'apply', 'job_completed', 'job_failed', 'agent_run', 'experiment_event', 'editor_ai_metric'));
