-- One-time cleanup: state/fan-out outbox rows (order.set / rollup.rebuild) must not sit in FAILED
-- after email-only validation. Idempotent on repeated apply (0 rows updated when already clear).
begin;

do $$
declare
  v_count int;
begin
  update public.outbox o
     set status = 'SENT',
         delivered_at = coalesce(o.delivered_at, now()),
         last_error = null,
         locked_at = null,
         locked_by = null,
         next_retry_at = null,
         updated_at = now()
   where o.status = 'FAILED'
     and (
       o.event_key like 'order.set:%'
       or o.event_key like 'rollup.rebuild:%'
     );

  get diagnostics v_count = row_count;
  raise notice 'Cleared % FAILED state-events from outbox (set to SENT)', v_count;
end $$;

commit;
