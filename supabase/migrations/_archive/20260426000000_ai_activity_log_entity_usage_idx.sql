-- Speed per-company AI usage aggregation (runAi / action = batch, entity_id = company)
CREATE INDEX IF NOT EXISTS ai_activity_log_entity_action_created_idx
  ON public.ai_activity_log (entity_id, action, created_at DESC);
