-- Model B: batch/driver transitions derive orders.status in one transactional RPC.
-- ESG (esg_daily) and Tripletex invoice enqueue: out of scope v1.

begin;

-- ---------------------------------------------------------------------------
-- Operative slot normalization (orders.slot ↔ kitchen_batches.delivery_window)
-- ---------------------------------------------------------------------------
create or replace function public.lp_norm_operative_slot(p_slot text)
returns text
language sql
immutable
set search_path to public
as $$
  select case
    when lower(btrim(coalesce(p_slot, ''))) in ('', 'lunch') then 'default'
    else lower(btrim(p_slot))
  end;
$$;

comment on function public.lp_norm_operative_slot(text) is
  'Canonical slot key for operative order/batch joins. Maps empty/lunch → default.';

-- ---------------------------------------------------------------------------
-- Actor auth (parameterized; no auth-bypass — explicit provider + role checks)
-- ---------------------------------------------------------------------------
create or replace function private.lp_assert_provider_kitchen_access_for(
  p_provider_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path to public
as $$
begin
  if exists (select 1 from public.platform_admins pa where pa.user_id = p_user_id) then
    return;
  end if;

  if exists (
    select 1
    from public.provider_memberships pm
    where pm.user_id = p_user_id
      and pm.provider_id = p_provider_id
      and pm.role in (
        'provider_admin'::public.provider_role,
        'provider_kitchen'::public.provider_role
      )
  ) then
    return;
  end if;

  raise exception 'PERMISSION_DENIED' using errcode = '42501';
end;
$$;

create or replace function private.lp_assert_provider_batch_delivered_actor(
  p_provider_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path to public
as $$
begin
  if exists (select 1 from public.platform_admins pa where pa.user_id = p_user_id) then
    return;
  end if;

  if exists (
    select 1
    from public.provider_memberships pm
    where pm.user_id = p_user_id
      and pm.provider_id = p_provider_id
      and pm.role = 'provider_admin'::public.provider_role
  ) then
    return;
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = 'driver'::public.user_role
      and exists (
        select 1
        from public.provider_memberships pm
        where pm.user_id = p_user_id
          and pm.provider_id = p_provider_id
      )
  ) then
    return;
  end if;

  raise exception 'PERMISSION_DENIED' using errcode = '42501';
end;
$$;

-- ---------------------------------------------------------------------------
-- Resolve provider for a batch location
-- ---------------------------------------------------------------------------
create or replace function private.lp_resolve_provider_for_location(p_location_id uuid)
returns uuid
language sql
stable
security definer
set search_path to public
as $$
  select coalesce(
    (
      select a.provider_id
      from public.agreements a
      where a.location_id = p_location_id
        and a.status = 'ACTIVE'::public.agreement_status
      order by coalesce(a.starts_at, a.start_date) desc nulls last, a.created_at desc, a.id desc
      limit 1
    ),
    (
      select c.provider_id
      from public.company_locations cl
      join public.companies c on c.id = cl.company_id
      where cl.id = p_location_id
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- Single order advance (batch-derived; auth + GUC flag checked at batch RPC level)
-- ---------------------------------------------------------------------------
create or replace function private.lp_order_advance_one_step_for_batch(
  p_order_id uuid,
  p_target text,
  p_actor uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_old text;
  v_target text;
begin
  if coalesce(current_setting('app.batch_derived_advance', true), '') <> '1' then
    raise exception 'BATCH_DERIVED_FLAG_REQUIRED' using errcode = '42501';
  end if;

  v_target := upper(btrim(coalesce(p_target, '')));
  if v_target not in ('PREPARED', 'DISPATCHED', 'DELIVERED') then
    raise exception 'INVALID_TARGET_STATUS' using errcode = '22023';
  end if;

  select upper(o.status::text)
  into v_old
  from public.orders o
  where o.id = p_order_id;

  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = '02000';
  end if;

  if v_old in ('CANCELLED', 'PAUSED') then
    return jsonb_build_object('ok', false, 'skipped', true, 'reason', 'not_advanceable', 'status', v_old);
  end if;

  if v_old = v_target then
    return jsonb_build_object('ok', true, 'already_at_status', true, 'from_status', v_old, 'to_status', v_target);
  end if;

  if v_target = 'PREPARED' and v_old in ('ACTIVE', 'LOCKED') then
    null;
  elsif v_target = 'DISPATCHED' and v_old = 'PREPARED' then
    null;
  elsif v_target = 'DELIVERED' and v_old = 'DISPATCHED' then
    null;
  else
    raise exception 'INVALID_STATUS_TRANSITION' using errcode = '22023';
  end if;

  perform set_config('app.batch_derived_actor', p_actor::text, true);
  perform set_config('app.batch_derived_note', coalesce(nullif(btrim(p_note), ''), ''), true);

  update public.orders
  set status = v_target::public.order_status,
      updated_at = now()
  where id = p_order_id;

  return jsonb_build_object('ok', true, 'from_status', v_old, 'to_status', v_target);
end;
$$;

-- ---------------------------------------------------------------------------
-- Catch-up orders to DISPATCHED or DELIVERED for a batch scope
-- ---------------------------------------------------------------------------
create or replace function private.lp_sync_orders_for_batch_scope(
  p_delivery_date date,
  p_delivery_window text,
  p_company_location_id uuid,
  p_order_target text,
  p_batch_id uuid,
  p_batch_status text,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_slot text;
  v_order_id uuid;
  v_note text;
  v_step jsonb;
  v_advanced int := 0;
  v_skipped int := 0;
  v_already int := 0;
  v_order_ids uuid[] := '{}';
  v_target text;
  v_current text;
  v_candidates uuid[];
begin
  v_slot := public.lp_norm_operative_slot(p_delivery_window);
  v_target := upper(btrim(p_order_target));
  v_note := format('derived:batch:%s:%s', lower(btrim(p_batch_status)), p_batch_id::text);

  select coalesce(array_agg(o.id order by o.id), '{}'::uuid[])
  into v_candidates
  from public.orders o
  where o.date = p_delivery_date
    and o.location_id = p_company_location_id
    and public.lp_norm_operative_slot(o.slot) = v_slot
    and upper(o.status::text) not in ('CANCELLED', 'PAUSED')
    and not exists (
      select 1
      from public.day_choices dc
      where dc.user_id = o.user_id
        and dc.company_id = o.company_id
        and dc.location_id = o.location_id
        and dc.date = o.date
        and upper(coalesce(dc.status, '')) = 'CANCELLED'
    );

  foreach v_order_id in array v_candidates loop
    select upper(o.status::text)
    into v_current
    from public.orders o
    where o.id = v_order_id;

    if v_target = 'DISPATCHED' then
      if v_current in ('ACTIVE', 'LOCKED') then
        v_step := private.lp_order_advance_one_step_for_batch(v_order_id, 'PREPARED', p_actor, v_note);
        if coalesce((v_step->>'skipped')::boolean, false) then
          v_skipped := v_skipped + 1;
          continue;
        end if;
        if coalesce((v_step->>'already_at_status')::boolean, false) then
          v_already := v_already + 1;
        else
          v_advanced := v_advanced + 1;
        end if;
        v_step := private.lp_order_advance_one_step_for_batch(v_order_id, 'DISPATCHED', p_actor, v_note);
      elsif v_current = 'PREPARED' then
        v_step := private.lp_order_advance_one_step_for_batch(v_order_id, 'DISPATCHED', p_actor, v_note);
      elsif v_current in ('DISPATCHED', 'DELIVERED') then
        v_already := v_already + 1;
        v_order_ids := array_append(v_order_ids, v_order_id);
        continue;
      else
        v_skipped := v_skipped + 1;
        continue;
      end if;
    elsif v_target = 'DELIVERED' then
      if v_current in ('ACTIVE', 'LOCKED', 'PREPARED') then
        if v_current in ('ACTIVE', 'LOCKED') then
          v_step := private.lp_order_advance_one_step_for_batch(v_order_id, 'PREPARED', p_actor, v_note);
          if coalesce((v_step->>'skipped')::boolean, false) then
            v_skipped := v_skipped + 1;
            continue;
          end if;
          if not coalesce((v_step->>'already_at_status')::boolean, false) then
            v_advanced := v_advanced + 1;
          end if;
        end if;
        v_step := private.lp_order_advance_one_step_for_batch(v_order_id, 'DISPATCHED', p_actor, v_note);
        if coalesce((v_step->>'skipped')::boolean, false) then
          v_skipped := v_skipped + 1;
          continue;
        end if;
        if not coalesce((v_step->>'already_at_status')::boolean, false) then
          v_advanced := v_advanced + 1;
        end if;
        v_step := private.lp_order_advance_one_step_for_batch(v_order_id, 'DELIVERED', p_actor, v_note);
      elsif v_current = 'DISPATCHED' then
        v_step := private.lp_order_advance_one_step_for_batch(v_order_id, 'DELIVERED', p_actor, v_note);
      elsif v_current = 'DELIVERED' then
        v_already := v_already + 1;
        v_order_ids := array_append(v_order_ids, v_order_id);
        continue;
      else
        v_skipped := v_skipped + 1;
        continue;
      end if;
    else
      raise exception 'INVALID_ORDER_TARGET' using errcode = '22023';
    end if;

    if coalesce((v_step->>'skipped')::boolean, false) then
      v_skipped := v_skipped + 1;
    elsif coalesce((v_step->>'already_at_status')::boolean, false) then
      v_already := v_already + 1;
    else
      v_advanced := v_advanced + 1;
    end if;
    v_order_ids := array_append(v_order_ids, v_order_id);
  end loop;

  return jsonb_build_object(
    'advanced', v_advanced,
    'skipped', v_skipped,
    'already', v_already,
    'order_ids', to_jsonb(v_order_ids)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Public RPC: batch transition + order sync (single transaction)
-- p_mode: create | from_queued | from_packed
-- ---------------------------------------------------------------------------
create or replace function public.lp_batch_transition_and_sync_orders(
  p_delivery_date date,
  p_delivery_window text,
  p_company_location_id uuid,
  p_target_batch_status text,
  p_actor_user_id uuid,
  p_mode text default 'from_packed'
)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_provider_id uuid;
  v_slot text;
  v_target text;
  v_mode text;
  v_batch public.kitchen_batches%rowtype;
  v_from text;
  v_now timestamptz := now();
  v_batch_updated boolean := false;
  v_sync jsonb;
  v_order_target text;
begin
  if p_delivery_date is null or p_company_location_id is null or p_actor_user_id is null then
    raise exception 'INVALID_ARGUMENT' using errcode = '22023';
  end if;

  v_slot := public.lp_norm_operative_slot(p_delivery_window);
  v_target := upper(btrim(coalesce(p_target_batch_status, '')));
  v_mode := lower(btrim(coalesce(p_mode, 'from_packed')));

  if v_target not in ('PACKED', 'DELIVERED') then
    raise exception 'INVALID_BATCH_TARGET' using errcode = '22023';
  end if;

  if v_mode not in ('create', 'from_queued', 'from_packed') then
    raise exception 'INVALID_MODE' using errcode = '22023';
  end if;

  if not exists (select 1 from public.company_locations cl where cl.id = p_company_location_id) then
    raise exception 'LOCATION_NOT_FOUND' using errcode = '02000';
  end if;

  v_provider_id := private.lp_resolve_provider_for_location(p_company_location_id);
  if v_provider_id is null then
    raise exception 'PROVIDER_NOT_RESOLVED' using errcode = '22023';
  end if;

  if v_target = 'PACKED' then
    perform private.lp_assert_provider_kitchen_access_for(v_provider_id, p_actor_user_id);
  else
    perform private.lp_assert_provider_batch_delivered_actor(v_provider_id, p_actor_user_id);
  end if;

  perform set_config('app.batch_derived_advance', '1', true);

  select *
  into v_batch
  from public.kitchen_batches kb
  where kb.delivery_date = p_delivery_date
    and kb.company_location_id = p_company_location_id
    and public.lp_norm_operative_slot(kb.delivery_window) = v_slot
  for update;

  if not found then
    if v_mode <> 'create' or v_target <> 'PACKED' then
      raise exception 'BATCH_NOT_FOUND' using errcode = '02000';
    end if;

    insert into public.kitchen_batches (
      delivery_date,
      delivery_window,
      company_location_id,
      status,
      packed_at,
      delivered_at
    )
    values (
      p_delivery_date,
      v_slot,
      p_company_location_id,
      'PACKED',
      v_now,
      null
    )
    returning * into v_batch;

    v_batch_updated := true;
  else
    v_from := upper(btrim(v_batch.status));

    if v_from = v_target then
      v_batch_updated := false;
    elsif v_target = 'PACKED' and v_mode = 'from_queued' and v_from = 'QUEUED' then
      update public.kitchen_batches
      set status = 'PACKED',
          packed_at = coalesce(packed_at, v_now),
          updated_at = v_now
      where id = v_batch.id
      returning * into v_batch;
      v_batch_updated := true;
    elsif v_target = 'PACKED' and v_mode = 'create' then
      raise exception 'BATCH_EXISTS' using errcode = '23505';
    elsif v_target = 'DELIVERED' and v_from = 'PACKED' then
      update public.kitchen_batches
      set status = 'DELIVERED',
          delivered_at = coalesce(delivered_at, v_now),
          updated_at = v_now
      where id = v_batch.id
      returning * into v_batch;
      v_batch_updated := true;
    elsif v_target = 'DELIVERED' and v_from = 'DELIVERED' then
      v_batch_updated := false;
    else
      raise exception 'INVALID_BATCH_TRANSITION' using errcode = '22023';
    end if;
  end if;

  v_order_target := case when v_target = 'PACKED' then 'DISPATCHED' else 'DELIVERED' end;

  v_sync := private.lp_sync_orders_for_batch_scope(
    p_delivery_date,
    v_slot,
    p_company_location_id,
    v_order_target,
    v_batch.id,
    v_batch.status,
    p_actor_user_id
  );

  return jsonb_build_object(
    'ok', true,
    'batch_updated', v_batch_updated,
    'batch', jsonb_build_object(
      'id', v_batch.id,
      'delivery_date', v_batch.delivery_date,
      'delivery_window', v_batch.delivery_window,
      'company_location_id', v_batch.company_location_id,
      'status', upper(v_batch.status),
      'packed_at', v_batch.packed_at,
      'delivered_at', v_batch.delivered_at
    ),
    'sync', v_sync,
    'provider_id', v_provider_id
  );
end;
$$;

comment on function public.lp_batch_transition_and_sync_orders(date, text, uuid, text, uuid, text) is
  'Model B: atomically transition kitchen_batches and derive orders.status (PACKED→DISPATCHED, DELIVERED→DELIVERED). ESG/Tripletex out of scope v1.';

grant execute on function public.lp_batch_transition_and_sync_orders(date, text, uuid, text, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Batch-derived advance: transaction-scoped GUC bypass (no ALTER TABLE trigger toggles)
-- app.batch_derived_advance=1 set only inside lp_batch_transition_and_sync_orders.
-- ---------------------------------------------------------------------------
create or replace function public.tg_orders_cutoff_0800() returns trigger
    language plpgsql
    set search_path to public
    as $$
declare
  role public.user_role;
  today date;
  now_t time;
begin
  if coalesce(current_setting('app.batch_derived_advance', true), '') = '1' then
    return new;
  end if;

  role := (select coalesce((select p.role from public.profiles p where p.id=auth.uid()), 'employee'::public.user_role));
  if role='superadmin' then return new; end if;

  today := public.oslo_today();
  now_t := public.oslo_time();

  if new.date < today then
    raise exception 'orders locked: cannot write past' using errcode='23514';
  end if;

  if new.date = today and now_t >= time '08:00' then
    raise exception 'orders locked after 08:00 Oslo for today' using errcode='23514';
  end if;

  return new;
end;
$$;

create or replace function public.tg_guard_order_mutation() returns trigger
    language plpgsql
    set search_path to public
    as $$
begin
  if coalesce(current_setting('app.batch_derived_advance', true), '') = '1' then
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.assert_order_mutable(old.id);
    return old;
  end if;

  if upper((new.status)::text) is distinct from upper((old.status)::text) then
    if upper((old.status)::text) in ('LOCKED', 'PREPARED', 'DISPATCHED')
       and upper((new.status)::text) in ('PREPARED', 'DISPATCHED', 'DELIVERED', 'CANCELLED')
       and (
         (select private.can_manage_location(old.location_id))
         or (select private.has_platform_role(array[
           'platform_admin'::public.platform_role,
           'platform_ops'::public.platform_role,
           'kitchen'::public.platform_role,
           'courier'::public.platform_role
         ]))
       )
    then
      return new;
    end if;
  end if;

  perform public.assert_order_mutable(old.id);
  return new;
end;
$$;

create or replace function public.tg_order_status_history() returns trigger
    language plpgsql security definer
    set search_path to public
    as $$
begin
  if coalesce(current_setting('app.batch_derived_advance', true), '') = '1' then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
      values (
        new.id,
        old.status,
        new.status,
        nullif(current_setting('app.batch_derived_actor', true), '')::uuid,
        nullif(current_setting('app.batch_derived_note', true), '')
      );
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
    values (new.id, null, new.status, auth.uid(), 'Order created');
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
    values (new.id, old.status, new.status, auth.uid(), null);
  end if;

  return new;
end;
$$;

commit;
