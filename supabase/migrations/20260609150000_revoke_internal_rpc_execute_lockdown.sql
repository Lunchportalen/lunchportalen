-- Revoke EXECUTE on internal-only public routines from anon/authenticated.
-- service_role + postgres retain EXECUTE. Trigger bodies are unaffected (no client EXECUTE needed).
-- Idempotent: safe to re-run (REVOKE/GRANT are no-ops when already applied).

begin;

do $$
declare
  r record;
  v_target_count integer := 0;
  v_applied_count integer := 0;
begin
  for r in
    select
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and (
        p.proname like 'tg\_%' escape '\'
        or p.proname like 'trg\_%' escape '\'
        or p.proname like 'outbox\_%' escape '\'
        or p.proname like 'lp_outbox\_%' escape '\'
        or p.proname in (
          'handle_new_user',
          'tg_audit_row',
          'lp_idem_begin',
          'lp_idem_complete',
          'lp_idem_fail',
          'recompute_profile_legacy_scope',
          'refresh_delivery_run_items',
          'sync_agreement_delivery_days_from_legacy_jsonb',
          'sync_memberships_from_legacy_profile',
          'recalculate_invoice_run_totals',
          'recalculate_order_totals'
        )
      )
    order by p.proname, args
  loop
    v_target_count := v_target_count + 1;

    execute format(
      'revoke execute on function public.%I(%s) from public',
      r.proname,
      r.args
    );
    execute format(
      'revoke execute on function public.%I(%s) from anon',
      r.proname,
      r.args
    );
    execute format(
      'revoke execute on function public.%I(%s) from authenticated',
      r.proname,
      r.args
    );
    execute format(
      'grant execute on function public.%I(%s) to service_role',
      r.proname,
      r.args
    );
    execute format(
      'grant execute on function public.%I(%s) to postgres',
      r.proname,
      r.args
    );

    v_applied_count := v_applied_count + 1;
  end loop;

  raise notice 'revoke_internal_rpc_execute_lockdown: targets=% applied=%',
    v_target_count,
    v_applied_count;

  if v_applied_count = 0 then
    raise exception 'revoke_internal_rpc_execute_lockdown: no matching functions found (fail-closed)';
  end if;
end
$$;

commit;
