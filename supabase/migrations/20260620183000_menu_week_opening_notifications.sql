-- WS-3: Menu week-opening notifications (channel-agnostic prefs + idempotent send log)

CREATE TABLE IF NOT EXISTS public.employee_notification_preferences (
  user_id uuid NOT NULL,
  menu_week_opening_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_notification_preferences_pkey PRIMARY KEY (user_id),
  CONSTRAINT employee_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE
);

COMMENT ON TABLE public.employee_notification_preferences IS 'Per-employee notification prefs (channel-agnostic; send log carries channel).';
COMMENT ON COLUMN public.employee_notification_preferences.menu_week_opening_enabled IS 'Default true when row missing. Controls week-opening menu notify (email today; push later).';

CREATE TABLE IF NOT EXISTS public.menu_week_opening_send_log (
  user_id uuid NOT NULL,
  event_key text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_week_opening_send_log_pkey PRIMARY KEY (user_id, event_key, channel),
  CONSTRAINT menu_week_opening_send_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT menu_week_opening_send_log_channel_chk CHECK (char_length(channel) > 0 AND char_length(channel) <= 32)
);

COMMENT ON TABLE public.menu_week_opening_send_log IS 'Idempotent send ledger: one row per employee × week-opening event × channel.';

CREATE INDEX IF NOT EXISTS menu_week_opening_send_log_event_key_idx ON public.menu_week_opening_send_log (event_key, channel);

ALTER TABLE public.employee_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_notification_preferences FORCE ROW LEVEL SECURITY;

ALTER TABLE public.menu_week_opening_send_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_week_opening_send_log FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.employee_notification_preferences FROM PUBLIC;
REVOKE ALL ON TABLE public.employee_notification_preferences FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.employee_notification_preferences TO authenticated;
GRANT ALL ON TABLE public.employee_notification_preferences TO service_role;

REVOKE ALL ON TABLE public.menu_week_opening_send_log FROM PUBLIC;
REVOKE ALL ON TABLE public.menu_week_opening_send_log FROM anon;
GRANT ALL ON TABLE public.menu_week_opening_send_log TO service_role;

DROP POLICY IF EXISTS employee_notification_preferences_self_select ON public.employee_notification_preferences;
CREATE POLICY employee_notification_preferences_self_select ON public.employee_notification_preferences
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS employee_notification_preferences_self_insert ON public.employee_notification_preferences;
CREATE POLICY employee_notification_preferences_self_insert ON public.employee_notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS employee_notification_preferences_self_update ON public.employee_notification_preferences;
CREATE POLICY employee_notification_preferences_self_update ON public.employee_notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
