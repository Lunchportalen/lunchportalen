-- Append-only observability stream: metrics, events, decisions, traces (service-role writes; superadmin read via app gate).

CREATE TABLE IF NOT EXISTS public.ai_observability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('metric', 'event', 'decision', 'trace')),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_observability_created_at ON public.ai_observability (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_observability_type ON public.ai_observability (type);

COMMENT ON TABLE public.ai_observability IS 'AI / ops observability: KPI snapshots, events, decisions, action traces. Prefer bounded reads; optional persist via AI_OBSERVABILITY_PERSIST.';

ALTER TABLE public.ai_observability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_observability_superadmin ON public.ai_observability;
CREATE POLICY ai_observability_superadmin ON public.ai_observability
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  );
