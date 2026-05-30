-- Unified intelligence event log: single append-only stream for GTM, revenue, design, conversions, experiments.
-- Server writes via service role (API routes). RLS: superadmin full; company_admin scoped to own company_id or global (NULL).

CREATE TABLE IF NOT EXISTS public.ai_intelligence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  source text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  page_id uuid NULL REFERENCES public.content_pages(id) ON DELETE SET NULL,
  company_id uuid NULL REFERENCES public.companies(id) ON DELETE SET NULL,
  source_rid text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_intelligence_events_type_created ON public.ai_intelligence_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_intelligence_events_company_created ON public.ai_intelligence_events (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_intelligence_events_created ON public.ai_intelligence_events (created_at DESC);

COMMENT ON TABLE public.ai_intelligence_events IS 'Global structured intelligence events: GTM outcomes, conversions, revenue snapshots, design changes, experiment notes — single learning stream.';

ALTER TABLE public.ai_intelligence_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_intelligence_events_superadmin ON public.ai_intelligence_events;
CREATE POLICY ai_intelligence_events_superadmin ON public.ai_intelligence_events
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  );

DROP POLICY IF EXISTS ai_intelligence_events_company_admin ON public.ai_intelligence_events;
CREATE POLICY ai_intelligence_events_company_admin ON public.ai_intelligence_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'company_admin'
      AND (
        ai_intelligence_events.company_id IS NULL
        OR ai_intelligence_events.company_id = p.company_id
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'company_admin'
      AND (
        ai_intelligence_events.company_id IS NULL
        OR ai_intelligence_events.company_id = p.company_id
      )
    )
  );
