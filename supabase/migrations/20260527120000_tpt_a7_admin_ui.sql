-- TPT-A-7: Superadmin manual outbox retry (Tripletex Flow A queue inspector).

begin;

create or replace function public.lp_outbox_retry_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_event public.outbox%rowtype;
  v_prev_status text;
begin
  if not public.is_platform_admin() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  select * into v_event from public.outbox where id = p_event_id;
  if not found then
    raise exception 'OUTBOX_EVENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_prev_status := v_event.status;

  if v_prev_status not in ('PENDING', 'FAILED') then
    raise exception 'OUTBOX_RETRY_STATUS_INVALID: %', v_prev_status using errcode = 'P0001';
  end if;

  update public.outbox
  set
    status = 'PENDING',
    attempts = coalesce(v_event.attempts, 0) + 1,
    last_error = null,
    next_retry_at = now(),
    locked_at = null,
    locked_by = null,
    lease_id = null,
    updated_at = now()
  where id = p_event_id;

  insert into public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  values (
    auth.uid(),
    'outbox_manual_retry',
    'outbox_event',
    p_event_id,
    'Tripletex admin UI manual retry',
    jsonb_build_object(
      'event_key', v_event.event_key,
      'previous_status', v_prev_status
    )
  );

  return jsonb_build_object(
    'ok', true,
    'event_id', p_event_id,
    'previous_status', v_prev_status
  );
end;
$$;

revoke all on function public.lp_outbox_retry_event(uuid) from public;
grant execute on function public.lp_outbox_retry_event(uuid) to authenticated, service_role;

commit;
