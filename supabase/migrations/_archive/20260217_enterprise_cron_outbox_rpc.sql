-- supabase/migrations/20260217_enterprise_cron_outbox_rpc.sql
-- Deprecated migration.
-- This file is intentionally a no-op to avoid introducing legacy schema references
-- (idempotency_keys/order_email_outbox) on environments that use:
--   public.idempotency
--   public.outbox
-- Active hardening migration: 20260217_enterprise_outbox_worker_rpc.sql

begin;
commit;
