-- global_content: persisted CMS globals (header / footer / settings), draft vs published.
-- Public reads: published rows only (RLS). Writes: application layer (typically service_role from API).

CREATE TABLE public.global_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL CHECK (key IN ('header', 'footer', 'settings')),
  status text NOT NULL CHECK (status IN ('draft', 'published')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT global_content_key_status_unique UNIQUE (key, status)
);

CREATE INDEX global_content_key_status_idx ON public.global_content (key, status);

ALTER TABLE public.global_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "global_content_anon_select_published"
  ON public.global_content
  FOR SELECT
  TO anon
  USING (status = 'published');

CREATE POLICY "global_content_authenticated_select"
  ON public.global_content
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "global_content_authenticated_insert"
  ON public.global_content
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "global_content_authenticated_update"
  ON public.global_content
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "global_content_authenticated_delete"
  ON public.global_content
  FOR DELETE
  TO authenticated
  USING (true);
