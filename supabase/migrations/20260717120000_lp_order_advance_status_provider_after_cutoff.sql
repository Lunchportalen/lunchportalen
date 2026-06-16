-- Provider production status advances must work after employee 08:00 cutoff.
-- lp_order_advance_status previously disabled guard_order_mutation only; orders_cutoff_0800
-- still blocked UPDATE OF status for today's orders (employee rule).
-- Reuse app.batch_derived_advance GUC (Model B batch sync) for provider kitchen RPC only.

begin;

create or replace function public.lp_order_advance_status(
  p_order_id uuid,
  p_target_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_provider_id uuid;
  v_old_status text;
  v_target text;
begin
  v_target := upper(trim(coalesce(p_target_status, '')));
  if v_target not in ('PREPARED', 'DISPATCHED', 'DELIVERED') then
    raise exception 'INVALID_TARGET_STATUS' using errcode = '22023';
  end if;

  select o.provider_id, upper(o.status::text)
  into v_provider_id, v_old_status
  from public.orders o
  where o.id = p_order_id;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = '02000';
  end if;

  perform private.lp_assert_provider_kitchen_access(v_provider_id);

  if v_old_status in ('CANCELLED', 'PAUSED') then
    raise exception 'ORDER_NOT_ADVANCEABLE' using errcode = '22023';
  end if;

  if v_old_status = v_target then
    return jsonb_build_object('ok', true, 'already_at_status', true, 'from_status', v_old_status, 'to_status', v_target);
  end if;

  if v_old_status = 'DELIVERED' and v_target = 'DISPATCHED' then
    if not public.is_platform_admin()
      and not exists (
        select 1
        from public.provider_memberships pm
        where pm.user_id = auth.uid()
          and pm.provider_id = v_provider_id
          and pm.role = 'provider_admin'::public.provider_role
      ) then
      raise exception 'PERMISSION_DENIED' using errcode = '42501';
    end if;
  elsif v_target = 'PREPARED' and v_old_status in ('ACTIVE', 'LOCKED') then
    null;
  elsif v_target = 'DISPATCHED' and v_old_status = 'PREPARED' then
    null;
  elsif v_target = 'DELIVERED' and v_old_status = 'DISPATCHED' then
    null;
  else
    raise exception 'INVALID_STATUS_TRANSITION' using errcode = '22023';
  end if;

  -- Provider production path: skip employee cutoff + guard triggers for this UPDATE only.
  perform set_config('app.batch_derived_advance', '1', true);
  perform set_config('app.batch_derived_actor', auth.uid()::text, true);
  if nullif(trim(p_note), '') is not null then
    perform set_config('app.batch_derived_note', trim(p_note), true);
  end if;

  update public.orders
  set status = v_target::public.order_status,
      updated_at = now()
  where id = p_order_id;

  return jsonb_build_object(
    'ok', true,
    'from_status', v_old_status,
    'to_status', v_target,
    'provider_id', v_provider_id
  );
end;
$$;

comment on function public.lp_order_advance_status(uuid, text, text) is
  'Provider kitchen flow: ACTIVE/LOCKED→PREPARED→DISPATCHED→DELIVERED. Uses batch_derived_advance GUC so production advances are allowed after employee 08:00 Oslo cutoff. Admin may reopen DELIVERED→DISPATCHED.';

commit;
