-- Create the DB mirror used by week menu visibility controls.
-- Sanity remains the source of menu content; this table stores only date-level visibility state.

CREATE TABLE IF NOT EXISTS public.menu_visibility_days (
  date date PRIMARY KEY,
  is_published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.menu_visibility_days ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS menu_visibility_days_is_published_idx
  ON public.menu_visibility_days (is_published);

CREATE INDEX IF NOT EXISTS menu_visibility_days_updated_at_idx
  ON public.menu_visibility_days (updated_at DESC);
