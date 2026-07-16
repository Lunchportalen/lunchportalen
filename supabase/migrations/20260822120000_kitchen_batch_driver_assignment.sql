-- PHASE 7 (additive): driver assignment on the canonical kitchen batch model.
--
-- kitchen_batches is the ONE batch model (date/window/location) shared by
-- kitchen packing and driver delivery (lp_batch_transition_and_sync_orders
-- syncs orders PACKED→DISPATCHED / DELIVERED→DELIVERED). This migration only
-- adds WHO drives the batch — no status semantics change, no new state machine.

BEGIN;

ALTER TABLE public.kitchen_batches
  ADD COLUMN IF NOT EXISTS driver_user_id uuid,
  ADD COLUMN IF NOT EXISTS driver_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS driver_assigned_by uuid;

COMMENT ON COLUMN public.kitchen_batches.driver_user_id IS
  'Fase 7: sjåfør tildelt leveringsbatchen (profiles.id med role=driver). Ingen statuslogikk — kun tilordning.';

CREATE INDEX IF NOT EXISTS kitchen_batches_driver_idx
  ON public.kitchen_batches (driver_user_id, delivery_date);

COMMIT;
