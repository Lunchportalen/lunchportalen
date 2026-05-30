-- Support live schema (entity_type, entity_id, actor_user_id) for ai_activity_log so editor-AI metrics and other flows can insert.
-- Legacy columns (environment, locale, tool) become nullable so rows from buildAiActivityLogRow (no top-level env/locale/tool) are accepted.

ALTER TABLE public.ai_activity_log
  ADD COLUMN IF NOT EXISTS entity_type text DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS entity_id text DEFAULT '',
  ADD COLUMN IF NOT EXISTS actor_user_id text DEFAULT null;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_activity_log' AND column_name = 'environment' AND is_nullable = 'NO') THEN
    ALTER TABLE public.ai_activity_log ALTER COLUMN environment DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_activity_log' AND column_name = 'locale' AND is_nullable = 'NO') THEN
    ALTER TABLE public.ai_activity_log ALTER COLUMN locale DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ai_activity_log' AND column_name = 'tool' AND is_nullable = 'NO') THEN
    ALTER TABLE public.ai_activity_log ALTER COLUMN tool DROP NOT NULL;
  END IF;
END
$$;
