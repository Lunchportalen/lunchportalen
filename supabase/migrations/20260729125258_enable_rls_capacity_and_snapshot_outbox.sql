-- Fail-closed: capacity/outbox tables must not be anon-exposed without RLS.
-- service_role bypasses RLS; application paths use service role / SECURITY DEFINER.
ALTER TABLE public.dish_day_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dish_day_capacity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_production_snapshot_outbox ENABLE ROW LEVEL SECURITY;
