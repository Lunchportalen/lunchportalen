-- Langtidsminne for AI: eksperimentresultater, SEO-læring, konverteringsmønstre.
-- Én tabell med kind + payload; scope valgfritt (page_id, company_id).

CREATE TABLE IF NOT EXISTS public.ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('experiment', 'seo_learning', 'conversion_pattern')),
  payload jsonb NOT NULL DEFAULT '{}',
  page_id uuid NULL REFERENCES public.content_pages(id) ON DELETE SET NULL,
  company_id uuid NULL REFERENCES public.companies(id) ON DELETE SET NULL,
  source_rid text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_memory_kind ON public.ai_memory (kind);
CREATE INDEX IF NOT EXISTS ai_memory_page_id ON public.ai_memory (page_id);
CREATE INDEX IF NOT EXISTS ai_memory_company_id ON public.ai_memory (company_id);
CREATE INDEX IF NOT EXISTS ai_memory_created_at ON public.ai_memory (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_memory_source_rid ON public.ai_memory (source_rid) WHERE source_rid IS NOT NULL;

COMMENT ON TABLE public.ai_memory IS 'AI langtidsminne: eksperimentresultater, SEO-læring, konverteringsmønstre. kind + payload; superadmin-only.';

ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_memory_superadmin ON public.ai_memory;
CREATE POLICY ai_memory_superadmin ON public.ai_memory
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  );
