-- Staging repair: restore PostgREST table GRANTs lost after B3a schema dump restore (2026-05-20).
-- Symptom: integration tests get 42501 before RLS (anon + service_role lack table privileges).
-- Prod (hkpokyapzarefrgqzkos) already has these grants; staging (uigxsboqeruxflgzqztl) does not.
--
-- Apply order: staging first (MCP/pg), verify preflight live-DB suites, then prod if drift detected.
-- Idempotent: re-run is safe.

begin;

do $$
declare
  v_table text;
  v_tables text[] := array[
    'companies',
    'company_locations',
    'profiles',
    'agreements',
    'orders',
    'idempotency',
    'ai_activity_log'
  ];
begin
  foreach v_table in array v_tables loop
    execute format(
      'grant select, insert, update, delete on table public.%I to anon, authenticated, service_role',
      v_table
    );
  end loop;
end
$$;

-- Match prod: outbox — service_role only (anon has no direct access on prod either).
grant select, insert, update, delete on table public.outbox to service_role;

-- Integration tests (agreements-lifecycle fallback) insert audit rows via service_role.
grant select, insert, update, delete on table public.audit_events to service_role;

commit;
