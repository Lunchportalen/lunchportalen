-- Phase 38: Content health scoring. Superadmin-only RLS.

CREATE TABLE IF NOT EXISTS public.content_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id uuid NULL,
  variant_id uuid NULL,
  score int NOT NULL,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_health_page_variant_idx ON public.content_health (page_id, variant_id, created_at DESC);

ALTER TABLE public.content_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_health_superadmin_only ON public.content_health;
CREATE POLICY content_health_superadmin_only ON public.content_health
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  );