-- Phase 43A: AI jobs retry/backoff and safe claiming.

ALTER TABLE public.ai_jobs
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts int NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_by text NULL,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS ai_jobs_next_run_idx
  ON public.ai_jobs (status, next_run_at, created_at DESC);

-- Atomic claim: update pending jobs and return claimed rows.
CREATE OR REPLACE FUNCTION public.claim_ai_jobs(p_limit int, p_runner_id text)
RETURNS SETOF public.ai_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH claimed AS (
    SELECT id FROM public.ai_jobs
    WHERE status = 'pending'
      AND next_run_at <= now()
      AND (locked_at IS NULL OR locked_at < now() - interval '15 minutes')
    ORDER BY created_at ASC
    LIMIT GREATEST(1, LEAST(p_limit, 50))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.ai_jobs j
  SET
    status = 'running',
    started_at = COALESCE(j.started_at, now()),
    locked_by = p_runner_id,
    locked_at = now()
  FROM claimed c
  WHERE j.id = c.id
  RETURNING j.*;
$$;