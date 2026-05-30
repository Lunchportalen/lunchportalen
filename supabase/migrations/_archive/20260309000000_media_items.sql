-- Phase 32 Media: public.media_items (images only), superadmin-only RLS

CREATE TABLE IF NOT EXISTS public.media_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('image')),
  status text NOT NULL CHECK (status IN ('proposed', 'ready', 'failed')) DEFAULT 'ready',
  source text NOT NULL CHECK (source IN ('upload', 'ai')) DEFAULT 'upload',
  url text NOT NULL,
  alt text NOT NULL DEFAULT '',
  caption text,
  width int,
  height int,
  mime_type text,
  bytes bigint,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_items_created_at_idx ON public.media_items (created_at DESC);
CREATE INDEX IF NOT EXISTS media_items_source_status_idx ON public.media_items (source, status, created_at DESC);

ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS media_items_superadmin_only ON public.media_items;
CREATE POLICY media_items_superadmin_only ON public.media_items
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin')
  );