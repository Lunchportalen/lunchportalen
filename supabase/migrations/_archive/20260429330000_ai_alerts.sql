-- Anomaly / alerting audit trail (service-role inserts from cron; superadmin policy for JWT clients).

CREATE TABLE IF NOT EXISTS public.ai_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_alerts_created_at ON public.ai_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_alerts_type ON public.ai_alerts (type);

COMMENT ON TABLE public.ai_alerts IS 'AI monitoring: anomaly types + snapshot payload; append-only audit.';

ALTER TABLE public.ai_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_alerts_superadmin ON public.ai_alerts;
CREATE POLICY ai_alerts_superadmin ON public.ai_alerts
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  );
