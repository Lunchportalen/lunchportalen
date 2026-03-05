-- Phase 41: Knowledge graph. Superadmin-only RLS.

CREATE TABLE IF NOT EXISTS public.entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.entity_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity uuid REFERENCES public.entities(id) ON DELETE CASCADE,
  target_entity uuid REFERENCES public.entities(id) ON DELETE CASCADE,
  relation text NOT NULL
);

CREATE INDEX IF NOT EXISTS entities_name_type_idx ON public.entities (name, type);
CREATE INDEX IF NOT EXISTS entity_relations_source_idx ON public.entity_relations (source_entity);
CREATE INDEX IF NOT EXISTS entity_relations_target_idx ON public.entity_relations (target_entity);

ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_relations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS entities_superadmin_only ON public.entities;
CREATE POLICY entities_superadmin_only ON public.entities FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin'));

DROP POLICY IF EXISTS entity_relations_superadmin_only ON public.entity_relations;
CREATE POLICY entity_relations_superadmin_only ON public.entity_relations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'superadmin'));