-- Phase 20: Allow action 'release_execute' in content_audit_log.
-- Additive: only expands CHECK allowed values; no column drop, no data loss.
alter table public.content_audit_log drop constraint if exists content_audit_log_action_check;
alter table public.content_audit_log add constraint content_audit_log_action_check
  check (action in ('workflow_change','publish','expire','workflow_blocked','release_execute'));
