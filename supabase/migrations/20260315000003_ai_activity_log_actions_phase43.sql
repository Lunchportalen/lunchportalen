-- Phase 43: Extend ai_activity_log action for experiment_event.
ALTER TABLE public.ai_activity_log DROP CONSTRAINT IF EXISTS ai_activity_log_action_check;
ALTER TABLE public.ai_activity_log ADD CONSTRAINT ai_activity_log_action_check
  CHECK (action IN ('suggest', 'apply', 'job_completed', 'job_failed', 'agent_run', 'experiment_event'));