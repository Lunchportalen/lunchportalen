--
-- PostgreSQL database dump
--

\restrict SsJ1Nh0mmke9fDnVG6dFItFMW4EexbDQH6SOFoZhZFGDp0snTlC739T6HkeojLb

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA private;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: adjustment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.adjustment_type AS ENUM (
    'credit',
    'debit'
);


--
-- Name: agreement_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.agreement_status AS ENUM (
    'PENDING',
    'ACTIVE',
    'PAUSED',
    'CLOSED',
    'REJECTED'
);


--
-- Name: agreement_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.agreement_tier AS ENUM (
    'BASIS',
    'LUXUS',
    'ENTERPRISE'
);


--
-- Name: billing_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.billing_mode AS ENUM (
    'company_pays_full',
    'employee_pays_full',
    'split'
);


--
-- Name: closed_reason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.closed_reason AS ENUM (
    'PUBLIC_HOLIDAY',
    'COMPANY_PAUSE',
    'KITCHEN_CLOSED',
    'EXCEPTION'
);


--
-- Name: company_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.company_role AS ENUM (
    'company_owner',
    'company_admin',
    'finance',
    'location_manager',
    'employee'
);


--
-- Name: company_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.company_status AS ENUM (
    'LEAD',
    'PENDING',
    'ACTIVE',
    'PAUSED',
    'CLOSED',
    'TERMINATED'
);


--
-- Name: delivery_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delivery_run_status AS ENUM (
    'PLANNED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: delivery_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.delivery_status AS ENUM (
    'PLANNED',
    'IN_PROGRESS',
    'DELIVERED',
    'FAILED',
    'planned',
    'locked',
    'prepared',
    'packed',
    'dispatched',
    'delivered',
    'issue',
    'cancelled'
);


--
-- Name: invoice_line_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_line_type AS ENUM (
    'order',
    'credit',
    'debit',
    'fee',
    'manual'
);


--
-- Name: invoice_run_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_run_status AS ENUM (
    'DRAFT',
    'READY',
    'SENT',
    'FAILED'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'DRAFT',
    'READY_FOR_SYNC',
    'SYNCED',
    'FAILED',
    'CANCELLED',
    'draft',
    'finalized',
    'sent',
    'paid',
    'void'
);


--
-- Name: location_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.location_status AS ENUM (
    'active',
    'paused',
    'closed'
);


--
-- Name: membership_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.membership_role AS ENUM (
    'employee',
    'location_admin',
    'company_admin',
    'company_finance'
);


--
-- Name: membership_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.membership_status AS ENUM (
    'invited',
    'active',
    'suspended',
    'revoked'
);


--
-- Name: menu_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.menu_state AS ENUM (
    'draft',
    'published',
    'locked',
    'archived'
);


--
-- Name: order_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_source AS ENUM (
    'web',
    'admin',
    'standing_order',
    'api'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'LOCKED',
    'PREPARED',
    'DISPATCHED',
    'DELIVERED',
    'ACTIVE',
    'CANCELLED'
);


--
-- Name: platform_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.platform_role AS ENUM (
    'platform_admin',
    'platform_ops',
    'kitchen',
    'courier',
    'finance_internal'
);


--
-- Name: production_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.production_status AS ENUM (
    'OPEN',
    'FROZEN',
    'CLOSED'
);


--
-- Name: tripletex_sync_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tripletex_sync_status AS ENUM (
    'PENDING',
    'PROCESSING',
    'DONE',
    'FAILED',
    'FAILED_PERMANENT'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'employee',
    'company_admin',
    'superadmin',
    'kitchen',
    'driver'
);


--
-- Name: add_fk_if_possible(text, text, text, text, text, text); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.add_fk_if_possible(p_table text, p_column text, p_target_table text, p_target_column text, p_constraint_name text, p_on_delete text DEFAULT 'no action'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  v_table regclass;
  v_target regclass;
begin
  v_table := to_regclass(p_table);
  v_target := to_regclass(p_target_table);

  if v_table is null or v_target is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_attribute
    where attrelid = v_table
      and attname = p_column
      and not attisdropped
      and atttypid = 'uuid'::regtype
  ) then
    return;
  end if;

  if not exists (
    select 1
    from pg_attribute
    where attrelid = v_target
      and attname = p_target_column
      and not attisdropped
  ) then
    return;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = p_constraint_name
      and conrelid = v_table
  ) then
    return;
  end if;

  execute format(
    'alter table %s add constraint %I foreign key (%I) references %s (%I) on delete %s',
    p_table,
    p_constraint_name,
    p_column,
    p_target_table,
    p_target_column,
    p_on_delete
  );
exception
  when duplicate_object then
    null;
  when undefined_table then
    null;
  when undefined_column then
    null;
  when datatype_mismatch then
    null;
end;
$$;


--
-- Name: can_access_company(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.can_access_company(_company_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    (select private.has_platform_role(array[
      'platform_admin'::public.platform_role,
      'platform_ops'::public.platform_role,
      'finance_internal'::public.platform_role,
      'kitchen'::public.platform_role,
      'courier'::public.platform_role
    ]))
    or exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = _company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'
    );
$$;


--
-- Name: can_access_delivery_run(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.can_access_delivery_run(_delivery_run_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.delivery_runs dr
    where dr.id = _delivery_run_id
      and (
        (select private.can_access_location(dr.location_id))
        or (select private.has_platform_role(array[
          'platform_admin'::public.platform_role,
          'platform_ops'::public.platform_role,
          'kitchen'::public.platform_role,
          'courier'::public.platform_role
        ]))
      )
  );
$$;


--
-- Name: can_access_location(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.can_access_location(_location_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    (select private.has_platform_role(array[
      'platform_admin'::public.platform_role,
      'platform_ops'::public.platform_role,
      'kitchen'::public.platform_role,
      'courier'::public.platform_role,
      'finance_internal'::public.platform_role
    ]))
    or exists (
      select 1
      from public.company_memberships cm
      join public.company_locations l
        on l.company_id = cm.company_id
      where l.id = _location_id
        and cm.user_id = (select auth.uid())
        and coalesce(cm.status::text, '') = 'active'
        and (cm.location_id is null or cm.location_id = _location_id)
    );
$$;


--
-- Name: can_access_menu_day(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.can_access_menu_day(_menu_service_day_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.menu_service_days msd
    where msd.id = _menu_service_day_id
      and (
        (msd.state in ('published', 'locked', 'archived') and (select private.can_access_location(msd.location_id)))
        or (select private.can_manage_location(msd.location_id))
        or (select private.has_platform_role(array[
          'platform_admin'::public.platform_role,
          'platform_ops'::public.platform_role
        ]))
      )
  );
$$;


--
-- Name: can_edit_order(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.can_edit_order(_order_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.orders o
    where o.id = _order_id
      and (
        o.user_id = (select auth.uid())
        or (select private.can_manage_location(o.location_id))
      )
  )
  or (select private.has_platform_role(array[
    'platform_admin'::public.platform_role,
    'platform_ops'::public.platform_role
  ]));
$$;


--
-- Name: can_finance_company(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.can_finance_company(_company_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    (select private.has_platform_role(array[
      'platform_admin'::public.platform_role,
      'finance_internal'::public.platform_role
    ]))
    or exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = _company_id
        and cm.user_id = (select auth.uid())
        and coalesce(cm.status::text, '') = 'active'
        and (select private.role_is_company_finance(cm.role::text))
    );
$$;


--
-- Name: can_manage_company(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.can_manage_company(_company_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    (select private.has_platform_role(array[
      'platform_admin'::public.platform_role,
      'platform_ops'::public.platform_role
    ]))
    or exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = _company_id
        and cm.user_id = (select auth.uid())
        and coalesce(cm.status::text, '') = 'active'
        and (select private.role_is_company_manager(cm.role::text))
    );
$$;


--
-- Name: can_manage_location(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.can_manage_location(_location_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    (select private.has_platform_role(array[
      'platform_admin'::public.platform_role,
      'platform_ops'::public.platform_role
    ]))
    or exists (
      select 1
      from public.company_memberships cm
      join public.company_locations l
        on l.company_id = cm.company_id
      where l.id = _location_id
        and cm.user_id = (select auth.uid())
        and coalesce(cm.status::text, '') = 'active'
        and (select private.role_is_location_manager(cm.role::text))
        and (cm.location_id is null or cm.location_id = _location_id)
    );
$$;


--
-- Name: can_manage_menu_day(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.can_manage_menu_day(_menu_service_day_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.menu_service_days msd
    where msd.id = _menu_service_day_id
      and (
        (select private.can_manage_location(msd.location_id))
        or (select private.has_platform_role(array[
          'platform_admin'::public.platform_role,
          'platform_ops'::public.platform_role
        ]))
      )
  );
$$;


--
-- Name: can_operate_delivery_run(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.can_operate_delivery_run(_delivery_run_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.delivery_runs dr
    where dr.id = _delivery_run_id
      and (
        (select private.can_manage_location(dr.location_id))
        or (select private.has_platform_role(array[
          'platform_admin'::public.platform_role,
          'platform_ops'::public.platform_role,
          'kitchen'::public.platform_role,
          'courier'::public.platform_role
        ]))
      )
  );
$$;


--
-- Name: can_view_order(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.can_view_order(_order_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.orders o
    where o.id = _order_id
      and (
        o.user_id = (select auth.uid())
        or (select private.can_finance_company(o.company_id))
        or (select private.can_manage_location(o.location_id))
      )
  )
  or (select private.has_platform_role(array[
    'platform_admin'::public.platform_role,
    'platform_ops'::public.platform_role,
    'kitchen'::public.platform_role,
    'courier'::public.platform_role,
    'finance_internal'::public.platform_role
  ]));
$$;


--
-- Name: can_view_profile(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.can_view_profile(_profile_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    _profile_id = (select auth.uid())
    or (select private.shares_company_with(_profile_id));
$$;


--
-- Name: ensure_audit_log_partitions(integer); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.ensure_audit_log_partitions(months_ahead integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  i int;
  v_month date;
  v_next_month date;
  v_rel text;
  v_from_lit text;
  v_to_lit text;
  v_created text[] := ARRAY[]::text[];
  v_skipped text[] := ARRAY[]::text[];
BEGIN
  IF months_ahead IS NULL OR months_ahead < 1 THEN
    RAISE EXCEPTION 'months_ahead must be >= 1';
  END IF;

  FOR i IN 0..(months_ahead - 1) LOOP
    v_month := (
      date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE 'utc')::timestamp)
      + make_interval(months => i)
    )::date;

    v_rel := format('audit_log_y%sm%s', to_char(v_month, 'YYYY'), to_char(v_month, 'MM'));

    IF to_regclass('public.' || v_rel) IS NOT NULL THEN
      v_skipped := array_append(v_skipped, v_rel);
      CONTINUE;
    END IF;

    v_next_month := (v_month + interval '1 month')::date;
    v_from_lit := to_char(v_month, 'YYYY-MM-DD') || ' 00:00:00+00';
    v_to_lit := to_char(v_next_month, 'YYYY-MM-DD') || ' 00:00:00+00';

    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.audit_log FOR VALUES FROM (%L) TO (%L)',
      v_rel,
      v_from_lit,
      v_to_lit
    );

    v_created := array_append(v_created, v_rel);
  END LOOP;

  RETURN jsonb_build_object(
    'created', coalesce(to_jsonb(v_created), '[]'::jsonb),
    'skipped', coalesce(to_jsonb(v_skipped), '[]'::jsonb),
    'months_checked', months_ahead
  );
END;
$$;


--
-- Name: has_platform_role(public.platform_role[]); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.has_platform_role(_roles public.platform_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1
    from public.platform_user_roles pur
    where pur.user_id = (select auth.uid())
      and pur.role = any(_roles)
  );
$$;


--
-- Name: is_platform_admin(); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.is_platform_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select private.has_platform_role(array['platform_admin'::public.platform_role]);
$$;


--
-- Name: role_is_company_finance(text); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.role_is_company_finance(_role text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select coalesce(_role, '') = any (array[
    'company_owner',
    'owner',
    'company_admin',
    'admin',
    'finance'
  ]::text[]);
$$;


--
-- Name: role_is_company_manager(text); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.role_is_company_manager(_role text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select coalesce(_role, '') = any (array[
    'company_owner',
    'owner',
    'company_admin',
    'admin'
  ]::text[]);
$$;


--
-- Name: role_is_location_manager(text); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.role_is_location_manager(_role text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    SET search_path TO ''
    AS $$
  select coalesce(_role, '') = any (array[
    'company_owner',
    'owner',
    'company_admin',
    'admin',
    'location_manager',
    'manager'
  ]::text[]);
$$;


--
-- Name: shares_company_with(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.shares_company_with(_other_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    (select private.is_platform_admin())
    or exists (
      select 1
      from public.company_memberships mine
      join public.company_memberships theirs
        on theirs.company_id = mine.company_id
      where mine.user_id = (select auth.uid())
        and mine.status = 'active'
        and theirs.user_id = _other_user_id
        and theirs.status = 'active'
    );
$$;


--
-- Name: agreement_delivery_days_array(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agreement_delivery_days_array(p_agreement_id uuid) RETURNS text[]
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(array(
    select ad.weekday
    from public.agreement_delivery_days ad
    where ad.agreement_id = p_agreement_id
    order by ad.weekday
  ), '{}'::text[]);
$$;


--
-- Name: apply_standing_orders(date, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_standing_orders(_service_date date, _location_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  rec record;
  v_order_id uuid;
  v_count integer := 0;
begin
  if _location_id is null then
    if not (select private.has_platform_role(array[
      'platform_admin'::public.platform_role,
      'platform_ops'::public.platform_role
    ])) then
      raise exception 'Only platform operators can apply standing orders across all locations';
    end if;
  else
    if not (
      (select private.can_manage_location(_location_id))
      or (select private.has_platform_role(array[
        'platform_admin'::public.platform_role,
        'platform_ops'::public.platform_role
      ]))
    ) then
      raise exception 'Not authorized to apply standing orders for location %', _location_id;
    end if;
  end if;

  for rec in
    select
      so.id,
      so.company_id,
      so.location_id,
      so.user_id,
      so.product_id,
      so.quantity
    from public.standing_orders so
    left join public.location_policies lp
      on lp.location_id = so.location_id
    where so.weekday = extract(isodow from _service_date)::int
      and so.active_from <= _service_date
      and (so.active_to is null or so.active_to >= _service_date)
      and (so.paused_until is null or so.paused_until < _service_date)
      and coalesce(lp.allow_standing_orders, true) = true
      and (_location_id is null or so.location_id = _location_id)
      and not exists (
        select 1
        from public.location_closed_dates lcd
        where lcd.location_id = so.location_id
          and lcd.closed_date = _service_date
      )
      and exists (
        select 1
        from public.menu_service_days msd
        join public.menu_service_day_items msdi
          on msdi.menu_service_day_id = msd.id
         and msdi.product_id = so.product_id
        where msd.location_id = so.location_id
          and msd.service_date = _service_date
          and msd.state = 'published'
      )
  loop
    insert into public.orders (
      company_id,
      location_id,
      user_id,
      service_date,
      status,
      source,
      created_by
    )
    values (
      rec.company_id,
      rec.location_id,
      rec.user_id,
      _service_date,
      'submitted',
      'standing_order',
      rec.user_id
    )
    on conflict (user_id, location_id, service_date) do nothing
    returning id into v_order_id;

    if v_order_id is null then
      select o.id
      into v_order_id
      from public.orders o
      where o.user_id = rec.user_id
        and o.location_id = rec.location_id
        and o.service_date = _service_date;
    end if;

    insert into public.order_items (
      order_id,
      product_id,
      quantity
    )
    values (
      v_order_id,
      rec.product_id,
      rec.quantity
    )
    on conflict (order_id, product_id) do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;


--
-- Name: assert_menu_day_mutable(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_menu_day_mutable(_menu_service_day_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_state public.menu_state;
begin
  if (select private.has_platform_role(array[
    'platform_admin'::public.platform_role,
    'platform_ops'::public.platform_role
  ])) then
    return;
  end if;

  select msd.state
  into v_state
  from public.menu_service_days msd
  where msd.id = _menu_service_day_id;

  if v_state is null then
    raise exception 'Unknown menu day: %', _menu_service_day_id;
  end if;

  if v_state = 'locked' then
    raise exception 'Menu day is locked and cannot be changed';
  end if;
end;
$$;


--
-- Name: assert_order_mutable(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assert_order_mutable(_order_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_status public.order_status;
  v_cutoff timestamptz;
begin
  if (select private.has_platform_role(array[
    'platform_admin'::public.platform_role,
    'platform_ops'::public.platform_role
  ])) then
    return;
  end if;

  select o.status, o.cutoff_at
  into v_status, v_cutoff
  from public.orders o
  where o.id = _order_id;

  if v_status is null then
    raise exception 'Unknown order: %', _order_id;
  end if;

  if upper((v_status)::text) in ('LOCKED', 'PREPARED', 'DISPATCHED', 'DELIVERED', 'CANCELLED') then
    raise exception 'Order is locked and cannot be changed';
  end if;

  if now() > v_cutoff then
    raise exception 'Cutoff has passed for this order';
  end if;
end;
$$;


--
-- Name: audit_direct_profile_scope_write(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_direct_profile_scope_write() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if current_setting('app.skip_profile_scope_write_audit', true) = 'on' then
    return new;
  end if;

  if new.company_id is distinct from old.company_id
     or new.location_id is distinct from old.location_id then
    insert into public.profile_scope_legacy_write_audit (
      actor_user_id,
      profile_id,
      old_company_id,
      new_company_id,
      old_location_id,
      new_location_id,
      note
    )
    values (
      auth.uid(),
      new.id,
      old.company_id,
      new.company_id,
      old.location_id,
      new.location_id,
      'direct_profile_scope_write'
    );
  end if;

  return new;
end;
$$;


--
-- Name: can_access_company(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_company(company_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    public.is_superadmin()
    or public.is_ops()
    or exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = (select auth.uid())
        and cm.company_id = company_uuid
        and cm.active = true
    )
    or exists (
      select 1
      from public.location_memberships lm
      where lm.user_id = (select auth.uid())
        and lm.company_id = company_uuid
        and lm.active = true
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = company_uuid
        and coalesce(p.active, true) = true
        and p.archived_at is null
        and p.disabled_at is null
    );
$$;


--
-- Name: can_access_location(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_access_location(location_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    public.is_superadmin()
    or public.is_ops()
    or exists (
      select 1
      from public.location_memberships lm
      where lm.user_id = (select auth.uid())
        and lm.location_id = location_uuid
        and lm.active = true
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.location_id = location_uuid
        and coalesce(p.active, true) = true
        and p.archived_at is null
        and p.disabled_at is null
    )
    or exists (
      select 1
      from public.company_locations cl
      join public.company_memberships cm
        on cm.company_id = cl.company_id
       and cm.user_id = (select auth.uid())
       and cm.active = true
      where cl.id = location_uuid
    )
    or exists (
      select 1
      from public.company_locations cl
      join public.profiles p
        on p.company_id = cl.company_id
       and p.id = (select auth.uid())
       and coalesce(p.active, true) = true
       and p.archived_at is null
       and p.disabled_at is null
      where cl.id = location_uuid
    );
$$;


--
-- Name: can_admin_company(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_admin_company(company_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    public.is_superadmin()
    or public.is_ops()
    or exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = (select auth.uid())
        and cm.company_id = company_uuid
        and cm.role = 'company_admin'::public.membership_role
        and cm.active = true
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = company_uuid
        and lower(coalesce(p.role::text, '')) = 'company_admin'
        and coalesce(p.active, true) = true
        and p.archived_at is null
        and p.disabled_at is null
    );
$$;


--
-- Name: can_admin_location(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_admin_location(location_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    public.is_superadmin()
    or public.is_ops()
    or exists (
      select 1
      from public.location_memberships lm
      where lm.user_id = (select auth.uid())
        and lm.location_id = location_uuid
        and lm.role = 'location_admin'::public.membership_role
        and lm.active = true
    )
    or exists (
      select 1
      from public.company_locations cl
      join public.company_memberships cm
        on cm.company_id = cl.company_id
       and cm.user_id = (select auth.uid())
       and cm.role = 'company_admin'::public.membership_role
       and cm.active = true
      where cl.id = location_uuid
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.location_id = location_uuid
        and lower(coalesce(p.role::text, '')) = 'location_admin'
        and coalesce(p.active, true) = true
        and p.archived_at is null
        and p.disabled_at is null
    )
    or exists (
      select 1
      from public.company_locations cl
      join public.profiles p
        on p.company_id = cl.company_id
       and p.id = (select auth.uid())
       and lower(coalesce(p.role::text, '')) = 'company_admin'
       and coalesce(p.active, true) = true
       and p.archived_at is null
       and p.disabled_at is null
      where cl.id = location_uuid
    );
$$;


--
-- Name: can_kitchen_location(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_kitchen_location(location_uuid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    join public.location_memberships lm
      on lm.user_id = p.id
     and lm.location_id = location_uuid
     and lm.active = true
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'kitchen'
      and coalesce(p.active, true) = true
      and p.archived_at is null
      and p.disabled_at is null
  );
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: repair_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.repair_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_type text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    state text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_run_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rid text
);


--
-- Name: claim_repair_jobs(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_repair_jobs(p_limit integer) RETURNS SETOF public.repair_jobs
    LANGUAGE sql
    AS $$
  with cte as (
    select id
    from public.repair_jobs
    where state = 'pending'
      and next_run_at <= now()
    order by next_run_at asc
    limit p_limit
    for update skip locked
  )
  update public.repair_jobs
  set state = 'running',
      updated_at = now()
  where id in (select id from cte)
  returning *;
$$;


--
-- Name: cleanup_ai_action_memory(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_ai_action_memory() RETURNS void
    LANGUAGE plpgsql
    AS $$
begin
  delete from public.ai_action_memory
  where expires_at < now();
end;
$$;


--
-- Name: compute_cutoff_at(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_cutoff_at(_location_id uuid, _service_date date) RETURNS timestamp with time zone
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare
  v_timezone text;
  v_cutoff time;
begin
  select
    coalesce(co.timezone, 'Europe/Oslo'),
    coalesce(lp.cutoff_local_time, cc.default_cutoff_local_time, time '08:00')
  into v_timezone, v_cutoff
  from public.company_locations cl
  inner join public.companies co on co.id = cl.company_id
  left join public.location_policies lp
    on lp.location_id = cl.id
  left join lateral (
    select c.default_cutoff_local_time
    from public.company_contracts c
    where c.company_id = cl.company_id
      and c.is_active = true
      and c.valid_from <= _service_date
      and (c.valid_to is null or c.valid_to >= _service_date)
    order by c.valid_from desc
    limit 1
  ) cc on true
  where cl.id = _location_id;

  if v_timezone is null then
    raise exception 'Unknown location for cutoff calculation: %', _location_id;
  end if;

  return ((_service_date::text || ' ' || v_cutoff::text)::timestamp at time zone v_timezone);
end;
$$;


--
-- Name: current_profile_active(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_profile_active() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select p.active from public.profiles p where p.id = auth.uid()), false)
$$;


--
-- Name: current_profile_company_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_profile_company_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select (select p.company_id from public.profiles p where p.id = auth.uid())
$$;


--
-- Name: current_profile_location_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_profile_location_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select (select p.location_id from public.profiles p where p.id = auth.uid())
$$;


--
-- Name: current_profile_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_profile_role() RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select p.role from public.profiles p where p.id = auth.uid()), 'employee'::public.user_role)
$$;


--
-- Name: ensure_invoice_head(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ensure_invoice_head(p_run_id uuid, p_company_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_invoice_id uuid;
begin
  if p_run_id is null or p_company_id is null then
    return null;
  end if;

  select i.id
  into v_invoice_id
  from public.invoices i
  where i.run_id = p_run_id
    and i.company_id = p_company_id
  limit 1;

  if v_invoice_id is not null then
    return v_invoice_id;
  end if;

  insert into public.invoices (
    run_id,
    company_id,
    status,
    currency_code,
    subtotal_nok,
    vat_nok,
    total_nok
  )
  values (
    p_run_id,
    p_company_id,
    'DRAFT'::public.invoice_status,
    'NOK',
    0,
    0,
    0
  )
  on conflict (run_id, company_id) do update
    set updated_at = now()
  returning id into v_invoice_id;

  return v_invoice_id;
end;
$$;


--
-- Name: extract_agreement_delivery_days(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.extract_agreement_delivery_days(p_delivery_days jsonb) RETURNS TABLE(weekday text)
    LANGUAGE sql IMMUTABLE
    AS $$
  with raw_values as (
    select value_text
    from (
      select jsonb_array_elements_text(p_delivery_days) as value_text
      where jsonb_typeof(p_delivery_days) = 'array'

      union all

      select jsonb_array_elements_text(p_delivery_days -> 'days') as value_text
      where jsonb_typeof(p_delivery_days) = 'object'
        and jsonb_typeof(p_delivery_days -> 'days') = 'array'
    ) s
  ), normalized as (
    select public.normalize_delivery_weekday(value_text) as weekday
    from raw_values
  )
  select distinct weekday
  from normalized
  where weekday is not null;
$$;


--
-- Name: finalize_due_service_days(timestamp with time zone, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_due_service_days(_as_of timestamp with time zone DEFAULT now(), _location_id uuid DEFAULT NULL::uuid, _service_date date DEFAULT NULL::date) RETURNS TABLE(delivery_run_id uuid, location_id uuid, service_date date, locked_order_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  rec record;
  v_delivery_run_id uuid;
  v_locked_count integer;
begin
  if _location_id is null then
    if not (select private.has_platform_role(array[
      'platform_admin'::public.platform_role,
      'platform_ops'::public.platform_role
    ])) then
      raise exception 'Only platform operators can finalize across all locations';
    end if;
  else
    if not (
      (select private.can_manage_location(_location_id))
      or (select private.has_platform_role(array[
        'platform_admin'::public.platform_role,
        'platform_ops'::public.platform_role
      ]))
    ) then
      raise exception 'Not authorized to finalize location %', _location_id;
    end if;
  end if;

  for rec in
    select distinct o.company_id, o.location_id, o.service_date
    from public.orders o
    where o.cutoff_at <= _as_of
      and (_location_id is null or o.location_id = _location_id)
      and (_service_date is null or o.service_date = _service_date)
      and o.status in ('draft', 'submitted')
  loop
    update public.orders o
    set status = 'cancelled',
        cancelled_at = coalesce(o.cancelled_at, _as_of),
        cancel_reason = coalesce(o.cancel_reason, 'Auto-cancelled: no items at cutoff')
    where o.location_id = rec.location_id
      and o.service_date = rec.service_date
      and o.status in ('draft', 'submitted')
      and not exists (
        select 1
        from public.order_items oi
        where oi.order_id = o.id
      );

    update public.orders o
    set status = 'locked',
        locked_at = coalesce(o.locked_at, _as_of)
    where o.location_id = rec.location_id
      and o.service_date = rec.service_date
      and o.status in ('draft', 'submitted')
      and exists (
        select 1
        from public.order_items oi
        where oi.order_id = o.id
      );

    update public.menu_service_days msd
    set state = 'locked',
        locked_at = coalesce(msd.locked_at, _as_of)
    where msd.location_id = rec.location_id
      and msd.service_date = rec.service_date
      and msd.state in ('draft', 'published');

    insert into public.delivery_runs (
      company_id,
      location_id,
      service_date,
      status,
      created_by
    )
    values (
      rec.company_id,
      rec.location_id,
      rec.service_date,
      'locked',
      auth.uid()
    )
    on conflict (location_id, service_date)
    do update
      set status = case
        when public.delivery_runs.status in ('prepared', 'packed', 'dispatched', 'delivered', 'issue', 'cancelled')
          then public.delivery_runs.status
        else excluded.status
      end
    returning id into v_delivery_run_id;

    perform public.refresh_delivery_run_items(v_delivery_run_id);

    select count(*)
    into v_locked_count
    from public.orders o
    where o.location_id = rec.location_id
      and o.service_date = rec.service_date
      and o.status = 'locked';

    delivery_run_id := v_delivery_run_id;
    location_id := rec.location_id;
    service_date := rec.service_date;
    locked_order_count := v_locked_count;
    return next;
  end loop;
end;
$$;


--
-- Name: generate_invoice_run(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_run(_company_id uuid, _period_start date, _period_end date) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_invoice_run_id uuid;
  v_currency text;
begin
  if not (select private.can_finance_company(_company_id)) then
    raise exception 'Not authorized to generate invoices for company %', _company_id;
  end if;

  select coalesce(
    (
      select cc.currency_code
      from public.company_contracts cc
      where cc.company_id = _company_id
        and cc.is_active = true
      order by cc.valid_from desc
      limit 1
    ),
    'NOK'
  )
  into v_currency;

  insert into public.invoice_runs (
    company_id,
    period_start,
    period_end,
    status,
    currency_code,
    created_by
  )
  values (
    _company_id,
    _period_start,
    _period_end,
    'draft',
    v_currency,
    auth.uid()
  )
  returning id into v_invoice_run_id;

  insert into public.invoice_lines (
    invoice_run_id,
    line_type,
    order_id,
    company_id,
    location_id,
    user_id,
    service_date,
    description,
    quantity,
    unit_price_cents_ex_vat,
    line_subtotal_cents_ex_vat,
    line_vat_cents,
    line_total_cents_inc_vat
  )
  select
    v_invoice_run_id,
    'order',
    o.id,
    o.company_id,
    o.location_id,
    o.user_id,
    o.service_date,
    'Lunch order ' || o.service_date::text || ' - ' || coalesce(p.full_name, o.user_id::text),
    1,
    greatest(round(
      (o.company_billable_cents_inc_vat::numeric / nullif(o.gross_cents_inc_vat, 0)::numeric)
      * o.subtotal_cents_ex_vat
    ), 0)::integer,
    greatest(round(
      (o.company_billable_cents_inc_vat::numeric / nullif(o.gross_cents_inc_vat, 0)::numeric)
      * o.subtotal_cents_ex_vat
    ), 0)::integer,
    o.company_billable_cents_inc_vat
      - greatest(round(
          (o.company_billable_cents_inc_vat::numeric / nullif(o.gross_cents_inc_vat, 0)::numeric)
          * o.subtotal_cents_ex_vat
        ), 0)::integer,
    o.company_billable_cents_inc_vat
  from public.orders o
  left join public.profiles p
    on p.id = o.user_id
  where o.company_id = _company_id
    and o.service_date between _period_start and _period_end
    and o.status in ('locked', 'prepared', 'dispatched', 'delivered')
    and o.company_billable_cents_inc_vat > 0;

  insert into public.invoice_lines (
    invoice_run_id,
    line_type,
    billing_adjustment_id,
    company_id,
    location_id,
    service_date,
    description,
    quantity,
    unit_price_cents_ex_vat,
    line_subtotal_cents_ex_vat,
    line_vat_cents,
    line_total_cents_inc_vat
  )
  select
    v_invoice_run_id,
    case
      when ba.adjustment_type = 'credit' then 'credit'::public.invoice_line_type
      else 'debit'::public.invoice_line_type
    end,
    ba.id,
    ba.company_id,
    ba.location_id,
    ba.effective_date,
    ba.description,
    1,
    case
      when ba.adjustment_type = 'credit' then
        -1 * round((ba.amount_cents_inc_vat::numeric * 100.0) / (100.0 + ba.vat_rate))::integer
      else
        round((ba.amount_cents_inc_vat::numeric * 100.0) / (100.0 + ba.vat_rate))::integer
    end,
    case
      when ba.adjustment_type = 'credit' then
        -1 * round((ba.amount_cents_inc_vat::numeric * 100.0) / (100.0 + ba.vat_rate))::integer
      else
        round((ba.amount_cents_inc_vat::numeric * 100.0) / (100.0 + ba.vat_rate))::integer
    end,
    case
      when ba.adjustment_type = 'credit' then
        -1 * (
          ba.amount_cents_inc_vat
          - round((ba.amount_cents_inc_vat::numeric * 100.0) / (100.0 + ba.vat_rate))::integer
        )
      else
        ba.amount_cents_inc_vat
        - round((ba.amount_cents_inc_vat::numeric * 100.0) / (100.0 + ba.vat_rate))::integer
    end,
    case
      when ba.adjustment_type = 'credit' then -1 * ba.amount_cents_inc_vat
      else ba.amount_cents_inc_vat
    end
  from public.billing_adjustments ba
  where ba.company_id = _company_id
    and ba.effective_date between _period_start and _period_end
    and ba.invoice_run_id is null;

  update public.billing_adjustments ba
  set invoice_run_id = v_invoice_run_id
  where ba.company_id = _company_id
    and ba.effective_date between _period_start and _period_end
    and ba.invoice_run_id is null;

  perform public.recalculate_invoice_run_totals(v_invoice_run_id);

  return v_invoice_run_id;
end;
$$;


--
-- Name: get_effective_product_price_ex_vat(uuid, uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_effective_product_price_ex_vat(_company_id uuid, _product_id uuid, _service_date date) RETURNS integer
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select coalesce(
    (
      select cpp.price_cents_ex_vat
      from public.company_product_prices cpp
      where cpp.company_id = _company_id
        and cpp.product_id = _product_id
        and cpp.valid_from <= _service_date
        and (cpp.valid_to is null or cpp.valid_to >= _service_date)
      order by cpp.valid_from desc
      limit 1
    ),
    (
      select p.base_price_cents_ex_vat
      from public.products p
      where p.id = _product_id
    )
  );
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name;

  return new;
end;
$$;


--
-- Name: is_driver(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_driver() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and lower(coalesce(p.role::text, '')) = 'driver'
      and coalesce(p.active, true) = true
      and p.archived_at is null
      and p.disabled_at is null
  );
$$;


--
-- Name: is_ops(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_ops() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and lower(coalesce(p.role::text, '')) = 'ops'
      and coalesce(p.active, true) = true
      and p.archived_at is null
      and p.disabled_at is null
  );
$$;


--
-- Name: is_platform_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_platform_admin() RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_legacy boolean := false;
begin
  if coalesce(public.is_superadmin(), false) or coalesce(public.is_ops(), false) then
    return true;
  end if;

  if to_regprocedure('public.is_platform_admin_legacy()') is not null then
    execute 'select public.is_platform_admin_legacy()' into v_legacy;
    return coalesce(v_legacy, false);
  end if;

  return false;
end;
$$;


--
-- Name: is_platform_admin_legacy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_platform_admin_legacy() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text in ('superadmin', 'ops')
      and coalesce(p.active, true) = true
      and p.archived_at is null
  );
$$;


--
-- Name: is_platform_admin_or_service(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_platform_admin_or_service() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.is_platform_admin() or auth.role() = 'service_role';
$$;


--
-- Name: is_superadmin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_superadmin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and lower(coalesce(p.role::text, '')) = 'superadmin'
      and coalesce(p.active, true) = true
      and p.archived_at is null
      and p.disabled_at is null
  );
$$;


--
-- Name: jwt_email_lower(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.jwt_email_lower() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  SELECT lower(nullif(auth.jwt() ->> 'email', ''));
$$;


--
-- Name: log_ai_config_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_ai_config_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  insert into public.ai_config_audit (
    config_id,
    changed_by,
    old_value,
    new_value
  )
  values (
    new.id,
    auth.uid(),
    to_jsonb(old),
    to_jsonb(new)
  );

  return new;
end;
$$;


--
-- Name: lp_advisory_lock(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_advisory_lock(p_key text) RETURNS void
    LANGUAGE plpgsql
    AS $$
declare
  k bigint;
begin
  -- 64-bit hash for advisory lock key
  k := hashtextextended(p_key, 0);
  perform pg_advisory_xact_lock(k);
end;
$$;


--
-- Name: lp_agreement_activate(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_agreement_activate(p_agreement_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  role public.user_role;
  v_location uuid;
  v_company uuid;

  idem_scope text := 'rpc:agreement_activate';
  idem_key text;
  req_hash text;
  idem jsonb;
  resp jsonb;
begin
  role := public.current_profile_role();
  if role <> 'superadmin' then raise exception 'forbidden' using errcode='42501'; end if;

  idem_key := p_agreement_id::text;
  req_hash := public.lp_req_hash(jsonb_build_object('agreementId',p_agreement_id));
  idem := public.lp_idem_begin(idem_scope, idem_key, req_hash, 86400);
  if (idem->>'hit')::boolean then
    return (idem->'response')::jsonb;
  end if;

  begin
    select company_id, location_id into v_company, v_location
    from public.agreements
    where id = p_agreement_id;

    if v_company is null then
      raise exception 'agreement not found' using errcode='23503';
    end if;

    perform public.lp_advisory_lock('agreement:' || v_location::text);

    update public.agreements
       set status = 'PAUSED',
           updated_at = now()
     where location_id = v_location
       and status = 'ACTIVE'
       and id <> p_agreement_id;

    update public.agreements
       set status = 'ACTIVE',
           updated_at = now()
     where id = p_agreement_id;

    resp := jsonb_build_object('ok', true, 'agreementId', p_agreement_id, 'companyId', v_company, 'locationId', v_location);
    perform public.lp_idem_complete(idem_scope, idem_key, req_hash, resp, 200);
    return resp;

  exception when others then
    perform public.lp_idem_fail(idem_scope, idem_key, req_hash, sqlerrm);
    raise;
  end;
end;
$$;


--
-- Name: lp_agreement_approve_active(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_agreement_approve_active(p_agreement_id uuid, p_actor_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_agreement public.agreements%rowtype;
  v_registration public.company_registrations%rowtype;
  v_now timestamptz := now();
begin
  if p_agreement_id is null then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_ID_REQUIRED';
  end if;

  select * into v_agreement
  from public.agreements
  where id = p_agreement_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'AGREEMENT_NOT_FOUND';
  end if;

  if upper(v_agreement.status::text) not in ('PENDING', 'ACTIVE') then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_NOT_PENDING';
  end if;

  select * into v_registration
  from public.company_registrations
  where company_id = v_agreement.company_id
  order by case when agreement_id = v_agreement.id then 0 else 1 end, created_at desc, id desc
  limit 1
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'REGISTRATION_NOT_FOUND';
  end if;

  update public.agreements
     set status = 'ACTIVE'::public.agreement_status,
         start_date = coalesce(start_date, current_date),
         reviewed_by = coalesce(reviewed_by, p_actor_user_id),
         reviewed_at = coalesce(reviewed_at, v_now),
         updated_at = v_now
   where id = v_agreement.id;

  update public.companies
     set status = 'ACTIVE'::public.company_status,
         updated_at = v_now
   where id = v_agreement.company_id;

  update public.company_registrations
     set status = 'APPROVED',
         agreement_id = v_agreement.id,
         reviewed_by = p_actor_user_id,
         reviewed_at = v_now,
         updated_at = v_now
   where id = v_registration.id;

  return jsonb_build_object(
    'ok', true,
    'agreement_id', v_agreement.id,
    'company_id', v_agreement.company_id,
    'contact_email', v_registration.contact_email,
    'contact_name', v_registration.contact_name
  );
end;
$$;


--
-- Name: lp_agreement_reject_pending(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_agreement_reject_pending(p_agreement_id uuid, p_actor_user_id uuid, p_reason text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_agreement public.agreements%rowtype;
  v_registration public.company_registrations%rowtype;
  v_now timestamptz := now();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_agreement_id is null then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_ID_REQUIRED';
  end if;

  select * into v_agreement
  from public.agreements
  where id = p_agreement_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'AGREEMENT_NOT_FOUND';
  end if;

  if upper(v_agreement.status::text) not in ('PENDING', 'CLOSED', 'REJECTED') then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_NOT_PENDING';
  end if;

  select * into v_registration
  from public.company_registrations
  where company_id = v_agreement.company_id
  order by case when agreement_id = v_agreement.id then 0 else 1 end, created_at desc, id desc
  limit 1
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'REGISTRATION_NOT_FOUND';
  end if;

  update public.agreements
     set status = 'CLOSED'::public.agreement_status,
         rejection_reason = v_reason,
         reviewed_by = coalesce(reviewed_by, p_actor_user_id),
         reviewed_at = coalesce(reviewed_at, v_now),
         updated_at = v_now
   where id = v_agreement.id;

  update public.companies
     set status = 'CLOSED'::public.company_status,
         updated_at = v_now
   where id = v_agreement.company_id;

  update public.company_registrations
     set status = 'REJECTED',
         agreement_id = v_agreement.id,
         reviewed_by = p_actor_user_id,
         reviewed_at = v_now,
         rejection_reason = v_reason,
         updated_at = v_now
   where id = v_registration.id;

  return jsonb_build_object(
    'ok', true,
    'agreement_id', v_agreement.id,
    'company_id', v_agreement.company_id,
    'contact_email', v_registration.contact_email,
    'contact_name', v_registration.contact_name
  );
end;
$$;


--
-- Name: lp_assert_company_active(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_assert_company_active(p_company_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare v_status text;
begin
  select status into v_status
  from public.companies
  where id = p_company_id;

  if v_status is distinct from 'ACTIVE' then
    raise exception 'Company not active';
  end if;
end;
$$;


--
-- Name: lp_company_order_summary(uuid, date, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_company_order_summary(p_company_id uuid, p_period_start date, p_period_end date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_can_company boolean;
  v_can_platform boolean;
  v_company jsonb;
  v_per_user jsonb;
  v_total_meal_units bigint;
  v_active_order_count int;
  v_total_subtotal bigint;
  v_total_vat bigint;
  v_total_gross bigint;
  v_span int;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_company_id is null then
    raise exception 'INVALID_COMPANY_ID' using errcode = 'P0001';
  end if;

  if p_period_end < p_period_start then
    raise exception 'INVALID_PERIOD' using errcode = 'P0001';
  end if;

  v_span := (p_period_end - p_period_start);
  if v_span > 731 then
    raise exception 'PERIOD_TOO_LONG' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.company_memberships cm
    where cm.user_id = v_uid
      and cm.company_id = p_company_id
      and cm.status = 'active'::public.membership_status
      and cm.role::text in ('company_admin', 'company_finance')
  )
  into v_can_company;

  select exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.role::text = 'superadmin'
  )
  into v_can_platform;

  if not v_can_company and not v_can_platform then
    raise exception 'FORBIDDEN_NOT_COMPANY_ADMIN' using errcode = 'P0001';
  end if;

  select
    coalesce(sum(oi.quantity), 0)::bigint,
    coalesce(count(distinct o.id), 0)::int,
    coalesce(sum(oi.line_subtotal_cents_ex_vat), 0)::bigint,
    coalesce(sum(oi.line_vat_cents), 0)::bigint,
    coalesce(sum(oi.line_total_cents_inc_vat), 0)::bigint
  into
    v_total_meal_units,
    v_active_order_count,
    v_total_subtotal,
    v_total_vat,
    v_total_gross
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.company_id = p_company_id
    and o.status = 'ACTIVE'::public.order_status
    and o.service_date >= p_period_start
    and o.service_date <= p_period_end;

  select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', x.user_id,
          'display_name', x.display_name,
          'active_order_count', x.active_order_count,
          'meal_units', x.meal_units,
          'subtotal_cents_ex_vat', x.subtotal_cents_ex_vat,
          'vat_cents', x.vat_cents,
          'gross_cents_inc_vat', x.gross_cents_inc_vat
        )
        order by x.gross_sort desc nulls last
      ),
      '[]'::jsonb
    )
  into v_per_user
  from (
    select
      o.user_id,
      coalesce(p.full_name, p.email, 'Ukjent') as display_name,
      count(distinct o.id)::int as active_order_count,
      coalesce(sum(oi.quantity), 0)::bigint as meal_units,
      coalesce(sum(oi.line_subtotal_cents_ex_vat), 0)::bigint as subtotal_cents_ex_vat,
      coalesce(sum(oi.line_vat_cents), 0)::bigint as vat_cents,
      coalesce(sum(oi.line_total_cents_inc_vat), 0)::bigint as gross_cents_inc_vat,
      coalesce(sum(oi.line_total_cents_inc_vat), 0)::bigint as gross_sort
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.profiles p on p.id = o.user_id
    where o.company_id = p_company_id
      and o.status = 'ACTIVE'::public.order_status
      and o.service_date >= p_period_start
      and o.service_date <= p_period_end
    group by o.user_id, p.full_name, p.email
  ) x;

  v_company := jsonb_build_object(
    'company_id', p_company_id,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'total_meal_units', v_total_meal_units,
    'active_order_count', v_active_order_count,
    'total_subtotal_cents_ex_vat', v_total_subtotal,
    'total_vat_cents', v_total_vat,
    'total_gross_cents_inc_vat', v_total_gross,
    'per_user', v_per_user
  );

  return jsonb_build_object(
    'summary', v_company
  );
end;
$$;


--
-- Name: lp_company_register(text, text, integer, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_company_register(p_company_name text, p_orgnr text, p_employee_count integer, p_contact_name text, p_contact_email text, p_contact_phone text, p_address_line text, p_postal_code text, p_postal_city text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_company_id uuid;
  v_location_id uuid;
  v_agreement_id uuid;
  v_registration_id uuid;

  v_orgnr text := regexp_replace(coalesce(p_orgnr, ''), '\D', '', 'g');
  v_company_name text := nullif(btrim(coalesce(p_company_name, '')), '');
  v_contact_name text := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_contact_email text := lower(nullif(btrim(coalesce(p_contact_email, '')), ''));
  v_contact_phone text := regexp_replace(coalesce(p_contact_phone, ''), '\D', '', 'g');
  v_address_line text := nullif(btrim(coalesce(p_address_line, '')), '');
  v_postal_code text := regexp_replace(coalesce(p_postal_code, ''), '\D', '', 'g');
  v_postal_city text := nullif(btrim(coalesce(p_postal_city, '')), '');
  v_full_address text;
begin
  if length(v_orgnr) <> 9 then
    raise exception 'ORGNR_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('lp_company_register'),
    hashtext(v_orgnr)
  );

  if v_company_name is null then
    raise exception 'COMPANY_NAME_REQUIRED';
  end if;

  if p_employee_count is null or p_employee_count < 20 then
    raise exception 'EMPLOYEE_COUNT_MIN_20';
  end if;

  if v_contact_name is null then
    raise exception 'CONTACT_NAME_REQUIRED';
  end if;

  if v_contact_email is null
    or v_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  then
    raise exception 'CONTACT_EMAIL_INVALID';
  end if;

  if v_contact_phone is null or v_contact_phone = '' then
    raise exception 'CONTACT_PHONE_REQUIRED';
  end if;

  if v_address_line is null then
    raise exception 'ADDRESS_LINE_REQUIRED';
  end if;

  if length(v_postal_code) <> 4 then
    raise exception 'POSTAL_CODE_INVALID';
  end if;

  if v_postal_city is null then
    raise exception 'POSTAL_CITY_REQUIRED';
  end if;

  if exists (
    select 1
    from public.companies c
    where c.deleted_at is null
      and c.status in (
        'PENDING'::public.company_status,
        'ACTIVE'::public.company_status
      )
      and (
        btrim(coalesce(c.orgnr, '')) = v_orgnr
        or btrim(coalesce(c.organization_number, '')) = v_orgnr
      )
  ) then
    raise exception 'ORGNR_ALREADY_REGISTERED';
  end if;

  if exists (
    select 1
    from public.company_registrations cr
    where cr.orgnr = v_orgnr
      and cr.created_at >= now() - interval '24 hours'
  ) then
    raise exception 'ORGNR_RECENT_REGISTRATION_EXISTS';
  end if;

  v_full_address := trim(both ' ' from (
    v_address_line || ', ' || v_postal_code || ' ' || v_postal_city
  ));

  insert into public.companies (
    name,
    orgnr,
    organization_number,
    status,
    employee_count,
    contact_name,
    contact_email,
    contact_phone,
    address
  )
  values (
    v_company_name,
    v_orgnr,
    v_orgnr,
    'PENDING'::public.company_status,
    p_employee_count,
    v_contact_name,
    v_contact_email,
    v_contact_phone,
    v_full_address
  )
  returning id into v_company_id;

  insert into public.company_locations (
    company_id,
    name,
    address
  )
  values (
    v_company_id,
    'Hovedlokasjon',
    v_full_address
  )
  returning id into v_location_id;

  update public.companies
  set default_location_id = v_location_id,
      updated_at = now()
  where id = v_company_id;

  insert into public.agreements (
    company_id,
    location_id,
    status,
    submitted_by_email,
    submitted_by_name,
    comment_from_company
  )
  values (
    v_company_id,
    v_location_id,
    'PENDING'::public.agreement_status,
    v_contact_email,
    v_contact_name,
    'Innsendt via offentlig firmaregistrering.'
  )
  returning id into v_agreement_id;

  insert into public.company_registrations (
    company_id,
    agreement_id,
    status,
    orgnr,
    company_name,
    submitted_by_email,
    submitted_by_name,
    contact_name,
    contact_email,
    contact_phone,
    address_line,
    postal_code,
    city,
    employee_count,
    submitted_payload,
    raw_payload
  )
  values (
    v_company_id,
    v_agreement_id,
    'PENDING',
    v_orgnr,
    v_company_name,
    v_contact_email,
    v_contact_name,
    v_contact_name,
    v_contact_email,
    v_contact_phone,
    v_address_line,
    v_postal_code,
    v_postal_city,
    p_employee_count,
    jsonb_build_object(
      'orgnr', v_orgnr,
      'company_name', v_company_name,
      'employee_count', p_employee_count,
      'contact_name', v_contact_name,
      'contact_email', v_contact_email,
      'contact_phone', v_contact_phone,
      'address_line', v_address_line,
      'postal_code', v_postal_code,
      'postal_city', v_postal_city
    ),
    jsonb_build_object(
      'p_orgnr', p_orgnr,
      'p_company_name', p_company_name,
      'p_employee_count', p_employee_count,
      'p_contact_name', p_contact_name,
      'p_contact_email', p_contact_email,
      'p_contact_phone', p_contact_phone,
      'p_address_line', p_address_line,
      'p_postal_code', p_postal_code,
      'p_postal_city', p_postal_city
    )
  )
  returning id into v_registration_id;

  insert into public.audit_events (
    action,
    entity_type,
    entity_id,
    company_id,
    location_id,
    actor_email,
    actor_role,
    summary,
    detail,
    scope,
    metadata
  )
  values (
    'company_registration_submitted',
    'company_registration',
    v_registration_id::text,
    v_company_id,
    v_location_id,
    v_contact_email,
    'public',
    'Firma registrerte avtaleforespørsel.',
    jsonb_build_object(
      'company_id', v_company_id,
      'agreement_id', v_agreement_id,
      'registration_id', v_registration_id,
      'orgnr', v_orgnr
    ),
    'superadmin',
    jsonb_build_object(
      'company_id', v_company_id,
      'agreement_id', v_agreement_id,
      'registration_id', v_registration_id,
      'orgnr', v_orgnr,
      'source', 'public_register_company'
    )
  );

  return json_build_object(
    'company_id', v_company_id,
    'status', 'PENDING',
    'receipt', json_build_object('message', 'Registreringen er mottatt.')
  );
end;
$_$;


--
-- Name: lp_delivery_set_status(uuid, public.delivery_status, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_delivery_set_status(p_delivery_id uuid, p_status public.delivery_status, p_proof jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  -- idempotency
  idem_scope text := 'rpc:delivery_set_status';
  idem_key   text := p_delivery_id::text || '|' || p_status::text;
  req_hash   text := public.lp_req_hash(
    jsonb_build_object(
      'deliveryId', p_delivery_id,
      'status', p_status,
      'proof', coalesce(p_proof, '{}'::jsonb)
    )
  );
  idem jsonb;
  resp jsonb;

  -- auth / role
  uid uuid;
  role public.user_role;

  -- delivery row
  v_company uuid;
  v_location uuid;
  v_date date;
  v_run_id uuid;
  prev_status public.delivery_status;

  -- guards
  ok boolean;
  v_today date;

  -- ESG
  did_increment boolean := false;
begin
  -- Idempotency (cached response if already completed)
  idem := public.lp_idem_begin(idem_scope, idem_key, req_hash, 86400);
  if (idem->>'hit')::boolean then
    return (idem->'response')::jsonb;
  end if;

  begin
    uid := auth.uid();
    if uid is null then
      raise exception 'not authenticated' using errcode = '42501';
    end if;

    role := public.current_profile_role();
    if role not in ('driver','superadmin') then
      raise exception 'forbidden' using errcode = '42501';
    end if;

    -- Fetch delivery + lock row (deterministic transition)
    select d.company_id, d.location_id, d.date, d.run_id, d.status
      into v_company, v_location, v_date, v_run_id, prev_status
    from public.deliveries d
    where d.id = p_delivery_id
    for update;

    if v_company is null then
      raise exception 'delivery not found' using errcode = '23503';
    end if;

    -- Driver: only today (Oslo)
    v_today := public.oslo_today();
    if role = 'driver' and v_date <> v_today then
      raise exception 'forbidden: driver can only update today' using errcode = '42501';
    end if;

    -- Driver: only deliveries tied to own run
    if role = 'driver' then
      if v_run_id is null then
        raise exception 'forbidden: delivery has no run' using errcode = '42501';
      end if;

      select exists(
        select 1
        from public.driver_runs r
        where r.id = v_run_id
          and r.driver_user_id = uid
      ) into ok;

      if ok is distinct from true then
        raise exception 'forbidden: not your delivery' using errcode = '42501';
      end if;
    end if;

    -- Update delivery
    update public.deliveries
       set status = p_status,
           proof = coalesce(p_proof, '{}'::jsonb),
           delivered_at = case
             when p_status = 'DELIVERED' then coalesce(delivered_at, now())
             else delivered_at
           end,
           delivered_by = case
             when p_status = 'DELIVERED' then coalesce(delivered_by, uid)
             else delivered_by
           end,
           updated_at = now()
     where id = p_delivery_id;

    -- Audit
    insert into public.audit_events(
      rid, actor_user_id, actor_role, action,
      entity_type, entity_id, company_id, location_id,
      summary, detail, metadata
    )
    values (
      null,
      uid,
      role::text,
      'delivery_set_status',
      'delivery',
      p_delivery_id::text,
      v_company,
      v_location,
      'Delivery status updated',
      jsonb_build_object(
        'from', prev_status,
        'to', p_status,
        'proof', coalesce(p_proof,'{}'::jsonb)
      ),
      '{}'::jsonb
    );

    -- ESG delivered: ONLY on transition to DELIVERED (idempotent)
    if prev_status is distinct from 'DELIVERED' and p_status = 'DELIVERED' then
      insert into public.esg_daily(date, company_id, location_id, active_orders, cancelled, produced, delivered, notes)
      values (v_date, v_company, v_location, 0, 0, 0, 1, jsonb_build_object('source','delivery'))
      on conflict (date, location_id)
      do update set delivered = public.esg_daily.delivered + 1;

      did_increment := true;
    end if;

    resp := jsonb_build_object(
      'ok', true,
      'deliveryId', p_delivery_id,
      'from', prev_status,
      'to', p_status,
      'esgIncremented', did_increment,
      'companyId', v_company,
      'locationId', v_location,
      'date', v_date,
      'ts', now()
    );

    perform public.lp_idem_complete(idem_scope, idem_key, req_hash, resp, 200);
    return resp;

  exception when others then
    perform public.lp_idem_fail(idem_scope, idem_key, req_hash, sqlerrm);
    raise;
  end;
end;
$$;


--
-- Name: lp_esg_rollup_month(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_esg_rollup_month(p_month_start date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  role public.user_role;
  ms date;
  me date;

  idem_scope text := 'rpc:esg_rollup_month';
  idem_key text;
  req_hash text;
  idem jsonb;
  resp jsonb;
begin
  role := public.current_profile_role();
  if role <> 'superadmin' then raise exception 'forbidden' using errcode='42501'; end if;

  ms := date_trunc('month', coalesce(p_month_start, public.oslo_today()))::date;
  me := (ms + interval '1 month' - interval '1 day')::date;

  idem_key := ms::text;
  req_hash := public.lp_req_hash(jsonb_build_object('monthStart',ms,'monthEnd',me));
  idem := public.lp_idem_begin(idem_scope, idem_key, req_hash, 86400);
  if (idem->>'hit')::boolean then
    return (idem->'response')::jsonb;
  end if;

  begin
    perform public.lp_advisory_lock('esg:' || ms::text);

    delete from public.esg_monthly where month_start=ms;

    insert into public.esg_monthly(month_start, company_id, basis)
    select
      ms,
      company_id,
      jsonb_build_object(
        'active_orders', sum(active_orders),
        'cancelled', sum(cancelled),
        'produced', sum(produced),
        'delivered', sum(delivered)
      ) as basis
    from public.esg_daily
    where date between ms and me
    group by company_id;

    resp := jsonb_build_object('ok', true, 'monthStart', ms);
    perform public.lp_idem_complete(idem_scope, idem_key, req_hash, resp, 200);
    return resp;

  exception when others then
    perform public.lp_idem_fail(idem_scope, idem_key, req_hash, sqlerrm);
    raise;
  end;
end;
$$;


--
-- Name: lp_idem_begin(text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_idem_begin(p_scope text, p_key text, p_request_hash text, p_ttl_seconds integer DEFAULT 86400) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  r record;
  now_ts timestamptz := now();
  exp_ts timestamptz := now_ts + make_interval(secs => greatest(p_ttl_seconds, 60));
begin
  -- Normalize
  p_scope := btrim(coalesce(p_scope,''));
  p_key := btrim(coalesce(p_key,''));
  p_request_hash := btrim(coalesce(p_request_hash,''));

  if p_scope = '' or p_key = '' or p_request_hash = '' then
    raise exception 'idempotency: missing scope/key/hash' using errcode='23514';
  end if;

  -- Try fetch existing row
  select scope, key, request_hash, status, response_json, response_code, expires_at
    into r
  from public.idempotency
  where scope = p_scope and key = p_key
  for update;

  if found then
    -- Expired row: allow reuse by resetting
    if r.expires_at is not null and r.expires_at < now_ts then
      update public.idempotency
         set request_hash = p_request_hash,
             status = 'IN_PROGRESS',
             response_code = null,
             response_json = null,
             last_error = null,
             expires_at = exp_ts,
             updated_at = now_ts
       where scope = p_scope and key = p_key;

      return jsonb_build_object('hit', false);
    end if;

    -- If hash mismatch: fail-closed
    if coalesce(r.request_hash,'') <> p_request_hash then
      raise exception 'idempotency hash mismatch for scope=% key=%' , p_scope, p_key
        using errcode='23514';
    end if;

    -- If completed: return cached response
    if r.status = 'COMPLETED' and r.response_json is not null then
      return jsonb_build_object(
        'hit', true,
        'response', r.response_json,
        'status_code', r.response_code
      );
    end if;

    -- If in progress: refuse (prevents duplicate concurrent execution)
    if r.status = 'IN_PROGRESS' then
      raise exception 'idempotency in progress for scope=% key=%', p_scope, p_key
        using errcode='23514';
    end if;

    -- If failed: allow retry with same hash (reset to IN_PROGRESS)
    if r.status = 'FAILED' then
      update public.idempotency
         set status = 'IN_PROGRESS',
             last_error = null,
             expires_at = exp_ts,
             updated_at = now_ts
       where scope = p_scope and key = p_key;

      return jsonb_build_object('hit', false);
    end if;

    -- Default: treat as in-progress
    raise exception 'idempotency invalid state' using errcode='23514';
  end if;

  -- Insert new row
  insert into public.idempotency(scope, key, request_hash, status, expires_at, created_at, updated_at)
  values (p_scope, p_key, p_request_hash, 'IN_PROGRESS', exp_ts, now_ts, now_ts);

  return jsonb_build_object('hit', false);
end;
$$;


--
-- Name: lp_idem_complete(text, text, text, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_idem_complete(p_scope text, p_key text, p_request_hash text, p_response_json jsonb, p_response_code integer DEFAULT 200) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare now_ts timestamptz := now();
begin
  update public.idempotency
     set status = 'COMPLETED',
         response_code = p_response_code,
         response_json = p_response_json,
         last_error = null,
         updated_at = now_ts
   where scope = p_scope
     and key = p_key
     and request_hash = p_request_hash;
end;
$$;


--
-- Name: lp_idem_fail(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_idem_fail(p_scope text, p_key text, p_request_hash text, p_error text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare now_ts timestamptz := now();
begin
  update public.idempotency
     set status = 'FAILED',
         last_error = left(coalesce(p_error,''), 4000),
         updated_at = now_ts
   where scope = p_scope
     and key = p_key
     and request_hash = p_request_hash;
end;
$$;


--
-- Name: lp_invoice_build_month(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_invoice_build_month(p_month_start date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  role public.user_role;
  ms date;
  me date;
  run_id uuid;

  idem_scope text := 'rpc:invoice_build_month';
  idem_key text;
  req_hash text;
  idem jsonb;
  resp jsonb;
begin
  role := public.current_profile_role();
  if role <> 'superadmin' then raise exception 'forbidden' using errcode='42501'; end if;

  ms := date_trunc('month', coalesce(p_month_start, public.oslo_today()))::date;
  me := (ms + interval '1 month' - interval '1 day')::date;

  idem_key := ms::text;
  req_hash := public.lp_req_hash(jsonb_build_object('monthStart',ms,'monthEnd',me));
  idem := public.lp_idem_begin(idem_scope, idem_key, req_hash, 86400);
  if (idem->>'hit')::boolean then
    return (idem->'response')::jsonb;
  end if;

  begin
    perform public.lp_advisory_lock('invoice:' || ms::text);

    insert into public.invoice_runs(period_start, period_end, status, rid)
    values (ms, me, 'DRAFT', null)
    on conflict (period_start, period_end)
    do update set updated_at=now()
    returning id into run_id;

    delete from public.invoice_lines where run_id=run_id;
    delete from public.tripletex_invoices where run_id=run_id;

    insert into public.invoice_lines(run_id, company_id, location_id, tier, unit_price_nok, quantity, amount_nok, basis)
    select
      run_id,
      pm.company_id,
      pm.location_id,
      pm.tier,
      case when pm.tier='BASIS' then a.price_per_meal_nok else a.price_per_meal_luxus_nok end as unit_price_nok,
      sum(pm.active_orders)::int as quantity,
      (sum(pm.active_orders) * case when pm.tier='BASIS' then a.price_per_meal_nok else a.price_per_meal_luxus_nok end)::int as amount_nok,
      jsonb_build_object('source','production_manifests','period_start',ms,'period_end',me) as basis
    from public.production_manifests pm
    join public.agreements a
      on a.company_id=pm.company_id
     and a.location_id=pm.location_id
     and a.status='ACTIVE'
    where pm.date between ms and me
    group by pm.company_id, pm.location_id, pm.tier, a.price_per_meal_nok, a.price_per_meal_luxus_nok;

    insert into public.tripletex_invoices(run_id, company_id, status)
    select distinct run_id, il.company_id, 'PENDING'::public.tripletex_sync_status
    from public.invoice_lines il
    where il.run_id = run_id;

    update public.invoice_runs set status='READY', updated_at=now() where id=run_id;

    resp := jsonb_build_object('ok', true, 'runId', run_id, 'periodStart', ms, 'periodEnd', me);
    perform public.lp_idem_complete(idem_scope, idem_key, req_hash, resp, 200);
    return resp;

  exception when others then
    perform public.lp_idem_fail(idem_scope, idem_key, req_hash, sqlerrm);
    raise;
  end;
end;
$$;


--
-- Name: lp_order_set(date, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_order_set(p_date date, p_action text, p_note text DEFAULT NULL::text, p_slot text DEFAULT NULL::text, p_choice_key text DEFAULT NULL::text, p_item_key text DEFAULT 'default'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_agreement public.agreements%rowtype;

  v_action text := upper(trim(coalesce(p_action, '')));
  v_slot text := coalesce(nullif(trim(coalesce(p_slot, '')), ''), 'default');
  v_note text := nullif(trim(coalesce(p_note, '')), '');

  v_oslo_now timestamptz := timezone('Europe/Oslo', now());
  v_oslo_today date := (timezone('Europe/Oslo', now()))::date;
  v_oslo_time time := (timezone('Europe/Oslo', now()))::time;

  v_isodow int;
  v_day_key text;
  v_db_status text;
  v_day_tier text;

  v_order_id uuid;
  v_saved_status text;
  v_receipt timestamptz := clock_timestamp();
  v_rid text := format('rid_%s', replace(gen_random_uuid()::text, '-', ''));

  v_status_out text;

  v_choice_raw text;
  v_item_raw text;
  v_slug_choice text;

  v_menu_service_day_id uuid;
  v_msdi_count int;
  v_msdi_id uuid;
  v_product_id uuid;
  v_expect_cents int;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  if p_date is null then
    raise exception using errcode = 'P0001', message = 'DATE_REQUIRED';
  end if;

  if v_action in ('SET', 'PLACE') then
    v_action := 'ORDER';
  elsif v_action = 'ORDER' then
    v_action := 'ORDER';
  end if;

  if v_action not in ('ORDER', 'CANCEL') then
    raise exception using errcode = 'P0001', message = 'ACTION_INVALID';
  end if;

  if lower(v_slot) = 'lunch' then
    v_slot := 'default';
  end if;

  if v_slot is distinct from 'default' then
    raise exception using errcode = 'P0001', message = 'INVALID_SLOT';
  end if;

  select p.*
    into v_profile
  from public.profiles p
  where p.id = v_uid
  order by p.updated_at desc
  limit 1;

  if not found or v_profile.company_id is null or v_profile.location_id is null then
    raise exception using errcode = 'P0001', message = 'PROFILE_MISSING';
  end if;

  if p_date < v_oslo_today then
    raise exception using errcode = 'P0001', message = 'CUTOFF_PASSED';
  end if;

  if p_date = v_oslo_today and v_oslo_time >= time '08:00' then
    raise exception using errcode = 'P0001', message = 'CUTOFF_PASSED';
  end if;

  -- ── CANCEL: ingen krav om publisert meny eller aktiv avtale-innhold ─────
  if v_action = 'CANCEL' then
    select o.id
      into v_order_id
    from public.orders o
    where o.user_id = v_uid
      and o.date = p_date
      and o.status = 'ACTIVE'::public.order_status
    limit 1;

    if v_order_id is null then
      return jsonb_build_object(
        'ok', true,
        'order_id', null,
        'status', 'CANCELED',
        'company_id', v_profile.company_id,
        'location_id', v_profile.location_id,
        'date', p_date,
        'slot', v_slot,
        'receipt', v_receipt,
        'rid', v_rid,
        'action', 'CANCEL'
      );
    end if;

    delete from public.order_items oi where oi.order_id = v_order_id;

    update public.orders o
    set status = 'CANCELLED'::public.order_status,
        updated_at = now()
    where o.id = v_order_id
    returning o.status::text into v_saved_status;

    delete from public.day_choices dc
    where dc.company_id = v_profile.company_id
      and dc.location_id = v_profile.location_id
      and dc.user_id = v_uid
      and dc.date = p_date;

    v_db_status := 'CANCELLED';

    insert into public.outbox (
      event_key,
      payload,
      status,
      attempts,
      last_error,
      locked_at,
      locked_by,
      next_retry_at,
      delivered_at,
      updated_at
    )
    values (
      format('order.set:%s:%s:%s', v_uid::text, p_date::text, coalesce(v_slot, '')),
      jsonb_build_object(
        'event', 'order.set',
        'action', 'CANCEL',
        'order_id', v_order_id,
        'company_id', v_profile.company_id,
        'location_id', v_profile.location_id,
        'user_id', v_uid,
        'date', p_date,
        'slot', v_slot,
        'status', coalesce(v_saved_status, 'CANCELLED'),
        'receipt', v_receipt,
        'rid', v_rid
      ),
      'PENDING',
      0,
      null,
      null,
      null,
      null,
      null,
      now()
    )
    on conflict (event_key) do update
      set payload = excluded.payload,
          status = 'PENDING',
          attempts = 0,
          last_error = null,
          locked_at = null,
          locked_by = null,
          next_retry_at = null,
          delivered_at = null,
          updated_at = now();

    insert into public.outbox (
      event_key,
      payload,
      status,
      attempts,
      last_error,
      locked_at,
      locked_by,
      next_retry_at,
      delivered_at,
      updated_at
    )
    values (
      format('rollup.rebuild:%s', p_date::text),
      jsonb_build_object(
        'event', 'rollup.rebuild',
        'date', p_date,
        'company_id', v_profile.company_id,
        'rid', v_rid
      ),
      'PENDING',
      0,
      null,
      null,
      null,
      null,
      null,
      now()
    )
    on conflict (event_key) do update
      set payload = excluded.payload,
          status = 'PENDING',
          attempts = 0,
          last_error = null,
          locked_at = null,
          locked_by = null,
          next_retry_at = null,
          delivered_at = null,
          updated_at = now();

    return jsonb_build_object(
      'ok', true,
      'order_id', v_order_id,
      'status', 'CANCELED',
      'company_id', v_profile.company_id,
      'location_id', v_profile.location_id,
      'date', p_date,
      'slot', v_slot,
      'receipt', v_receipt,
      'rid', v_rid,
      'action', 'CANCEL'
    );
  end if;

  -- ── ORDER (SET): avtale + meny + linjer ─────────────────────────────────
  select a.*
    into v_agreement
  from public.agreements a
  where a.company_id = v_profile.company_id
    and a.location_id = v_profile.location_id
    and upper(a.status::text) = 'ACTIVE'
  order by coalesce(a.starts_at, '-infinity'::timestamptz) desc, a.updated_at desc
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'NO_ACTIVE_AGREEMENT';
  end if;

  if v_agreement.starts_at is not null and p_date < v_agreement.starts_at::date then
    raise exception using errcode = 'P0001', message = 'NO_ACTIVE_AGREEMENT';
  end if;

  v_isodow := extract(isodow from p_date)::int;
  v_day_key := case v_isodow
    when 1 then 'mon'
    when 2 then 'tue'
    when 3 then 'wed'
    when 4 then 'thu'
    when 5 then 'fri'
    else null
  end;

  if v_day_key is null then
    raise exception using errcode = 'P0001', message = 'OUTSIDE_DELIVERY_DAYS';
  end if;

  if not (
    (
      jsonb_typeof(v_agreement.delivery_days) = 'array'
      and exists (
        select 1
        from jsonb_array_elements(v_agreement.delivery_days) as d(v)
        where (
          jsonb_typeof(d.v) = 'string'
          and lower(trim(both '"' from d.v::text)) in (v_day_key, v_isodow::text)
        )
        or (
          jsonb_typeof(d.v) = 'number'
          and regexp_replace(d.v::text, '\s', '', 'g') = v_isodow::text
        )
      )
    )
    or
    (
      jsonb_typeof(v_agreement.delivery_days) = 'object'
      and (
        v_agreement.delivery_days ? v_day_key
        or v_agreement.delivery_days ? v_isodow::text
      )
    )
    or
    (
      jsonb_typeof(v_agreement.delivery_days) = 'string'
      and exists (
        select 1
        from regexp_split_to_table(
          lower(trim(both '"' from v_agreement.delivery_days::text)),
          '[,\s]+'
        ) as token(v)
        where token.v in (v_day_key, v_isodow::text)
      )
    )
  ) then
    raise exception using errcode = 'P0001', message = 'OUTSIDE_DELIVERY_DAYS';
  end if;

  select coalesce(add.tier::text, v_agreement.tier::text)
    into v_day_tier
  from public.agreement_delivery_days add
  where add.agreement_id = v_agreement.id
    and add.weekday = v_day_key
  limit 1;

  if v_day_tier is null then
    v_day_tier := v_agreement.tier::text;
  end if;

  v_expect_cents := case upper(trim(coalesce(v_day_tier, '')))
    when 'BASIS' then 9000
    when 'LUXUS' then 13000
    when 'ENTERPRISE' then 17000
    else null
  end;

  v_choice_raw := nullif(lower(trim(coalesce(p_choice_key, ''))), '');
  if v_choice_raw is null and v_note is not null then
    v_choice_raw := nullif(lower(trim(split_part(v_note::text, '||', 1))), '');
  end if;

  v_item_raw := nullif(lower(trim(coalesce(p_item_key, 'default'))), '');
  if v_item_raw is null then
    v_item_raw := 'default';
  end if;

  if v_choice_raw is null or length(v_choice_raw) = 0 then
    raise exception using errcode = 'P0001', message = 'CHOICE_KEY_REQUIRED';
  end if;

  v_slug_choice := regexp_replace(v_choice_raw, '[^a-z0-9æøå]+', '', 'g');

  select msd.id
    into v_menu_service_day_id
  from public.menu_service_days msd
  where msd.location_id = v_profile.location_id
    and msd.service_date = p_date
    and msd.state in ('published', 'locked')
  limit 1;

  if v_menu_service_day_id is null then
    raise exception using errcode = 'P0001', message = 'MENU_NOT_PUBLISHED';
  end if;

  select count(*)::int
    into v_msdi_count
  from public.menu_service_day_items msdi
  where msdi.menu_service_day_id = v_menu_service_day_id;

  if coalesce(v_msdi_count, 0) = 0 then
    raise exception using errcode = 'P0001', message = 'MENU_SERVICE_DAY_ITEMS_MISSING';
  end if;

  select msdi.id, msdi.product_id
    into v_msdi_id, v_product_id
  from public.menu_service_day_items msdi
  join public.products pr on pr.id = msdi.product_id
  join public.product_categories pc on pc.id = pr.category_id
  where msdi.menu_service_day_id = v_menu_service_day_id
    and regexp_replace(
      lower(translate(trim(pc.name), 'æøåÆØÅ', 'eoaEOA')),
      '[^a-z0-9]+',
      '',
      'g'
    ) = v_slug_choice
    and (
      v_expect_cents is null
      or msdi.offered_price_cents_ex_vat = v_expect_cents
    )
    and (
      v_item_raw = 'default'
      or lower(trim(coalesce(pr.sku, ''))) = v_item_raw
    )
  order by msdi.sort_order nulls last, msdi.created_at asc, msdi.id asc
  limit 1;

  if v_msdi_id is null then
    select msdi.id, msdi.product_id
      into v_msdi_id, v_product_id
    from public.menu_service_day_items msdi
    join public.products pr on pr.id = msdi.product_id
    join public.product_categories pc on pc.id = pr.category_id
    where msdi.menu_service_day_id = v_menu_service_day_id
      and regexp_replace(
        lower(translate(trim(pc.name), 'æøåÆØÅ', 'eoaEOA')),
        '[^a-z0-9]+',
        '',
        'g'
      ) = v_slug_choice
      and (
        v_item_raw = 'default'
        or lower(trim(coalesce(pr.sku, ''))) = v_item_raw
      )
    order by msdi.sort_order nulls last, msdi.created_at asc, msdi.id asc
    limit 1;
  end if;

  if v_msdi_id is null then
    raise exception using errcode = 'P0001', message = 'MENU_SERVICE_DAY_ITEM_NOT_FOUND';
  end if;

  v_db_status := 'ACTIVE';

  select o.id
    into v_order_id
  from public.orders o
  where o.user_id = v_uid
    and o.date = p_date
    and o.status = 'ACTIVE'::public.order_status
  limit 1;

  if v_order_id is null then
    insert into public.orders (
      user_id,
      company_id,
      location_id,
      date,
      slot,
      status,
      note,
      updated_at
    )
    values (
      v_uid,
      v_profile.company_id,
      v_profile.location_id,
      p_date,
      v_slot,
      v_db_status::public.order_status,
      v_note,
      now()
    )
    returning id into v_order_id;
  else
    update public.orders o
    set
      company_id = v_profile.company_id,
      location_id = v_profile.location_id,
      slot = v_slot,
      status = v_db_status::public.order_status,
      note = coalesce(v_note, o.note),
      updated_at = now()
    where o.id = v_order_id
    returning o.status::text into v_saved_status;
  end if;

  delete from public.order_items oi where oi.order_id = v_order_id;

  insert into public.order_items (order_id, product_id, quantity)
  values (v_order_id, v_product_id, 1);

  insert into public.day_choices (
    company_id,
    location_id,
    user_id,
    date,
    choice_key,
    item_key,
    status,
    updated_at
  )
  values (
    v_profile.company_id,
    v_profile.location_id,
    v_uid,
    p_date,
    v_choice_raw,
    case when v_item_raw = 'default' then null else v_item_raw end,
    'ACTIVE',
    now()
  )
  on conflict on constraint day_choices_company_location_user_date_key
  do update set
    choice_key = excluded.choice_key,
    item_key = excluded.item_key,
    status = 'ACTIVE',
    updated_at = now();

  select o.status::text
    into v_saved_status
  from public.orders o
  where o.id = v_order_id;

  insert into public.outbox (
    event_key,
    payload,
    status,
    attempts,
    last_error,
    locked_at,
    locked_by,
    next_retry_at,
    delivered_at,
    updated_at
  )
  values (
    format('order.set:%s:%s:%s', v_uid::text, p_date::text, coalesce(v_slot, '')),
    jsonb_build_object(
      'event', 'order.set',
      'action', 'ORDER',
      'order_id', v_order_id,
      'company_id', v_profile.company_id,
      'location_id', v_profile.location_id,
      'user_id', v_uid,
      'date', p_date,
      'slot', v_slot,
      'status', coalesce(v_saved_status, v_db_status),
      'receipt', v_receipt,
      'rid', v_rid
    ),
    'PENDING',
    0,
    null,
    null,
    null,
    null,
    null,
    now()
  )
  on conflict (event_key) do update
    set payload = excluded.payload,
        status = 'PENDING',
        attempts = 0,
        last_error = null,
        locked_at = null,
        locked_by = null,
        next_retry_at = null,
        delivered_at = null,
        updated_at = now();

  insert into public.outbox (
    event_key,
    payload,
    status,
    attempts,
    last_error,
    locked_at,
    locked_by,
    next_retry_at,
    delivered_at,
    updated_at
  )
  values (
    format('rollup.rebuild:%s', p_date::text),
    jsonb_build_object(
      'event', 'rollup.rebuild',
      'date', p_date,
      'company_id', v_profile.company_id,
      'rid', v_rid
    ),
    'PENDING',
    0,
    null,
    null,
    null,
    null,
    null,
    now()
  )
  on conflict (event_key) do update
    set payload = excluded.payload,
        status = 'PENDING',
        attempts = 0,
        last_error = null,
        locked_at = null,
        locked_by = null,
        next_retry_at = null,
        delivered_at = null,
        updated_at = now();

  v_status_out := case
    when upper(coalesce(v_saved_status, v_db_status)) in ('ACTIVE', 'ORDERED') then 'ORDERED'
    else 'CANCELED'
  end;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'status', v_status_out,
    'company_id', v_profile.company_id,
    'location_id', v_profile.location_id,
    'date', p_date,
    'slot', v_slot,
    'receipt', v_receipt,
    'rid', v_rid,
    'action', 'SET'
  );
end;
$$;


--
-- Name: outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_key text NOT NULL,
    payload jsonb,
    status text DEFAULT 'PENDING'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    locked_at timestamp with time zone,
    locked_by text,
    next_retry_at timestamp with time zone,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    lease_id uuid,
    CONSTRAINT outbox_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'PROCESSING'::text, 'SENT'::text, 'FAILED'::text, 'FAILED_PERMANENT'::text])))
);


--
-- Name: lp_outbox_claim(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_outbox_claim(p_limit integer DEFAULT 25, p_worker text DEFAULT NULL::text) RETURNS SETOF public.outbox
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 200));
  v_worker text := coalesce(
    nullif(btrim(coalesce(p_worker, '')), ''),
    format('worker:%s', replace(gen_random_uuid()::text, '-', ''))
  );
begin
  return query
  with candidates as (
    select o.id
    from public.outbox o
    where o.status = 'PENDING'
      and (o.next_retry_at is null or o.next_retry_at <= now())
    order by o.created_at asc
    limit v_limit
    for update skip locked
  ),
  claimed as (
    update public.outbox o
       set status = 'PROCESSING',
           locked_at = now(),
           locked_by = v_worker,
           updated_at = now()
      from candidates c
     where o.id = c.id
     returning o.*
  )
  select *
  from claimed
  order by created_at asc;
end
$$;


--
-- Name: lp_outbox_mark_failed(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_outbox_mark_failed(p_id uuid, p_error text) RETURNS TABLE(id uuid, status text, attempts integer, last_error text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  return query
  with updated as (
    update public.outbox o
       set attempts = coalesce(o.attempts, 0) + 1,
           last_error = left(coalesce(nullif(btrim(coalesce(p_error, '')), ''), 'unknown_error'), 2000),
           status = case
             when coalesce(o.attempts, 0) + 1 >= 10 then 'FAILED_PERMANENT'
             else 'FAILED'
           end,
           locked_at = null,
           locked_by = null,
           next_retry_at = case
             when coalesce(o.attempts, 0) + 1 >= 10 then null
             else now() + make_interval(mins => least(60, greatest(1, cast(power(2::numeric, least(coalesce(o.attempts, 0), 6)) as integer))))
           end,
           updated_at = now()
     where o.id = p_id
       and o.status in ('PROCESSING', 'PENDING', 'FAILED')
     returning o.id, o.status, o.attempts, o.last_error
  )
  select u.id, u.status, u.attempts, u.last_error
  from updated u;

  if not found then
    return query
    select o.id, o.status, o.attempts, o.last_error
    from public.outbox o
    where o.id = p_id;
  end if;
end
$$;


--
-- Name: lp_outbox_mark_sent(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_outbox_mark_sent(p_id uuid, p_message_id text DEFAULT NULL::text) RETURNS SETOF public.outbox
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  return query
  update public.outbox o
     set status = 'SENT',
         delivered_at = now(),
         last_error = null,
         locked_at = null,
         locked_by = null,
         next_retry_at = null,
         updated_at = now()
   where o.id = p_id
     and o.status in ('PROCESSING', 'PENDING', 'FAILED')
  returning o.*;

  if not found then
    return query
    select *
    from public.outbox o
    where o.id = p_id;
  end if;
end
$$;


--
-- Name: lp_outbox_reset_stale(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_outbox_reset_stale(p_stale_minutes integer DEFAULT 10) RETURNS TABLE(reset_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_minutes integer := greatest(1, least(coalesce(p_stale_minutes, 10), 120));
begin
  update public.outbox
     set status = 'PENDING',
         locked_at = null,
         locked_by = null,
         updated_at = now()
   where status = 'PROCESSING'
     and locked_at is not null
     and locked_at < now() - make_interval(mins => v_minutes);

  get diagnostics reset_count = row_count;
  return query select reset_count;
end
$$;


--
-- Name: lp_production_freeze_day(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_production_freeze_day(p_date date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  role public.user_role;
  d date;
  v_export_id text;

  idem_scope text := 'rpc:production_freeze_day';
  idem_key text;
  req_hash text;
  idem jsonb;
  resp jsonb;
begin
  role := public.current_profile_role();
  if role <> 'superadmin' then raise exception 'forbidden' using errcode='42501'; end if;

  d := coalesce(p_date, public.oslo_today());

  idem_key := d::text;
  req_hash := public.lp_req_hash(jsonb_build_object('date',d));
  idem := public.lp_idem_begin(idem_scope, idem_key, req_hash, 86400);
  if (idem->>'hit')::boolean then
    return (idem->'response')::jsonb;
  end if;

  begin
    perform public.lp_advisory_lock('production:' || d::text);

    v_export_id := encode(gen_random_bytes(8), 'hex');

    insert into public.production_days(date, status, frozen_at, frozen_by, stable_hash)
    values (d, 'FROZEN', now(), auth.uid(), null)
    on conflict (date)
    do update set status='FROZEN', frozen_at=now(), frozen_by=auth.uid(), updated_at=now();

    delete from public.production_manifests where date=d;

    insert into public.production_manifests(date, company_id, location_id, tier, slot_start, slot_end, active_orders, totals, export_id)
    select
      o.date,
      o.company_id,
      o.location_id,
      a.tier,
      a.slot_start,
      a.slot_end,
      count(*) filter (where o.status='ACTIVE') as active_orders,
      jsonb_build_object(
        'basis', count(*) filter (where o.status='ACTIVE' and a.tier='BASIS'),
        'luxus', count(*) filter (where o.status='ACTIVE' and a.tier='LUXUS'),
        'total', count(*) filter (where o.status='ACTIVE')
      ) as totals,
      v_export_id
    from public.orders o
    join public.agreements a
      on a.company_id=o.company_id
     and a.location_id=o.location_id
     and a.status='ACTIVE'
     and (a.starts_at is null or a.starts_at <= o.date)
     and (a.ends_at   is null or a.ends_at   >= o.date)
    where o.date = d
    group by o.date, o.company_id, o.location_id, a.tier, a.slot_start, a.slot_end;

    resp := jsonb_build_object('ok', true, 'date', d, 'exportId', v_export_id);
    perform public.lp_idem_complete(idem_scope, idem_key, req_hash, resp, 200);
    return resp;

  exception when others then
    perform public.lp_idem_fail(idem_scope, idem_key, req_hash, sqlerrm);
    raise;
  end;
end;
$$;


--
-- Name: lp_req_hash(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_req_hash(p_payload jsonb) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select encode(digest(coalesce(p_payload::text,'{}'), 'sha256'), 'hex');
$$;


--
-- Name: lp_touch_invites_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_touch_invites_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end
$$;


--
-- Name: normalize_delivery_weekday(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_delivery_weekday(input_value text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case lower(trim(input_value))
    when 'mon' then 'mon'
    when 'monday' then 'mon'
    when 'tue' then 'tue'
    when 'tues' then 'tue'
    when 'tuesday' then 'tue'
    when 'wed' then 'wed'
    when 'wednesday' then 'wed'
    when 'thu' then 'thu'
    when 'thur' then 'thu'
    when 'thurday' then 'thu'
    when 'thursday' then 'thu'
    when 'fri' then 'fri'
    when 'friday' then 'fri'
    when 'sat' then 'sat'
    when 'saturday' then 'sat'
    when 'sun' then 'sun'
    when 'sunday' then 'sun'
    else null
  end;
$$;


--
-- Name: oslo_now_ts(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.oslo_now_ts() RETURNS timestamp with time zone
    LANGUAGE sql STABLE
    AS $$ select (now() at time zone 'Europe/Oslo')::timestamptz $$;


--
-- Name: oslo_time(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.oslo_time() RETURNS time without time zone
    LANGUAGE sql STABLE
    AS $$ select (now() at time zone 'Europe/Oslo')::time $$;


--
-- Name: oslo_today(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.oslo_today() RETURNS date
    LANGUAGE sql STABLE
    AS $$ select (now() at time zone 'Europe/Oslo')::date $$;


--
-- Name: outbox_claim_next(integer, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.outbox_claim_next(p_limit integer DEFAULT 10, p_worker text DEFAULT 'worker'::text, p_lock_seconds integer DEFAULT 120) RETURNS SETOF public.outbox
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_now timestamptz := now();
  v_cutoff timestamptz := v_now - make_interval(secs => greatest(p_lock_seconds, 30));
begin
  p_limit := least(greatest(p_limit, 1), 200);
  p_worker := btrim(coalesce(p_worker,'worker'));

  return query
  with candidates as (
    select o.id
    from public.outbox o
    where o.status in ('PENDING','FAILED')
      and (o.next_retry_at is null or o.next_retry_at <= v_now)
      and (o.locked_at is null or o.locked_at < v_cutoff)
    order by o.created_at asc
    for update skip locked
    limit p_limit
  ),
  upd as (
    update public.outbox o
       set status = 'PROCESSING',
           locked_at = v_now,
           locked_by = p_worker,
           attempts = o.attempts + 1,
           updated_at = v_now
      where o.id in (select id from candidates)
    returning o.*
  )
  select * from upd;
end;
$$;


--
-- Name: outbox_claim_next(integer, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.outbox_claim_next(p_limit integer DEFAULT 10, p_worker text DEFAULT 'worker'::text, p_lock_seconds integer DEFAULT 120, p_requeue_stale_seconds integer DEFAULT 180) RETURNS SETOF public.outbox
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_now timestamptz := now();
  v_cutoff timestamptz := v_now - make_interval(secs => greatest(p_lock_seconds, 30));
begin
  p_limit := least(greatest(p_limit, 1), 200);
  p_worker := btrim(coalesce(p_worker,'worker'));

  -- crash recovery (safe): move stale PROCESSING → FAILED, immediate retry
  perform public.outbox_requeue_stale(p_requeue_stale_seconds);

  return query
  with candidates as (
    select o.id
    from public.outbox o
    where o.status in ('PENDING','FAILED')
      and (o.next_retry_at is null or o.next_retry_at <= v_now)
      and (o.locked_at is null or o.locked_at < v_cutoff)
    order by o.created_at asc
    for update skip locked
    limit p_limit
  ),
  upd as (
    update public.outbox o
       set status = 'PROCESSING',
           locked_at = v_now,
           locked_by = p_worker,
           lease_id = gen_random_uuid(),
           attempts = o.attempts + 1,
           updated_at = v_now
      where o.id in (select id from candidates)
    returning o.*
  )
  select * from upd;
end;
$$;


--
-- Name: outbox_mark_failed(uuid, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.outbox_mark_failed(p_id uuid, p_error text, p_backoff_seconds integer DEFAULT 60, p_max_attempts integer DEFAULT 8) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_now timestamptz := now();
  v_attempts int;
begin
  update public.outbox
     set status = 'FAILED',
         last_error = left(coalesce(p_error,''), 4000),
         next_retry_at = v_now + make_interval(secs => greatest(p_backoff_seconds, 5)),
         locked_at = null,
         locked_by = null,
         updated_at = v_now
   where id = p_id
   returning attempts into v_attempts;

  if v_attempts is not null and v_attempts >= p_max_attempts then
    update public.outbox
       set status = 'FAILED_PERMANENT',
           next_retry_at = null,
           updated_at = v_now
     where id = p_id;
  end if;
end;
$$;


--
-- Name: outbox_mark_failed(uuid, uuid, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.outbox_mark_failed(p_id uuid, p_lease_id uuid, p_error text, p_backoff_seconds integer DEFAULT 60, p_max_attempts integer DEFAULT 8) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_now timestamptz := now();
  v_attempts int;
begin
  update public.outbox
     set status = 'FAILED',
         last_error = left(coalesce(p_error,''), 4000),
         next_retry_at = v_now + make_interval(secs => greatest(p_backoff_seconds, 5)),
         locked_at = null,
         locked_by = null,
         lease_id = null,
         updated_at = v_now
   where id = p_id
     and status = 'PROCESSING'
     and lease_id = p_lease_id
   returning attempts into v_attempts;

  if not found then
    raise exception 'outbox fail failed: not owner or not processing' using errcode='23514';
  end if;

  if v_attempts is not null and v_attempts >= p_max_attempts then
    update public.outbox
       set status = 'FAILED_PERMANENT',
           next_retry_at = null,
           updated_at = v_now
     where id = p_id;
  end if;
end;
$$;


--
-- Name: outbox_mark_permanent_failed(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.outbox_mark_permanent_failed(p_max_attempts integer DEFAULT 8) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare n int;
begin
  update public.outbox
     set status='FAILED_PERMANENT',
         updated_at=now()
   where status='FAILED'
     and attempts >= p_max_attempts;

  get diagnostics n = row_count;
  return n;
end;
$$;


--
-- Name: outbox_mark_sent(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.outbox_mark_sent(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.outbox
     set status = 'SENT',
         delivered_at = now(),
         locked_at = null,
         locked_by = null,
         updated_at = now()
   where id = p_id;
end;
$$;


--
-- Name: outbox_mark_sent(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.outbox_mark_sent(p_id uuid, p_lease_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.outbox
     set status = 'SENT',
         delivered_at = now(),
         locked_at = null,
         locked_by = null,
         lease_id = null,
         updated_at = now()
   where id = p_id
     and status = 'PROCESSING'
     and lease_id = p_lease_id;

  if not found then
    raise exception 'outbox ack failed: not owner or not processing' using errcode='23514';
  end if;
end;
$$;


--
-- Name: outbox_requeue_stale(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.outbox_requeue_stale(p_stale_seconds integer DEFAULT 180) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_now timestamptz := now();
  n int;
begin
  update public.outbox
     set status = 'FAILED',
         last_error = coalesce(last_error,'') || case when coalesce(last_error,'')='' then '' else ' | ' end || 'requeued: stale processing',
         next_retry_at = v_now,   -- immediate retry
         locked_at = null,
         locked_by = null,
         lease_id = null,
         updated_at = v_now
   where status = 'PROCESSING'
     and locked_at is not null
     and locked_at < (v_now - make_interval(secs => greatest(p_stale_seconds, 30)));

  get diagnostics n = row_count;
  return n;
end;
$$;


--
-- Name: project_profile_scope_from_memberships(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.project_profile_scope_from_memberships(p_user_id uuid) RETURNS TABLE(projected_company_id uuid, projected_location_id uuid)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with company_scope as (
    select
      count(*) filter (
        where cm.active = true
          and cm.status in ('active', 'suspended')
      ) as scope_company_memberships,
      (array_agg(cm.company_id order by cm.company_id::text) filter (
        where cm.active = true
          and cm.status in ('active', 'suspended')
      ))[1] as single_company_id
    from public.company_memberships cm
    where cm.user_id = p_user_id
  ),
  location_scope as (
    select
      count(*) filter (where lm.active = true) as active_location_memberships,
      (array_agg(lm.location_id order by lm.location_id::text) filter (where lm.active = true))[1] as single_location_id,
      (array_agg(lm.company_id order by lm.company_id::text) filter (where lm.active = true))[1] as single_location_company_id
    from public.location_memberships lm
    where lm.user_id = p_user_id
  )
  select
    case
      when coalesce(cs.scope_company_memberships, 0) = 1 then cs.single_company_id
      when coalesce(cs.scope_company_memberships, 0) = 0 and coalesce(ls.active_location_memberships, 0) = 1 then ls.single_location_company_id
      else null
    end as projected_company_id,
    case
      when coalesce(ls.active_location_memberships, 0) = 1 then ls.single_location_id
      else null
    end as projected_location_id
  from company_scope cs
  cross join location_scope ls;
$$;


--
-- Name: recalculate_invoice_run_totals(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_invoice_run_totals(_invoice_run_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_subtotal integer := 0;
  v_vat integer := 0;
  v_total integer := 0;
  v_adjustments integer := 0;
begin
  select
    coalesce(sum(il.line_subtotal_cents_ex_vat), 0),
    coalesce(sum(il.line_vat_cents), 0),
    coalesce(sum(il.line_total_cents_inc_vat), 0),
    coalesce(sum(case when il.line_type in ('credit', 'debit', 'fee', 'manual') then il.line_total_cents_inc_vat else 0 end), 0)
  into v_subtotal, v_vat, v_total, v_adjustments
  from public.invoice_lines il
  where il.invoice_run_id = _invoice_run_id;

  update public.invoice_runs ir
  set subtotal_cents_ex_vat = v_subtotal,
      vat_cents = v_vat,
      total_cents_inc_vat = v_total,
      adjustments_cents_inc_vat = v_adjustments
  where ir.id = _invoice_run_id;
end;
$$;


--
-- Name: recalculate_invoice_totals_nok(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_invoice_totals_nok(p_invoice_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_subtotal integer;
begin
  select coalesce(sum(il.amount_nok), 0)
  into v_subtotal
  from public.invoice_lines il
  where il.invoice_id = p_invoice_id;

  update public.invoices i
  set subtotal_nok = v_subtotal,
      total_nok = v_subtotal + coalesce(i.vat_nok, 0),
      updated_at = now()
  where i.id = p_invoice_id;
end;
$$;


--
-- Name: recalculate_order_totals(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_order_totals(_order_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_company_id uuid;
  v_location_id uuid;
  v_service_date date;
  v_subtotal integer := 0;
  v_vat integer := 0;
  v_gross integer := 0;
  v_billing_mode public.billing_mode := 'company_pays_full';
  v_subsidy_default integer := 0;
  v_subsidy integer := 0;
  v_company_billable integer := 0;
  v_employee_payable integer := 0;
begin
  select o.company_id, o.location_id, o.service_date
  into v_company_id, v_location_id, v_service_date
  from public.orders o
  where o.id = _order_id;

  if v_company_id is null then
    raise exception 'Unknown order: %', _order_id;
  end if;

  select
    coalesce(sum(oi.line_subtotal_cents_ex_vat), 0),
    coalesce(sum(oi.line_vat_cents), 0),
    coalesce(sum(oi.line_total_cents_inc_vat), 0)
  into v_subtotal, v_vat, v_gross
  from public.order_items oi
  where oi.order_id = _order_id;

  select
    coalesce(lp.employee_subsidy_cents_inc_vat, cc.default_employee_subsidy_cents_inc_vat, 0),
    coalesce(cc.billing_mode, 'company_pays_full'::public.billing_mode)
  into v_subsidy_default, v_billing_mode
  from public.company_locations l
  left join public.location_policies lp
    on lp.location_id = l.id
  left join lateral (
    select c.default_employee_subsidy_cents_inc_vat, c.billing_mode
    from public.company_contracts c
    where c.company_id = l.company_id
      and c.is_active = true
      and c.valid_from <= v_service_date
      and (c.valid_to is null or c.valid_to >= v_service_date)
    order by c.valid_from desc
    limit 1
  ) cc on true
  where l.id = v_location_id;

  if v_billing_mode = 'company_pays_full' then
    v_subsidy := v_gross;
    v_company_billable := v_gross;
    v_employee_payable := 0;
  elsif v_billing_mode = 'employee_pays_full' then
    v_subsidy := 0;
    v_company_billable := 0;
    v_employee_payable := v_gross;
  else
    v_subsidy := least(v_subsidy_default, v_gross);
    v_company_billable := v_subsidy;
    v_employee_payable := greatest(v_gross - v_subsidy, 0);
  end if;

  update public.orders
  set subtotal_cents_ex_vat = v_subtotal,
      vat_cents = v_vat,
      gross_cents_inc_vat = v_gross,
      subsidy_cents_inc_vat = v_subsidy,
      company_billable_cents_inc_vat = v_company_billable,
      employee_payable_cents_inc_vat = v_employee_payable
  where id = _order_id;
end;
$$;


--
-- Name: recompute_profile_legacy_scope(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recompute_profile_legacy_scope(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_company_id uuid;
  v_location_id uuid;
begin
  select projected_company_id, projected_location_id
  into v_company_id, v_location_id
  from public.project_profile_scope_from_memberships(p_user_id);

  perform set_config('app.skip_profile_scope_write_audit', 'on', true);

  update public.profiles p
  set company_id = v_company_id,
      location_id = v_location_id,
      updated_at = now()
  where p.id = p_user_id
    and (
      p.company_id is distinct from v_company_id
      or p.location_id is distinct from v_location_id
    );
end;
$$;


--
-- Name: refresh_delivery_run_items(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_delivery_run_items(_delivery_run_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_location_id uuid;
  v_service_date date;
begin
  select dr.location_id, dr.service_date
  into v_location_id, v_service_date
  from public.delivery_runs dr
  where dr.id = _delivery_run_id;

  if v_location_id is null then
    raise exception 'Unknown delivery run: %', _delivery_run_id;
  end if;

  delete from public.delivery_run_items dri
  where dri.delivery_run_id = _delivery_run_id;

  insert into public.delivery_run_items (
    delivery_run_id,
    product_id,
    product_name_snapshot,
    total_quantity,
    order_count
  )
  select
    _delivery_run_id,
    oi.product_id,
    oi.product_name_snapshot,
    sum(oi.quantity) as total_quantity,
    count(distinct oi.order_id) as order_count
  from public.orders o
  join public.order_items oi
    on oi.order_id = o.id
  where o.location_id = v_location_id
    and o.service_date = v_service_date
    and o.status in ('locked', 'prepared', 'dispatched', 'delivered')
  group by oi.product_id, oi.product_name_snapshot;
end;
$$;


--
-- Name: safe_trim(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.safe_trim(v text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$ select btrim(coalesce(v,'')) $$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: sync_agreement_delivery_days_from_legacy_jsonb(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_agreement_delivery_days_from_legacy_jsonb() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  delete from public.agreement_delivery_days
  where agreement_id = new.id;

  insert into public.agreement_delivery_days (agreement_id, weekday)
  select new.id, d.weekday
  from public.extract_agreement_delivery_days(new.delivery_days) d
  on conflict do nothing;

  return new;
end;
$$;


--
-- Name: sync_memberships_from_legacy_profile(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_memberships_from_legacy_profile() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_company_role public.membership_role;
  v_location_role public.membership_role;
  v_profile_active boolean;
  v_membership_status public.membership_status;
  v_activated_at timestamptz;
begin
  v_company_role := case
    when lower(coalesce(new.role::text, '')) = 'company_admin' then 'company_admin'::public.membership_role
    else 'employee'::public.membership_role
  end;
  v_location_role := case
    when lower(coalesce(new.role::text, '')) = 'location_admin' then 'location_admin'::public.membership_role
    else 'employee'::public.membership_role
  end;
  v_profile_active := coalesce(new.active, true)
                      and coalesce(new.is_active, true)
                      and new.archived_at is null
                      and new.disabled_at is null;
  v_membership_status := case
    when v_profile_active then 'active'::public.membership_status
    else 'suspended'::public.membership_status
  end;
  v_activated_at := case
    when v_profile_active then now()
    else null
  end;

  -- Rydd opp company memberships for endret scope (kun ved firma-bytte eller null)
  delete from public.company_memberships cm
  where cm.user_id = new.id
    and cm.source = 'legacy_profile_sync'
    and (
      new.company_id is null
      or cm.company_id <> new.company_id
    );

  if new.company_id is not null then
    insert into public.company_memberships (
      user_id,
      company_id,
      role,
      active,
      status,
      activated_at,
      source,
      created_at,
      updated_at
    )
    values (
      new.id,
      new.company_id,
      v_company_role,
      true,  -- ALLTID true; lifecycle håndteres via status
      v_membership_status,
      v_activated_at,
      'legacy_profile_sync',
      coalesce(new.created_at, now()),
      now()
    )
    on conflict (user_id, company_id) do update
    set role = case
                 when public.company_memberships.source <> 'legacy_profile_sync' then public.company_memberships.role
                 when excluded.role = 'company_admin'::public.membership_role then excluded.role
                 else public.company_memberships.role
               end,
        active = case
                   when public.company_memberships.source <> 'legacy_profile_sync' then public.company_memberships.active
                   else true  -- ALLTID true for legacy_profile_sync
                 end,
        status = case
                   when public.company_memberships.source <> 'legacy_profile_sync' then public.company_memberships.status
                   when excluded.status = 'active'::public.membership_status then 'active'::public.membership_status
                   when public.company_memberships.status = 'active'::public.membership_status then 'suspended'::public.membership_status
                   else public.company_memberships.status
                 end,
        activated_at = case
                         when public.company_memberships.source <> 'legacy_profile_sync' then public.company_memberships.activated_at
                         when excluded.status = 'active'::public.membership_status then coalesce(public.company_memberships.activated_at, now())
                         else public.company_memberships.activated_at
                       end,
        source = case
                   when public.company_memberships.source = 'manual' then public.company_memberships.source
                   else excluded.source
                 end,
        updated_at = case
                       when public.company_memberships.source <> 'legacy_profile_sync' then public.company_memberships.updated_at
                       else now()
                     end;
  end if;

  -- location_memberships: UENDRET fra original (bruker active-modell)
  delete from public.location_memberships lm
  where lm.user_id = new.id
    and lm.source = 'legacy_profile_sync'
    and (
      new.company_id is null
      or new.location_id is null
      or lm.company_id <> new.company_id
      or lm.location_id <> new.location_id
    );

  if new.company_id is not null and new.location_id is not null then
    insert into public.location_memberships (
      user_id, company_id, location_id, role, active, source, created_at, updated_at
    )
    values (
      new.id, new.company_id, new.location_id, v_location_role, v_profile_active,
      'legacy_profile_sync', coalesce(new.created_at, now()), now()
    )
    on conflict (user_id, location_id) do update
    set company_id = excluded.company_id,
        role = case
                 when excluded.role = 'location_admin'::public.membership_role then excluded.role
                 else public.location_memberships.role
               end,
        active = excluded.active,
        source = case
                   when public.location_memberships.source = 'manual' then public.location_memberships.source
                   else excluded.source
                 end,
        updated_at = now();
  end if;

  return new;
end;
$$;


--
-- Name: tg_audit_row(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_audit_row() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_actor uuid;
  v_record_id text;
  j_old jsonb;
  j_new jsonb;
begin
  v_actor := auth.uid();
  v_record_id := coalesce(to_jsonb(new) ->> 'id',
                          to_jsonb(old) ->> 'id');

  j_old := case when tg_op in ('UPDATE', 'DELETE')
                then to_jsonb(old) else null end;
  j_new := case when tg_op in ('INSERT', 'UPDATE')
                then to_jsonb(new) else null end;

  -- B2b-1: skip UPDATE if only updated_at changed
  if tg_op = 'UPDATE' then
    if (j_new - 'updated_at') = (j_old - 'updated_at') then
      return new;
    end if;
  end if;

  -- B2b-2 Art. 9 + B2b-3 per-table PII / free-text stripping
  if tg_table_name = 'order_items' then
    -- B2b-2: allergens / dietary snapshots (GDPR Art. 9).
    -- B2b-3: free-text notes.
    if j_old is not null then
      j_old := j_old - 'allergens_snapshot' - 'dietary_tags_snapshot' - 'notes';
    end if;
    if j_new is not null then
      j_new := j_new - 'allergens_snapshot' - 'dietary_tags_snapshot' - 'notes';
    end if;
  elsif tg_table_name = 'orders' then
    if j_old is not null then
      j_old := j_old - 'customer_note' - 'internal_note' - 'note' - 'cancel_reason'
                     - 'integrity_reason' - 'integrity_rid';
    end if;
    if j_new is not null then
      j_new := j_new - 'customer_note' - 'internal_note' - 'note' - 'cancel_reason'
                     - 'integrity_reason' - 'integrity_rid';
    end if;
  elsif tg_table_name = 'delivery_runs' then
    if j_old is not null then
      j_old := j_old - 'courier_note' - 'kitchen_note' - 'received_by';
    end if;
    if j_new is not null then
      j_new := j_new - 'courier_note' - 'kitchen_note' - 'received_by';
    end if;
  elsif tg_table_name = 'companies' then
    -- Keep name + timezone per owner decision.
    if j_old is not null then
      j_old := j_old - 'contact_name' - 'contact_email' - 'contact_phone' - 'address'
                     - 'billing_email' - 'delete_reason' - 'orgnr' - 'organization_number';
    end if;
    if j_new is not null then
      j_new := j_new - 'contact_name' - 'contact_email' - 'contact_phone' - 'address'
                     - 'billing_email' - 'delete_reason' - 'orgnr' - 'organization_number';
    end if;
  elsif tg_table_name = 'company_contracts' then
    if j_old is not null then
      j_old := j_old - 'notes';
    end if;
    if j_new is not null then
      j_new := j_new - 'notes';
    end if;
  elsif tg_table_name = 'company_memberships' then
    if j_old is not null then
      j_old := j_old - 'employee_number';
    end if;
    if j_new is not null then
      j_new := j_new - 'employee_number';
    end if;
  elsif tg_table_name = 'billing_adjustments' then
    if j_old is not null then
      j_old := j_old - 'description';
    end if;
    if j_new is not null then
      j_new := j_new - 'description';
    end if;
  elsif tg_table_name = 'invoice_lines' then
    if j_old is not null then
      j_old := j_old - 'description' - 'basis';
    end if;
    if j_new is not null then
      j_new := j_new - 'description' - 'basis';
    end if;
  elsif tg_table_name = 'products' then
    if j_old is not null then
      j_old := j_old - 'description';
    end if;
    if j_new is not null then
      j_new := j_new - 'description';
    end if;
  end if;

  insert into public.audit_log (
    actor_user_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data
  )
  values (
    v_actor,
    tg_table_schema || '.' || tg_table_name,
    v_record_id,
    tg_op,
    j_old,
    j_new
  );

  return coalesce(new, old);
end;
$$;


--
-- Name: tg_create_profile_from_auth_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_create_profile_from_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


--
-- Name: tg_guard_order_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_guard_order_mutation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
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


--
-- Name: tg_invoice_lines_hydrate_v2(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_invoice_lines_hydrate_v2() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_order record;
  v_invoice record;
begin
  if new.invoice_id is null then
    new.invoice_id := public.ensure_invoice_head(new.run_id, new.company_id);
  end if;

  if new.invoice_id is null then
    raise exception 'invoice_lines requires invoice_id, or run_id + company_id so an invoice head can be resolved';
  end if;

  select i.id, i.run_id, i.company_id
  into v_invoice
  from public.invoices i
  where i.id = new.invoice_id;

  if not found then
    raise exception 'invoice_lines.invoice_id % does not exist', new.invoice_id;
  end if;

  new.run_id := v_invoice.run_id;
  new.company_id := v_invoice.company_id;

  if new.order_id is not null then
    select
      o.id,
      o.company_id,
      o.location_id,
      o.date,
      o.status,
      o.tier,
      o.unit_price_nok
    into v_order
    from public.orders o
    where o.id = new.order_id;

    if not found then
      raise exception 'invoice_lines.order_id % does not exist', new.order_id;
    end if;

    if upper(v_order.status::text) <> 'ACTIVE' then
      raise exception 'Only ACTIVE orders can be invoiced';
    end if;

    if v_order.company_id <> new.company_id then
      raise exception 'invoice_lines.company_id must match orders.company_id';
    end if;

    new.location_id := v_order.location_id;
    new.service_on := coalesce(new.service_on, v_order.date);
    new.tier := coalesce(new.tier, v_order.tier);
    new.unit_price_nok := coalesce(new.unit_price_nok, v_order.unit_price_nok);
    new.quantity := coalesce(new.quantity, 1);

    if new.description is null or btrim(new.description) = '' then
      new.description := 'Meal order';
    end if;
  else
    new.quantity := coalesce(new.quantity, 1);
    if new.description is null or btrim(new.description) = '' then
      new.description := 'Invoice line';
    end if;
  end if;

  if new.location_id is null then
    raise exception 'invoice_lines.location_id is required';
  end if;

  if new.service_on is null then
    raise exception 'invoice_lines.service_on is required';
  end if;

  if new.tier is null then
    raise exception 'invoice_lines.tier is required';
  end if;

  if new.unit_price_nok is null or new.unit_price_nok < 0 then
    raise exception 'invoice_lines.unit_price_nok must be >= 0';
  end if;

  if new.quantity is null or new.quantity <= 0 then
    raise exception 'invoice_lines.quantity must be > 0';
  end if;

  new.amount_nok := new.quantity * new.unit_price_nok;

  return new;
end;
$$;


--
-- Name: tg_invoice_lines_recalculate_invoice_v2(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_invoice_lines_recalculate_invoice_v2() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'DELETE' then
    if old.invoice_id is not null then
      perform public.recalculate_invoice_totals_nok(old.invoice_id);
    end if;
    return old;
  end if;

  if new.invoice_id is not null then
    perform public.recalculate_invoice_totals_nok(new.invoice_id);
  end if;

  if tg_op = 'UPDATE'
     and old.invoice_id is not null
     and new.invoice_id is distinct from old.invoice_id then
    perform public.recalculate_invoice_totals_nok(old.invoice_id);
  end if;

  return new;
end;
$$;


--
-- Name: tg_menu_service_day_defaults(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_menu_service_day_defaults() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_company_id uuid;
begin
  select l.company_id
  into v_company_id
  from public.company_locations l
  where l.id = new.location_id;

  if v_company_id is null then
    raise exception 'Unknown location: %', new.location_id;
  end if;

  new.company_id := v_company_id;
  new.cutoff_at := public.compute_cutoff_at(new.location_id, new.service_date);

  if exists (
    select 1
    from public.location_closed_dates lcd
    where lcd.location_id = new.location_id
      and lcd.closed_date = new.service_date
  ) then
    raise exception 'Location is closed on service date %', new.service_date;
  end if;

  if new.state = 'published' and new.published_at is null then
    new.published_at := now();
  end if;

  if new.state = 'locked' and new.locked_at is null then
    new.locked_at := now();
  end if;

  return new;
end;
$$;


--
-- Name: tg_menu_service_day_item_snapshot(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_menu_service_day_item_snapshot() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_company_id uuid;
  v_service_date date;
  v_name text;
  v_unit text;
  v_vat numeric(5,2);
  v_price integer;
begin
  perform public.assert_menu_day_mutable(new.menu_service_day_id);

  select msd.company_id, msd.service_date
  into v_company_id, v_service_date
  from public.menu_service_days msd
  where msd.id = new.menu_service_day_id;

  if v_company_id is null then
    raise exception 'Unknown menu day: %', new.menu_service_day_id;
  end if;

  select
    p.name,
    p.unit_name,
    p.vat_rate,
    public.get_effective_product_price_ex_vat(v_company_id, p.id, v_service_date)
  into v_name, v_unit, v_vat, v_price
  from public.products p
  where p.id = new.product_id
    and p.is_active = true
    and p.is_visible = true
    and (p.company_id is null or p.company_id = v_company_id);

  if v_name is null then
    raise exception 'Unknown or inactive product: %', new.product_id;
  end if;

  new.product_name_snapshot := v_name;
  new.unit_name_snapshot := v_unit;
  new.vat_rate_snapshot := v_vat;
  new.offered_price_cents_ex_vat := coalesce(new.offered_price_cents_ex_vat, v_price);

  return new;
end;
$$;


--
-- Name: tg_normalize_invoice_v2(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_normalize_invoice_v2() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.subtotal_nok := coalesce(new.subtotal_nok, 0);
  new.vat_nok := coalesce(new.vat_nok, 0);
  new.total_nok := new.subtotal_nok + new.vat_nok;
  return new;
end;
$$;


--
-- Name: tg_normalize_production_day_v2(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_normalize_production_day_v2() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if upper(new.status::text) in ('FROZEN', 'FINALIZED', 'CLOSED') and new.frozen_at is null then
    new.frozen_at := now();
  end if;

  if upper(new.status::text) = 'OPEN' then
    new.frozen_at := null;
    new.frozen_by := null;
  end if;

  return new;
end;
$$;


--
-- Name: tg_order_defaults(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_order_defaults() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_menu_day_id uuid;
  v_company_id uuid;
  v_state public.menu_state;
  v_cutoff timestamptz;
begin
  if tg_op = 'UPDATE'
     and new.location_id is not distinct from old.location_id
     and new.service_date is not distinct from old.service_date
     and new.menu_service_day_id is not distinct from old.menu_service_day_id
     and new.company_id is not distinct from old.company_id
     and new.cutoff_at is not distinct from old.cutoff_at
  then
    if new.currency_code is null then
      new.currency_code := coalesce(old.currency_code, 'NOK');
    end if;
    return new;
  end if;

  new.service_date := coalesce(new.service_date, new.date);

  if tg_op = 'INSERT'
     and new.service_date < current_date
     and not (
       select private.has_platform_role(array[
         'platform_admin'::public.platform_role,
         'platform_ops'::public.platform_role
       ])
     )
  then
    raise exception 'Orders cannot be created for past service dates';
  end if;

  if new.location_id is null or new.service_date is null then
    raise exception 'Orders require location_id and service_date';
  end if;

  select
    msd.id,
    msd.company_id,
    msd.state,
    msd.cutoff_at
  into v_menu_day_id, v_company_id, v_state, v_cutoff
  from public.menu_service_days msd
  where msd.location_id = new.location_id
    and msd.service_date = new.service_date
  limit 1;

  if v_menu_day_id is null then
    raise exception 'No menu exists for location % on %', new.location_id, new.service_date;
  end if;

  if v_state not in ('published', 'locked')
     and not (select private.can_manage_location(new.location_id))
     and not (
       select private.has_platform_role(array[
         'platform_admin'::public.platform_role,
         'platform_ops'::public.platform_role
       ])
     )
  then
    raise exception 'Menu is not published for this service day';
  end if;

  new.menu_service_day_id := v_menu_day_id;
  new.company_id := v_company_id;
  new.cutoff_at := v_cutoff;

  if new.currency_code is null then
    new.currency_code := 'NOK';
  end if;

  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := auth.uid();
  end if;

  return new;
end;
$$;


--
-- Name: tg_order_identity_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_order_identity_immutable() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if not (select private.has_platform_role(array[
    'platform_admin'::public.platform_role,
    'platform_ops'::public.platform_role
  ])) then
    if new.company_id is distinct from old.company_id
       or new.location_id is distinct from old.location_id
       or new.user_id is distinct from old.user_id
       or new.service_date is distinct from old.service_date
       or new.menu_service_day_id is distinct from old.menu_service_day_id
    then
      raise exception 'Core order identity fields are immutable';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: tg_order_item_snapshot(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_order_item_snapshot() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_company_id uuid;
  v_service_date date;
  v_menu_service_day_id uuid;
  v_menu_item_id uuid;
  v_name text;
  v_unit text;
  v_price integer;
  v_vat numeric(10, 6);
  v_allergens jsonb;
  v_tags jsonb;
begin
  perform public.assert_order_mutable(new.order_id);

  select o.company_id, o.service_date, o.menu_service_day_id
    into v_company_id, v_service_date, v_menu_service_day_id
  from public.orders o
  where o.id = new.order_id;

  if v_company_id is null then
    raise exception 'Unknown order: %', new.order_id;
  end if;

  select
    msdi.id,
    msdi.product_name_snapshot,
    msdi.unit_name_snapshot,
    msdi.offered_price_cents_ex_vat,
    msdi.vat_rate_snapshot
  into v_menu_item_id, v_name, v_unit, v_price, v_vat
  from public.menu_service_day_items msdi
  where msdi.menu_service_day_id = v_menu_service_day_id
    and msdi.product_id = new.product_id
  limit 1;

  if v_menu_item_id is null then
    raise exception 'Product % is not offered on this service day', new.product_id;
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'code', a.code,
          'name', a.name,
          'is_trace', pa.is_trace
        )
        order by a.sort_order, a.name
      ),
      '[]'::jsonb
    )
  into v_allergens
  from public.product_allergens pa
  join public.allergens a
    on a.id = pa.allergen_id
  where pa.product_id = new.product_id;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', dt.id,
          'code', dt.code,
          'name', dt.name
        )
        order by dt.sort_order, dt.name
      ),
      '[]'::jsonb
    )
  into v_tags
  from public.product_dietary_tags pdt
  join public.dietary_tags dt
    on dt.id = pdt.dietary_tag_id
  where pdt.product_id = new.product_id;

  new.menu_service_day_item_id := v_menu_item_id;
  new.product_name_snapshot := v_name;
  new.unit_name_snapshot := v_unit;
  new.unit_price_cents_ex_vat := v_price;
  new.vat_rate_snapshot := coalesce(nullif(v_vat, 0), 0.15);
  new.allergens_snapshot := v_allergens;
  new.dietary_tags_snapshot := v_tags;
  new.line_subtotal_cents_ex_vat := new.quantity * new.unit_price_cents_ex_vat;
  -- Desimalsats (0.15), ikke /100
  new.line_vat_cents := round(new.line_subtotal_cents_ex_vat::numeric * new.vat_rate_snapshot)::integer;
  new.line_total_cents_inc_vat := new.line_subtotal_cents_ex_vat + new.line_vat_cents;

  return new;
end;
$$;


--
-- Name: tg_order_status_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_order_status_history() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
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


--
-- Name: tg_orders_block_closed_dates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_orders_block_closed_dates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare blocked boolean;
begin
  select exists(
    select 1 from public.closed_dates cd
    where cd.date=new.date
      and (
        (cd.scope_location_id is not null and cd.scope_location_id=new.location_id)
        or (cd.scope_company_id is not null and cd.scope_company_id=new.company_id and cd.scope_location_id is null)
        or (cd.scope_company_id is null and cd.scope_location_id is null) -- global closure
      )
  ) into blocked;

  if blocked then
    raise exception 'orders blocked: closed date' using errcode='23514';
  end if;

  return new;
end;
$$;


--
-- Name: tg_orders_block_if_frozen(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_orders_block_if_frozen() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare st public.production_status;
declare role public.user_role;
begin
  role := (select coalesce((select p.role from public.profiles p where p.id=auth.uid()), 'employee'::public.user_role));
  if role='superadmin' then return new; end if;

  select pd.status into st from public.production_days pd where pd.date=new.date;
  if st in ('FROZEN','CLOSED') then
    raise exception 'orders locked: production frozen/closed' using errcode='23514';
  end if;
  return new;
end;
$$;


--
-- Name: tg_orders_cutoff_0800(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_orders_cutoff_0800() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  role public.user_role;
  today date;
  now_t time;
begin
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


--
-- Name: tg_orders_enforce_integrity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_orders_enforce_integrity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  loc_company uuid;
  p_company uuid;
  p_location uuid;
  p_role public.user_role;
  p_active boolean;
begin
  select cl.company_id into loc_company from public.company_locations cl where cl.id=new.location_id;
  if loc_company is null then raise exception 'location missing' using errcode='23503'; end if;
  if loc_company <> new.company_id then raise exception 'orders company/location mismatch' using errcode='23514'; end if;

  if auth.uid() is not null then
    select company_id, location_id, role, active
      into p_company, p_location, p_role, p_active
    from public.profiles
    where id=auth.uid();

    if p_role is null then raise exception 'profile missing' using errcode='23514'; end if;
    if p_active is distinct from true then raise exception 'profile inactive' using errcode='23514'; end if;

    if p_role='employee' then
      if new.user_id <> auth.uid() then raise exception 'employee cannot write for others' using errcode='42501'; end if;
      if p_company is null or p_location is null then raise exception 'employee missing company/location' using errcode='23514'; end if;
      if new.company_id<>p_company or new.location_id<>p_location then
        raise exception 'employee order must match profile company/location' using errcode='23514';
      end if;
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: tg_orders_hydrate_core_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_orders_hydrate_core_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_agreement public.agreements%rowtype;
begin
  if new.company_id is null or new.location_id is null or new.date is null then
    return new;
  end if;

  if new.agreement_id is null then
    select a.*
    into v_agreement
    from public.agreements a
    where a.company_id = new.company_id
      and a.location_id = new.location_id
      and upper(a.status::text) = 'ACTIVE'
      and coalesce(a.starts_at, a.start_date) <= new.date
      and (a.ends_at is null or a.ends_at >= new.date)
    order by coalesce(a.starts_at, a.start_date) desc nulls last, a.created_at desc, a.id desc
    limit 1;

    if found then
      new.agreement_id := v_agreement.id;
    end if;
  else
    select a.*
    into v_agreement
    from public.agreements a
    where a.id = new.agreement_id;

    if not found then
      raise exception 'orders.agreement_id % does not exist', new.agreement_id;
    end if;
  end if;

  if v_agreement.id is null then
    raise exception 'No ACTIVE agreement could be resolved for orders(company_id %, location_id %, date %)', new.company_id, new.location_id, new.date;
  end if;

  if v_agreement.company_id <> new.company_id then
    raise exception 'orders.company_id must match agreements.company_id';
  end if;

  if v_agreement.location_id <> new.location_id then
    raise exception 'orders.location_id must match agreements.location_id';
  end if;

  if upper(v_agreement.status::text) <> 'ACTIVE' then
    raise exception 'orders must point to an ACTIVE agreement';
  end if;

  if new.date < coalesce(v_agreement.starts_at, v_agreement.start_date)
     or (v_agreement.ends_at is not null and new.date > v_agreement.ends_at) then
    raise exception 'orders.date is outside agreement period';
  end if;

  if new.tier is null then
    new.tier := v_agreement.tier;
  end if;

  if new.unit_price_nok is null then
    if upper(new.tier::text) = 'LUXUS' and v_agreement.price_per_meal_luxus_nok is not null then
      new.unit_price_nok := v_agreement.price_per_meal_luxus_nok;
    elsif upper(new.tier::text) = 'ENTERPRISE' and v_agreement.price_per_meal_enterprise_nok is not null then
      new.unit_price_nok := v_agreement.price_per_meal_enterprise_nok;
    else
      new.unit_price_nok := v_agreement.price_per_meal_nok;
    end if;
  end if;

  if new.unit_price_nok is null or new.unit_price_nok < 0 then
    raise exception 'orders.unit_price_nok must be >= 0';
  end if;

  if upper(new.status::text) = 'CANCELLED' and new.cancelled_at is null then
    new.cancelled_at := now();
  elsif upper(new.status::text) <> 'CANCELLED' then
    new.cancelled_at := null;
  end if;

  return new;
end;
$$;


--
-- Name: tg_orders_require_active_agreement(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_orders_require_active_agreement() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare ok boolean;
begin
  select exists(
    select 1
    from public.agreements a
    where a.company_id=new.company_id
      and a.location_id=new.location_id
      and a.status='ACTIVE'
      and (a.starts_at is null or a.starts_at <= new.date)
      and (a.ends_at   is null or a.ends_at   >= new.date)
  ) into ok;

  if ok is distinct from true then
    raise exception 'no ACTIVE agreement for company/location/date' using errcode='23514';
  end if;

  return new;
end;
$$;


--
-- Name: tg_orders_require_active_company(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_orders_require_active_company() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare st public.company_status;
begin
  select c.status into st from public.companies c where c.id=new.company_id;
  if st is null then raise exception 'company missing' using errcode='23503'; end if;
  if st <> 'ACTIVE' then raise exception 'company not ACTIVE' using errcode='23514'; end if;
  return new;
end;
$$;


--
-- Name: tg_profiles_enforce_company_location(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_profiles_enforce_company_location() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare loc_company uuid;
begin
  if new.company_id is null or new.location_id is null then
    return new;
  end if;

  select cl.company_id into loc_company
  from public.company_locations cl
  where cl.id = new.location_id;

  if loc_company is null then
    raise exception 'profiles.location_id does not exist' using errcode='23503';
  end if;

  if loc_company <> new.company_id then
    raise exception 'profiles company/location mismatch' using errcode='23514';
  end if;

  return new;
end;
$$;


--
-- Name: tg_recalculate_order_totals_from_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_recalculate_order_totals_from_items() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform public.recalculate_order_totals(coalesce(new.order_id, old.order_id));
  return coalesce(new, old);
end;
$$;


--
-- Name: tg_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: tg_tripletex_invoices_hydrate_v2(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_tripletex_invoices_hydrate_v2() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_invoice record;
begin
  if new.invoice_id is null then
    new.invoice_id := public.ensure_invoice_head(new.run_id, new.company_id);
  end if;

  if new.invoice_id is null then
    raise exception 'tripletex_invoices requires invoice_id, or run_id + company_id';
  end if;

  select i.id, i.run_id, i.company_id
  into v_invoice
  from public.invoices i
  where i.id = new.invoice_id;

  if not found then
    raise exception 'tripletex_invoices.invoice_id % does not exist', new.invoice_id;
  end if;

  new.run_id := v_invoice.run_id;
  new.company_id := v_invoice.company_id;

  if new.attempts is null or new.attempts < 0 then
    new.attempts := 0;
  end if;

  return new;
end;
$$;


--
-- Name: tg_validate_company_product_price_scope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_validate_company_product_price_scope() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_product_company uuid;
begin
  select p.company_id
  into v_product_company
  from public.products p
  where p.id = new.product_id;

  if v_product_company is not null and v_product_company <> new.company_id then
    raise exception 'A company price row cannot point to a product owned by another company';
  end if;

  return new;
end;
$$;


--
-- Name: tg_validate_delivery_v2(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_validate_delivery_v2() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_run_date date;
begin
  if new.run_id is not null then
    select dr.date
    into v_run_date
    from public.driver_runs dr
    where dr.id = new.run_id;

    if v_run_date is null then
      raise exception 'deliveries.run_id % does not exist', new.run_id;
    end if;

    if new.date <> v_run_date then
      raise exception 'deliveries.date must match driver_runs.date';
    end if;
  end if;

  if upper(new.status::text) = 'DELIVERED' then
    if new.delivered_at is null then
      new.delivered_at := now();
    end if;

    if new.delivered_by is null then
      new.delivered_by := auth.uid();
    end if;
  elsif tg_op = 'INSERT' then
    new.delivered_at := null;
    new.delivered_by := null;
  end if;

  return new;
end;
$$;


--
-- Name: tg_validate_driver_run_assignment_v2(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_validate_driver_run_assignment_v2() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.driver_user_id is not null and not exists (
    select 1
    from public.profiles p
    where p.id = new.driver_user_id
      and lower(p.role::text) = 'driver'
      and coalesce(p.active, true) = true
      and p.archived_at is null
      and p.disabled_at is null
  ) then
    raise exception 'driver_runs.driver_user_id must point to an active driver profile';
  end if;

  return new;
end;
$$;


--
-- Name: tg_validate_membership_scope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_validate_membership_scope() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_company_id uuid;
begin
  if new.location_id is not null then
    select l.company_id
    into v_company_id
    from public.company_locations l
    where l.id = new.location_id;

    if v_company_id is null then
      raise exception 'Membership references unknown location: %', new.location_id;
    end if;

    if v_company_id <> new.company_id then
      raise exception 'Membership location must belong to the same company';
    end if;
  end if;

  return new;
end;
$$;


--
-- Name: tg_validate_standing_order_scope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tg_validate_standing_order_scope() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_location_company uuid;
  v_product_company uuid;
begin
  select l.company_id
  into v_location_company
  from public.company_locations l
  where l.id = new.location_id;

  if v_location_company is null then
    raise exception 'Unknown location: %', new.location_id;
  end if;

  if v_location_company <> new.company_id then
    raise exception 'Standing order company must match location company';
  end if;

  select p.company_id
  into v_product_company
  from public.products p
  where p.id = new.product_id
    and p.is_active = true
    and p.is_visible = true;

  if v_product_company is not null and v_product_company <> new.company_id then
    raise exception 'Standing order product belongs to another company';
  end if;

  return new;
end;
$$;


--
-- Name: trg_company_memberships_recompute_profile_legacy_scope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_company_memberships_recompute_profile_legacy_scope() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.recompute_profile_legacy_scope(coalesce(new.user_id, old.user_id));

  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    perform public.recompute_profile_legacy_scope(old.user_id);
  end if;

  return coalesce(new, old);
end;
$$;


--
-- Name: trg_location_memberships_recompute_profile_legacy_scope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_location_memberships_recompute_profile_legacy_scope() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform public.recompute_profile_legacy_scope(coalesce(new.user_id, old.user_id));

  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    perform public.recompute_profile_legacy_scope(old.user_id);
  end if;

  return coalesce(new, old);
end;
$$;


--
-- Name: _migration_legacy_stub_invoice_lines_archive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migration_legacy_stub_invoice_lines_archive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid NOT NULL,
    tier public.agreement_tier NOT NULL,
    unit_price_nok integer NOT NULL,
    quantity integer NOT NULL,
    amount_nok integer NOT NULL,
    basis jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_id uuid NOT NULL,
    order_id uuid,
    service_on date,
    description text DEFAULT 'Invoice line'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_run_id uuid,
    line_type public.invoice_line_type DEFAULT 'order'::public.invoice_line_type,
    billing_adjustment_id uuid,
    user_id uuid,
    service_date date,
    unit_price_cents_ex_vat integer,
    line_subtotal_cents_ex_vat integer,
    line_vat_cents integer,
    line_total_cents_inc_vat integer,
    CONSTRAINT invoice_lines_amount_matches_qty_price_ck CHECK ((amount_nok = (quantity * unit_price_nok))),
    CONSTRAINT invoice_lines_amount_nok_nonnegative CHECK ((amount_nok >= 0)),
    CONSTRAINT invoice_lines_quantity_positive CHECK ((quantity > 0)),
    CONSTRAINT invoice_lines_unit_price_nok_nonnegative CHECK ((unit_price_nok >= 0))
);


--
-- Name: _migration_legacy_stub_order_items_archive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migration_legacy_stub_order_items_archive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    menu_service_day_item_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    product_name_snapshot text NOT NULL,
    unit_name_snapshot text NOT NULL,
    unit_price_cents_ex_vat integer NOT NULL,
    vat_rate_snapshot numeric(5,2) NOT NULL,
    allergens_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    dietary_tags_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    line_subtotal_cents_ex_vat integer DEFAULT 0 NOT NULL,
    line_vat_cents integer DEFAULT 0 NOT NULL,
    line_total_cents_inc_vat integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_items_line_subtotal_cents_ex_vat_check CHECK ((line_subtotal_cents_ex_vat >= 0)),
    CONSTRAINT order_items_line_total_cents_inc_vat_check CHECK ((line_total_cents_inc_vat >= 0)),
    CONSTRAINT order_items_line_vat_cents_check CHECK ((line_vat_cents >= 0)),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT order_items_unit_price_cents_ex_vat_check CHECK ((unit_price_cents_ex_vat >= 0)),
    CONSTRAINT order_items_vat_rate_snapshot_check CHECK (((vat_rate_snapshot >= (0)::numeric) AND (vat_rate_snapshot <= (100)::numeric)))
);


--
-- Name: _migration_legacy_stub_orders_archive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migration_legacy_stub_orders_archive (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    status public.order_status DEFAULT 'ACTIVE'::public.order_status NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid,
    slot text DEFAULT 'default'::text NOT NULL,
    integrity_status text DEFAULT 'ok'::text NOT NULL,
    integrity_reason text,
    integrity_rid text,
    social_post_id uuid,
    agreement_id uuid NOT NULL,
    tier public.agreement_tier NOT NULL,
    unit_price_nok integer NOT NULL,
    cancelled_at timestamp with time zone,
    menu_service_day_id uuid,
    service_date date,
    source public.order_source DEFAULT 'web'::public.order_source,
    cutoff_at timestamp with time zone,
    locked_at timestamp with time zone,
    cancel_reason text,
    customer_note text,
    internal_note text,
    currency_code text DEFAULT 'NOK'::text,
    subtotal_cents_ex_vat integer DEFAULT 0,
    vat_cents integer DEFAULT 0,
    gross_cents_inc_vat integer DEFAULT 0,
    subsidy_cents_inc_vat integer DEFAULT 0,
    company_billable_cents_inc_vat integer DEFAULT 0,
    employee_payable_cents_inc_vat integer DEFAULT 0,
    created_by uuid,
    CONSTRAINT orders_cancelled_at_required_when_cancelled_ck CHECK (((upper((status)::text) <> 'CANCELLED'::text) OR (cancelled_at IS NOT NULL))),
    CONSTRAINT orders_company_billable_cents_inc_vat_check CHECK ((company_billable_cents_inc_vat >= 0)),
    CONSTRAINT orders_currency_code_check CHECK ((char_length(currency_code) = 3)),
    CONSTRAINT orders_employee_payable_cents_inc_vat_check CHECK ((employee_payable_cents_inc_vat >= 0)),
    CONSTRAINT orders_gross_cents_inc_vat_check CHECK ((gross_cents_inc_vat >= 0)),
    CONSTRAINT orders_slot_check CHECK ((slot = 'default'::text)),
    CONSTRAINT orders_subsidy_cents_inc_vat_check CHECK ((subsidy_cents_inc_vat >= 0)),
    CONSTRAINT orders_subtotal_cents_ex_vat_check CHECK ((subtotal_cents_ex_vat >= 0)),
    CONSTRAINT orders_unit_price_nok_nonnegative CHECK ((unit_price_nok >= 0)),
    CONSTRAINT orders_vat_cents_check CHECK ((vat_cents >= 0))
);


--
-- Name: _migration_legacy_stub_orders_manifest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migration_legacy_stub_orders_manifest (
    batch_id uuid NOT NULL,
    order_id uuid NOT NULL,
    company_id uuid,
    user_id uuid,
    old_location_id_text text,
    backup_reason text,
    archived_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: _migration_orders_location_id_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._migration_orders_location_id_backup (
    order_id_text text NOT NULL,
    old_location_id_text text,
    backup_reason text NOT NULL,
    backed_up_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agreements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agreements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid NOT NULL,
    tier public.agreement_tier DEFAULT 'BASIS'::public.agreement_tier NOT NULL,
    status public.agreement_status DEFAULT 'PENDING'::public.agreement_status NOT NULL,
    delivery_days jsonb DEFAULT '["mon", "tue", "wed", "thu", "fri"]'::jsonb NOT NULL,
    slot_start time without time zone DEFAULT '11:00:00'::time without time zone NOT NULL,
    slot_end time without time zone DEFAULT '13:00:00'::time without time zone NOT NULL,
    starts_at date,
    ends_at date,
    currency text DEFAULT 'NOK'::text NOT NULL,
    price_per_meal_nok integer DEFAULT 90 NOT NULL,
    price_per_meal_luxus_nok integer DEFAULT 130 NOT NULL,
    billing_cycle text DEFAULT 'monthly'::text NOT NULL,
    binding_months integer DEFAULT 12 NOT NULL,
    notice_months integer DEFAULT 3 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    comment_from_company text,
    comment_from_superadmin text,
    start_date date,
    submitted_by_email text,
    submitted_by_name text,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    approved_at timestamp with time zone,
    activated_at timestamp with time zone,
    rejected_at timestamp with time zone,
    rejection_reason text,
    rejected_reason_internal text,
    price_per_employee numeric,
    price_per_meal_enterprise_nok integer,
    CONSTRAINT agreements_billing_cycle_check CHECK ((billing_cycle = 'monthly'::text))
);


--
-- Name: agreement_active_overlap_conflicts_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.agreement_active_overlap_conflicts_v AS
 SELECT a1.location_id,
    a1.company_id,
    a1.id AS agreement_1,
    a1.status AS status_1,
    a1.starts_at AS starts_at_1,
    a1.ends_at AS ends_at_1,
    a2.id AS agreement_2,
    a2.status AS status_2,
    a2.starts_at AS starts_at_2,
    a2.ends_at AS ends_at_2
   FROM (public.agreements a1
     JOIN public.agreements a2 ON (((a1.location_id = a2.location_id) AND (a1.id < a2.id) AND (a1.status = ANY (ARRAY['ACTIVE'::public.agreement_status, 'PAUSED'::public.agreement_status])) AND (a2.status = ANY (ARRAY['ACTIVE'::public.agreement_status, 'PAUSED'::public.agreement_status])) AND (daterange(a1.starts_at, COALESCE((a1.ends_at + 1), 'infinity'::date), '[)'::text) && daterange(a2.starts_at, COALESCE((a2.ends_at + 1), 'infinity'::date), '[)'::text)))));


--
-- Name: agreement_cleanup_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agreement_cleanup_audit (
    id bigint NOT NULL,
    cleanup_at timestamp with time zone DEFAULT now() NOT NULL,
    cleanup_type text NOT NULL,
    agreement_id uuid NOT NULL,
    old_status text,
    new_status text,
    note text
);


--
-- Name: agreement_cleanup_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agreement_cleanup_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agreement_cleanup_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agreement_cleanup_audit_id_seq OWNED BY public.agreement_cleanup_audit.id;


--
-- Name: agreement_delivery_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agreement_delivery_days (
    agreement_id uuid NOT NULL,
    weekday text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tier public.agreement_tier DEFAULT 'BASIS'::public.agreement_tier NOT NULL,
    CONSTRAINT agreement_delivery_days_weekday_check CHECK ((weekday = ANY (ARRAY['mon'::text, 'tue'::text, 'wed'::text, 'thu'::text, 'fri'::text, 'sat'::text, 'sun'::text])))
);


--
-- Name: agreement_overlap_conflicts_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.agreement_overlap_conflicts_v AS
 SELECT a1.location_id,
    a1.company_id,
    a1.id AS agreement_1,
    a1.status AS status_1,
    a1.starts_at AS starts_at_1,
    a1.ends_at AS ends_at_1,
    a2.id AS agreement_2,
    a2.status AS status_2,
    a2.starts_at AS starts_at_2,
    a2.ends_at AS ends_at_2
   FROM (public.agreements a1
     JOIN public.agreements a2 ON (((a1.location_id = a2.location_id) AND (a1.id < a2.id) AND (a1.status = ANY (ARRAY['PENDING'::public.agreement_status, 'ACTIVE'::public.agreement_status, 'PAUSED'::public.agreement_status])) AND (a2.status = ANY (ARRAY['PENDING'::public.agreement_status, 'ACTIVE'::public.agreement_status, 'PAUSED'::public.agreement_status])) AND (daterange(a1.starts_at, COALESCE((a1.ends_at + 1), 'infinity'::date), '[)'::text) && daterange(a2.starts_at, COALESCE((a2.ends_at + 1), 'infinity'::date), '[)'::text)))));


--
-- Name: agreement_pending_exact_shadow_duplicates_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.agreement_pending_exact_shadow_duplicates_v AS
 SELECT DISTINCT p.id AS pending_agreement_id,
    a.id AS active_agreement_id,
    p.company_id,
    p.location_id,
    p.starts_at AS pending_starts_at,
    p.ends_at AS pending_ends_at,
    a.starts_at AS active_starts_at,
    a.ends_at AS active_ends_at,
    p.created_at AS pending_created_at,
    a.created_at AS active_created_at
   FROM (public.agreements p
     JOIN public.agreements a ON (((p.location_id = a.location_id) AND (p.company_id = a.company_id) AND (p.id <> a.id) AND (upper((p.status)::text) = 'PENDING'::text) AND (upper((a.status)::text) = ANY (ARRAY['ACTIVE'::text, 'PAUSED'::text])) AND (daterange(p.starts_at, COALESCE((p.ends_at + 1), 'infinity'::date), '[)'::text) && daterange(a.starts_at, COALESCE((a.ends_at + 1), 'infinity'::date), '[)'::text)) AND (NOT (p.starts_at IS DISTINCT FROM a.starts_at)) AND (NOT (p.ends_at IS DISTINCT FROM a.ends_at)) AND (NOT (p.tier IS DISTINCT FROM a.tier)) AND (NOT (p.slot_start IS DISTINCT FROM a.slot_start)) AND (NOT (p.slot_end IS DISTINCT FROM a.slot_end)) AND (NOT (p.currency IS DISTINCT FROM a.currency)) AND (NOT (p.price_per_meal_nok IS DISTINCT FROM a.price_per_meal_nok)) AND (NOT (p.price_per_meal_luxus_nok IS DISTINCT FROM a.price_per_meal_luxus_nok)) AND (NOT (p.billing_cycle IS DISTINCT FROM a.billing_cycle)) AND (NOT (p.binding_months IS DISTINCT FROM a.binding_months)) AND (NOT (p.notice_months IS DISTINCT FROM a.notice_months)) AND (public.agreement_delivery_days_array(p.id) = public.agreement_delivery_days_array(a.id)))));


--
-- Name: agreement_pending_nonexact_shadow_conflicts_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.agreement_pending_nonexact_shadow_conflicts_v AS
 SELECT p.location_id,
    p.company_id,
    p.id AS pending_agreement_id,
    p.starts_at AS pending_starts_at,
    p.ends_at AS pending_ends_at,
    a.id AS active_agreement_id,
    a.status AS active_status,
    a.starts_at AS active_starts_at,
    a.ends_at AS active_ends_at
   FROM (public.agreements p
     JOIN public.agreements a ON (((p.location_id = a.location_id) AND (p.company_id = a.company_id) AND (p.id <> a.id) AND (upper((p.status)::text) = 'PENDING'::text) AND (upper((a.status)::text) = ANY (ARRAY['ACTIVE'::text, 'PAUSED'::text])) AND (daterange(p.starts_at, COALESCE((p.ends_at + 1), 'infinity'::date), '[)'::text) && daterange(a.starts_at, COALESCE((a.ends_at + 1), 'infinity'::date), '[)'::text)))))
  WHERE (NOT (EXISTS ( SELECT 1
           FROM public.agreement_pending_exact_shadow_duplicates_v d
          WHERE ((d.pending_agreement_id = p.id) AND (d.active_agreement_id = a.id)))));


--
-- Name: agreement_pending_pending_exact_duplicates_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.agreement_pending_pending_exact_duplicates_v AS
 SELECT DISTINCT p1.location_id,
    p1.company_id,
    p1.id AS pending_agreement_1,
    p2.id AS pending_agreement_2,
    p1.starts_at,
    p1.ends_at,
    p1.created_at AS created_at_1,
    p2.created_at AS created_at_2
   FROM (public.agreements p1
     JOIN public.agreements p2 ON (((p1.location_id = p2.location_id) AND (p1.company_id = p2.company_id) AND (p1.id < p2.id) AND (upper((p1.status)::text) = 'PENDING'::text) AND (upper((p2.status)::text) = 'PENDING'::text) AND (daterange(p1.starts_at, COALESCE((p1.ends_at + 1), 'infinity'::date), '[)'::text) && daterange(p2.starts_at, COALESCE((p2.ends_at + 1), 'infinity'::date), '[)'::text)) AND (NOT (p1.starts_at IS DISTINCT FROM p2.starts_at)) AND (NOT (p1.ends_at IS DISTINCT FROM p2.ends_at)) AND (NOT (p1.tier IS DISTINCT FROM p2.tier)) AND (NOT (p1.slot_start IS DISTINCT FROM p2.slot_start)) AND (NOT (p1.slot_end IS DISTINCT FROM p2.slot_end)) AND (NOT (p1.currency IS DISTINCT FROM p2.currency)) AND (NOT (p1.price_per_meal_nok IS DISTINCT FROM p2.price_per_meal_nok)) AND (NOT (p1.price_per_meal_luxus_nok IS DISTINCT FROM p2.price_per_meal_luxus_nok)) AND (NOT (p1.billing_cycle IS DISTINCT FROM p2.billing_cycle)) AND (NOT (p1.binding_months IS DISTINCT FROM p2.binding_months)) AND (NOT (p1.notice_months IS DISTINCT FROM p2.notice_months)) AND (public.agreement_delivery_days_array(p1.id) = public.agreement_delivery_days_array(p2.id)))));


--
-- Name: agreement_pending_shadow_conflicts_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.agreement_pending_shadow_conflicts_v AS
 SELECT p.location_id,
    p.company_id,
    p.id AS pending_agreement_id,
    p.starts_at AS pending_starts_at,
    p.ends_at AS pending_ends_at,
    a.id AS active_agreement_id,
    a.status AS active_status,
    a.starts_at AS active_starts_at,
    a.ends_at AS active_ends_at
   FROM (public.agreements p
     JOIN public.agreements a ON (((p.location_id = a.location_id) AND (p.id <> a.id) AND (p.status = 'PENDING'::public.agreement_status) AND (a.status = ANY (ARRAY['ACTIVE'::public.agreement_status, 'PAUSED'::public.agreement_status])) AND (daterange(p.starts_at, COALESCE((p.ends_at + 1), 'infinity'::date), '[)'::text) && daterange(a.starts_at, COALESCE((a.ends_at + 1), 'infinity'::date), '[)'::text)))));


--
-- Name: agreement_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agreement_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    plan text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: ai_action_memory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_action_memory (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_key text NOT NULL,
    surface text NOT NULL,
    action_type text NOT NULL,
    target_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: ai_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_activity_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action text NOT NULL,
    entity_type text,
    entity_id uuid,
    page_id uuid,
    variant_id uuid,
    actor_user_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    duration_ms integer,
    rid text,
    block_id text,
    node_id text,
    status text
);


--
-- Name: ai_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text DEFAULT 'openai'::text NOT NULL,
    model text DEFAULT 'gpt-5'::text NOT NULL,
    temperature numeric DEFAULT 0.3,
    max_tokens integer DEFAULT 2000,
    system_prompt text,
    features jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_config_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_config_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    config_id uuid,
    changed_at timestamp with time zone DEFAULT now(),
    changed_by uuid,
    old_value jsonb,
    new_value jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_health_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_health_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_id uuid,
    variant_id uuid,
    status text DEFAULT 'ok'::text NOT NULL,
    score integer,
    issues jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_type text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    result jsonb DEFAULT '{}'::jsonb NOT NULL,
    error text,
    attempts integer DEFAULT 0 NOT NULL,
    max_attempts integer DEFAULT 3 NOT NULL,
    run_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: ai_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_id uuid,
    variant_id uuid,
    suggestion_type text,
    status text DEFAULT 'pending'::text NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    locale text,
    output jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_at timestamp with time zone,
    discarded_at timestamp with time zone,
    tool text,
    environment text
);


--
-- Name: allergens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allergens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rid text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_user_id uuid,
    actor_email text,
    actor_role text,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    company_id uuid,
    location_id uuid,
    summary text,
    detail jsonb,
    scope text,
    performed_by uuid,
    metadata jsonb DEFAULT '{}'::jsonb
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
)
PARTITION BY RANGE (created_at);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: audit_log_legacy; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_legacy (
    id bigint NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_legacy_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2026m05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m05 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2026m06; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m06 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2026m07; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m07 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2026m08; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m08 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2026m09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m09 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2026m10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m10 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2026m11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m11 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2026m12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2026m12 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2027m01; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2027m01 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2027m02; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2027m02 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2027m03; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2027m03 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2027m04; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2027m04 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2027m05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2027m05 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2027m06; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2027m06 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2027m07; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2027m07 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2027m08; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2027m08 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2027m09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2027m09 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2027m10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2027m10 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2027m11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2027m11 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2027m12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2027m12 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2028m01; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2028m01 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2028m02; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2028m02 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2028m03; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2028m03 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2028m04; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2028m04 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2028m05; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2028m05 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2028m06; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2028m06 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2028m07; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2028m07 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2028m08; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2028m08 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2028m09; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2028m09 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2028m10; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2028m10 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2028m11; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2028m11 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2028m12; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2028m12 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2029m01; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2029m01 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2029m02; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2029m02 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2029m03; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2029m03 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y2029m04; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y2029m04 (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: audit_log_y_default; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_y_default (
    id bigint DEFAULT nextval('public.audit_log_id_seq'::regclass) NOT NULL,
    actor_user_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    old_data jsonb,
    new_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: billing_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid,
    effective_date date NOT NULL,
    adjustment_type public.adjustment_type NOT NULL,
    description text NOT NULL,
    amount_cents_inc_vat integer NOT NULL,
    vat_rate numeric(5,2) DEFAULT 0 NOT NULL,
    invoice_run_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT billing_adjustments_amount_cents_inc_vat_check CHECK ((amount_cents_inc_vat > 0)),
    CONSTRAINT billing_adjustments_vat_rate_check CHECK (((vat_rate >= (0)::numeric) AND (vat_rate <= (100)::numeric)))
);


--
-- Name: closed_dates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.closed_dates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    reason public.closed_reason NOT NULL,
    scope_company_id uuid,
    scope_location_id uuid,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    orgnr text,
    name text NOT NULL,
    status public.company_status DEFAULT 'PENDING'::public.company_status NOT NULL,
    employee_count integer,
    contact_name text,
    contact_email text,
    contact_phone text,
    address text,
    enterprise_group_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    delete_reason text,
    slug public.citext,
    organization_number text,
    billing_email public.citext,
    timezone text DEFAULT 'Europe/Oslo'::text,
    created_by uuid,
    default_location_id uuid,
    CONSTRAINT companies_pending_registration_fields_ck CHECK (((status <> 'PENDING'::public.company_status) OR ((employee_count IS NOT NULL) AND (employee_count >= 20) AND (contact_name IS NOT NULL) AND (btrim(contact_name) <> ''::text) AND (contact_email IS NOT NULL) AND (btrim(contact_email) <> ''::text) AND (contact_phone IS NOT NULL) AND (btrim(contact_phone) <> ''::text) AND (address IS NOT NULL) AND (btrim(address) <> ''::text)))),
    CONSTRAINT companies_status_check CHECK ((status = ANY (ARRAY['LEAD'::public.company_status, 'PENDING'::public.company_status, 'ACTIVE'::public.company_status, 'PAUSED'::public.company_status, 'CLOSED'::public.company_status, 'TERMINATED'::public.company_status])))
);


--
-- Name: company_contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    valid_from date NOT NULL,
    valid_to date,
    currency_code text DEFAULT 'NOK'::text NOT NULL,
    billing_mode public.billing_mode DEFAULT 'company_pays_full'::public.billing_mode NOT NULL,
    default_cutoff_local_time time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    default_employee_subsidy_cents_inc_vat integer DEFAULT 0 NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT company_contracts_check CHECK (((valid_to IS NULL) OR (valid_to >= valid_from))),
    CONSTRAINT company_contracts_currency_code_check CHECK ((char_length(currency_code) = 3)),
    CONSTRAINT company_contracts_default_employee_subsidy_cents_inc_vat_check CHECK ((default_employee_subsidy_cents_inc_vat >= 0))
);


--
-- Name: company_current_agreement; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.company_current_agreement AS
 SELECT DISTINCT ON (company_id) id,
    company_id,
    id AS agreement_id,
    location_id,
    status,
    tier AS plan_tier,
    price_per_meal_nok AS price_per_cuvert_nok,
    delivery_days,
    starts_at AS start_date,
    ends_at AS end_date,
    created_at,
    updated_at
   FROM public.agreements a
  WHERE (status = 'ACTIVE'::public.agreement_status)
  ORDER BY company_id, created_at DESC;


--
-- Name: company_current_agreement_rules; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.company_current_agreement_rules AS
 WITH current_agreement AS (
         SELECT DISTINCT ON (a.company_id) a.id,
            a.company_id,
            a.location_id,
            a.tier,
            a.status,
            a.delivery_days,
            a.slot_start,
            a.slot_end,
            a.starts_at,
            a.ends_at,
            a.currency,
            a.price_per_meal_nok,
            a.price_per_meal_luxus_nok,
            a.billing_cycle,
            a.binding_months,
            a.notice_months,
            a.created_at,
            a.updated_at,
            a.comment_from_company,
            a.comment_from_superadmin,
            a.start_date,
            a.submitted_by_email,
            a.submitted_by_name,
            a.reviewed_by,
            a.reviewed_at,
            a.approved_at,
            a.activated_at,
            a.rejected_at,
            a.rejection_reason,
            a.rejected_reason_internal,
            a.price_per_employee,
            a.price_per_meal_enterprise_nok
           FROM public.agreements a
          WHERE (a.status = 'ACTIVE'::public.agreement_status)
          ORDER BY a.company_id, a.created_at DESC
        ), expanded AS (
         SELECT ca.company_id,
            ca.id AS agreement_id,
            lower(TRIM(BOTH FROM d.value)) AS day_key,
            COALESCE(add.tier, ca.tier) AS day_tier,
            ca.price_per_meal_nok,
            ca.price_per_meal_luxus_nok,
            ca.price_per_meal_enterprise_nok,
            ca.starts_at,
            ca.start_date,
            ca.ends_at
           FROM ((current_agreement ca
             CROSS JOIN LATERAL jsonb_array_elements_text(ca.delivery_days) d(value))
             LEFT JOIN public.agreement_delivery_days add ON (((add.agreement_id = ca.id) AND (add.weekday = lower(TRIM(BOTH FROM d.value))))))
          WHERE (lower(TRIM(BOTH FROM d.value)) = ANY (ARRAY['mon'::text, 'tue'::text, 'wed'::text, 'thu'::text, 'fri'::text]))
        ), priced AS (
         SELECT e.company_id,
            e.agreement_id,
            e.day_key,
            e.day_tier,
            e.price_per_meal_nok,
            e.price_per_meal_luxus_nok,
            e.price_per_meal_enterprise_nok,
            e.starts_at,
            e.start_date,
            e.ends_at,
                CASE e.day_tier
                    WHEN 'BASIS'::public.agreement_tier THEN (e.price_per_meal_nok)::numeric
                    WHEN 'LUXUS'::public.agreement_tier THEN (e.price_per_meal_luxus_nok)::numeric
                    WHEN 'ENTERPRISE'::public.agreement_tier THEN (COALESCE(e.price_per_meal_enterprise_nok, e.price_per_meal_nok))::numeric
                    ELSE NULL::numeric
                END AS price_ex_vat
           FROM expanded e
        )
 SELECT extensions.uuid_generate_v5('a04f0000-0000-0000-0000-000000000001'::uuid, ((((company_id)::text || '|'::text) || day_key) || '|lunch'::text)) AS id,
    company_id,
    day_key,
    'lunch'::text AS slot,
    true AS is_enabled,
    day_tier AS tier,
    price_ex_vat,
        CASE
            WHEN (price_ex_vat IS NULL) THEN NULL::integer
            ELSE (round((price_ex_vat * 1.15)))::integer
        END AS price_inc_vat,
    COALESCE(starts_at, start_date, '1970-01-01'::date) AS valid_from,
    ends_at AS valid_to
   FROM priced p;


--
-- Name: company_deletions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_deletions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    company_name_snapshot text,
    orgnr_snapshot text,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_by uuid,
    reason text,
    counts_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    mode text DEFAULT 'archive+kill-access'::text NOT NULL
);


--
-- Name: company_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code text DEFAULT ('token:'::text || (gen_random_uuid())::text) NOT NULL,
    created_by uuid,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    role text DEFAULT 'company_admin'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    token_hash text NOT NULL,
    used_at timestamp with time zone,
    contact_email text NOT NULL,
    contact_name text,
    CONSTRAINT company_invites_code_not_blank_ck CHECK ((btrim(code) <> ''::text))
);


--
-- Name: company_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    address text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    slot_policy text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT company_locations_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'PAUSED'::text, 'CLOSED'::text])))
);


--
-- Name: company_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    role public.membership_role DEFAULT 'employee'::public.membership_role NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    location_id uuid,
    status public.membership_status DEFAULT 'invited'::public.membership_status,
    employee_number text,
    cost_center text,
    granted_by uuid,
    activated_at timestamp with time zone,
    CONSTRAINT company_memberships_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'legacy_profile_sync'::text])))
);


--
-- Name: company_product_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_product_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    product_id uuid NOT NULL,
    valid_from date NOT NULL,
    valid_to date,
    price_cents_ex_vat integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT company_product_prices_check CHECK (((valid_to IS NULL) OR (valid_to >= valid_from))),
    CONSTRAINT company_product_prices_price_cents_ex_vat_check CHECK ((price_cents_ex_vat >= 0))
);


--
-- Name: company_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    agreement_id uuid,
    status text DEFAULT 'PENDING'::text NOT NULL,
    orgnr text,
    company_name text,
    submitted_by_email text,
    submitted_by_name text,
    contact_name text,
    contact_email text,
    contact_phone text,
    address_line text,
    postal_code text,
    city text,
    plan_tier text,
    employee_count integer,
    weekday_meal_tiers jsonb,
    delivery_window_from time without time zone,
    delivery_window_to time without time zone,
    terms_binding_months integer,
    terms_notice_months integer,
    submitted_payload jsonb,
    raw_payload jsonb,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    decision_note_internal text,
    approval_email_sent_at timestamp with time zone,
    rejection_message_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rejection_reason text
);


--
-- Name: content_health; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.content_health AS
 SELECT DISTINCT ON (COALESCE(page_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)) id,
    page_id,
    variant_id,
    status,
    score,
    issues,
    created_at
   FROM public.ai_health_checks
  ORDER BY COALESCE(page_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid), created_at DESC;


--
-- Name: content_page_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_page_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    page_id uuid NOT NULL,
    locale text DEFAULT 'nb'::text NOT NULL,
    environment text DEFAULT 'prod'::text NOT NULL,
    body jsonb DEFAULT '{"blocks": [], "version": 1}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    published_at timestamp with time zone,
    CONSTRAINT content_page_variants_environment_check CHECK ((environment = ANY (ARRAY['prod'::text, 'staging'::text, 'preview'::text])))
);


--
-- Name: content_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    published_at timestamp with time zone,
    body jsonb DEFAULT '{}'::jsonb NOT NULL,
    tree_parent_id uuid,
    tree_root_key text,
    tree_sort_order integer DEFAULT 0 NOT NULL,
    CONSTRAINT content_pages_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text]))),
    CONSTRAINT content_pages_tree_placement_check CHECK ((((tree_parent_id IS NULL) AND (tree_root_key IS NOT NULL)) OR ((tree_parent_id IS NOT NULL) AND (tree_root_key IS NULL)) OR ((tree_parent_id IS NULL) AND (tree_root_key IS NULL)))),
    CONSTRAINT content_pages_tree_root_key_check CHECK (((tree_root_key IS NULL) OR (tree_root_key = ANY (ARRAY['home'::text, 'overlays'::text, 'global'::text, 'design'::text]))))
);


--
-- Name: day_choices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.day_choices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    choice_key text NOT NULL,
    note text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    item_key text,
    item_title_snapshot text,
    CONSTRAINT day_choices_status_ck CHECK ((upper(status) = ANY (ARRAY['ACTIVE'::text, 'CANCELLED'::text])))
);


--
-- Name: deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid,
    date date NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid NOT NULL,
    status public.delivery_status DEFAULT 'PLANNED'::public.delivery_status NOT NULL,
    delivered_at timestamp with time zone,
    delivered_by uuid,
    proof jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    notes text
);


--
-- Name: delivery_run_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_run_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delivery_run_id uuid NOT NULL,
    product_id uuid,
    product_name_snapshot text NOT NULL,
    total_quantity integer NOT NULL,
    order_count integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT delivery_run_items_order_count_check CHECK ((order_count > 0)),
    CONSTRAINT delivery_run_items_total_quantity_check CHECK ((total_quantity > 0))
);


--
-- Name: delivery_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid NOT NULL,
    service_date date NOT NULL,
    status public.delivery_status DEFAULT 'planned'::public.delivery_status NOT NULL,
    kitchen_note text,
    courier_note text,
    packed_at timestamp with time zone,
    dispatched_at timestamp with time zone,
    delivered_at timestamp with time zone,
    received_by text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dietary_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dietary_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: driver_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    status public.delivery_run_status DEFAULT 'PLANNED'::public.delivery_run_status NOT NULL,
    driver_user_id uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid NOT NULL,
    email text NOT NULL,
    role text DEFAULT 'employee'::text NOT NULL,
    token_hash text NOT NULL,
    full_name text,
    department text,
    created_by_user_id uuid,
    created_by_email text,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    accepted_at timestamp with time zone,
    last_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT employee_invites_email_not_blank_ck CHECK ((btrim(email) <> ''::text)),
    CONSTRAINT employee_invites_expiry_ck CHECK ((expires_at > created_at)),
    CONSTRAINT employee_invites_role_ck CHECK ((lower(role) = 'employee'::text)),
    CONSTRAINT employee_invites_token_hash_not_blank_ck CHECK ((btrim(token_hash) <> ''::text))
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    menu_service_day_item_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    product_name_snapshot text NOT NULL,
    unit_name_snapshot text NOT NULL,
    unit_price_cents_ex_vat integer NOT NULL,
    vat_rate_snapshot numeric(5,2) NOT NULL,
    allergens_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    dietary_tags_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text,
    line_subtotal_cents_ex_vat integer DEFAULT 0 NOT NULL,
    line_vat_cents integer DEFAULT 0 NOT NULL,
    line_total_cents_inc_vat integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_items_line_subtotal_cents_ex_vat_check CHECK ((line_subtotal_cents_ex_vat >= 0)),
    CONSTRAINT order_items_line_total_cents_inc_vat_check CHECK ((line_total_cents_inc_vat >= 0)),
    CONSTRAINT order_items_line_vat_cents_check CHECK ((line_vat_cents >= 0)),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT order_items_unit_price_cents_ex_vat_check CHECK ((unit_price_cents_ex_vat >= 0)),
    CONSTRAINT order_items_vat_rate_snapshot_check CHECK (((vat_rate_snapshot >= (0)::numeric) AND (vat_rate_snapshot <= (100)::numeric)))
);


--
-- Name: employee_order_items; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.employee_order_items WITH (security_invoker='true') AS
 SELECT order_id,
    product_name_snapshot,
    unit_name_snapshot,
    quantity
   FROM public.order_items oi;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    status public.order_status DEFAULT 'ACTIVE'::public.order_status NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid,
    slot text DEFAULT 'default'::text NOT NULL,
    integrity_status text DEFAULT 'ok'::text NOT NULL,
    integrity_reason text,
    integrity_rid text,
    social_post_id uuid,
    agreement_id uuid NOT NULL,
    tier public.agreement_tier NOT NULL,
    unit_price_nok integer NOT NULL,
    cancelled_at timestamp with time zone,
    menu_service_day_id uuid,
    service_date date,
    source public.order_source DEFAULT 'web'::public.order_source,
    cutoff_at timestamp with time zone,
    locked_at timestamp with time zone,
    cancel_reason text,
    customer_note text,
    internal_note text,
    currency_code text DEFAULT 'NOK'::text,
    subtotal_cents_ex_vat integer DEFAULT 0,
    vat_cents integer DEFAULT 0,
    gross_cents_inc_vat integer DEFAULT 0,
    subsidy_cents_inc_vat integer DEFAULT 0,
    company_billable_cents_inc_vat integer DEFAULT 0,
    employee_payable_cents_inc_vat integer DEFAULT 0,
    created_by uuid,
    CONSTRAINT orders_cancelled_at_required_when_cancelled_ck CHECK (((upper((status)::text) <> 'CANCELLED'::text) OR (cancelled_at IS NOT NULL))),
    CONSTRAINT orders_company_billable_cents_inc_vat_check CHECK ((company_billable_cents_inc_vat >= 0)),
    CONSTRAINT orders_currency_code_check CHECK ((char_length(currency_code) = 3)),
    CONSTRAINT orders_employee_payable_cents_inc_vat_check CHECK ((employee_payable_cents_inc_vat >= 0)),
    CONSTRAINT orders_gross_cents_inc_vat_check CHECK ((gross_cents_inc_vat >= 0)),
    CONSTRAINT orders_slot_check CHECK ((slot = 'default'::text)),
    CONSTRAINT orders_subsidy_cents_inc_vat_check CHECK ((subsidy_cents_inc_vat >= 0)),
    CONSTRAINT orders_subtotal_cents_ex_vat_check CHECK ((subtotal_cents_ex_vat >= 0)),
    CONSTRAINT orders_unit_price_nok_nonnegative CHECK ((unit_price_nok >= 0)),
    CONSTRAINT orders_vat_cents_check CHECK ((vat_cents >= 0))
);


--
-- Name: employee_orders; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.employee_orders WITH (security_invoker='true') AS
 SELECT id,
    user_id,
    service_date,
    status,
    slot,
    note,
    cutoff_at,
    created_at,
    updated_at
   FROM public.orders o;


--
-- Name: enterprise_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enterprise_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    orgnr text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: esg_daily; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.esg_daily (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid NOT NULL,
    active_orders integer NOT NULL,
    cancelled integer DEFAULT 0 NOT NULL,
    produced integer NOT NULL,
    delivered integer DEFAULT 0 NOT NULL,
    notes jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: esg_monthly; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.esg_monthly (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    month_start date NOT NULL,
    company_id uuid NOT NULL,
    basis jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: form_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    form_id uuid NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    environment text DEFAULT 'prod'::text NOT NULL,
    locale text DEFAULT 'nb'::text NOT NULL,
    schema jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT forms_environment_check CHECK ((environment = ANY (ARRAY['prod'::text, 'staging'::text]))),
    CONSTRAINT forms_locale_check CHECK ((locale = ANY (ARRAY['nb'::text, 'en'::text])))
);


--
-- Name: idempotency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.idempotency (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    key text NOT NULL,
    response jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    request_hash text,
    status text DEFAULT 'IN_PROGRESS'::text NOT NULL,
    response_code integer,
    response_json jsonb,
    last_error text,
    expires_at timestamp with time zone,
    CONSTRAINT idempotency_status_check CHECK ((status = ANY (ARRAY['IN_PROGRESS'::text, 'COMPLETED'::text, 'FAILED'::text])))
);


--
-- Name: incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    severity text NOT NULL,
    rid text,
    message text NOT NULL,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoice_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid NOT NULL,
    tier public.agreement_tier NOT NULL,
    unit_price_nok integer NOT NULL,
    quantity integer NOT NULL,
    amount_nok integer NOT NULL,
    basis jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_id uuid NOT NULL,
    order_id uuid,
    service_on date,
    description text DEFAULT 'Invoice line'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_run_id uuid,
    line_type public.invoice_line_type DEFAULT 'order'::public.invoice_line_type,
    billing_adjustment_id uuid,
    user_id uuid,
    service_date date,
    unit_price_cents_ex_vat integer,
    line_subtotal_cents_ex_vat integer,
    line_vat_cents integer,
    line_total_cents_inc_vat integer,
    CONSTRAINT invoice_lines_amount_matches_qty_price_ck CHECK ((amount_nok = (quantity * unit_price_nok))),
    CONSTRAINT invoice_lines_amount_nok_nonnegative CHECK ((amount_nok >= 0)),
    CONSTRAINT invoice_lines_quantity_positive CHECK ((quantity > 0)),
    CONSTRAINT invoice_lines_unit_price_nok_nonnegative CHECK ((unit_price_nok >= 0))
);


--
-- Name: invoice_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    status public.invoice_run_status DEFAULT 'DRAFT'::public.invoice_run_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rid text,
    created_by uuid,
    company_id uuid,
    currency_code text DEFAULT 'NOK'::text,
    subtotal_cents_ex_vat integer DEFAULT 0,
    adjustments_cents_inc_vat integer DEFAULT 0,
    vat_cents integer DEFAULT 0,
    total_cents_inc_vat integer DEFAULT 0,
    external_invoice_ref text,
    generated_at timestamp with time zone DEFAULT now(),
    finalized_at timestamp with time zone,
    CONSTRAINT invoice_runs_currency_code_check CHECK ((char_length(currency_code) = 3)),
    CONSTRAINT invoice_runs_period_window_check CHECK ((period_end >= period_start))
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    company_id uuid NOT NULL,
    status public.invoice_status DEFAULT 'DRAFT'::public.invoice_status NOT NULL,
    currency_code text DEFAULT 'NOK'::text NOT NULL,
    subtotal_nok integer DEFAULT 0 NOT NULL,
    vat_nok integer DEFAULT 0 NOT NULL,
    total_nok integer DEFAULT 0 NOT NULL,
    external_invoice_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoices_subtotal_nok_nonnegative CHECK ((subtotal_nok >= 0)),
    CONSTRAINT invoices_total_nok_nonnegative CHECK ((total_nok >= 0)),
    CONSTRAINT invoices_vat_nok_nonnegative CHECK ((vat_nok >= 0))
);


--
-- Name: kitchen_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kitchen_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    delivery_date date NOT NULL,
    delivery_window text DEFAULT 'lunch'::text NOT NULL,
    company_location_id uuid NOT NULL,
    status text DEFAULT 'QUEUED'::text NOT NULL,
    packed_at timestamp with time zone,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT kitchen_batches_status_ck CHECK ((upper(status) = ANY (ARRAY['QUEUED'::text, 'PACKED'::text, 'DELIVERED'::text])))
);


--
-- Name: kitchen_batch; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.kitchen_batch AS
 SELECT id,
    delivery_date,
    delivery_window,
    company_location_id,
    status,
    packed_at,
    delivered_at,
    created_at,
    updated_at
   FROM public.kitchen_batches;


--
-- Name: location_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.location_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid NOT NULL,
    role public.membership_role DEFAULT 'employee'::public.membership_role NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    CONSTRAINT location_memberships_role_check CHECK ((role = ANY (ARRAY['employee'::public.membership_role, 'location_admin'::public.membership_role]))),
    CONSTRAINT location_memberships_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'legacy_profile_sync'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    full_name text,
    role public.user_role DEFAULT 'employee'::public.user_role NOT NULL,
    company_id uuid,
    location_id uuid,
    active boolean DEFAULT true NOT NULL,
    disabled_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text,
    dietary_notes text,
    allergy_notes text,
    is_active boolean DEFAULT true
);


--
-- Name: kitchen_scope_gap_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.kitchen_scope_gap_v AS
 SELECT id AS user_id,
    email,
    full_name,
    active,
    company_id AS legacy_company_id,
    location_id AS legacy_location_id,
    ( SELECT count(*) AS count
           FROM public.company_memberships cm
          WHERE ((cm.user_id = p.id) AND (cm.active = true))) AS active_company_memberships,
    ( SELECT count(*) AS count
           FROM public.location_memberships lm
          WHERE ((lm.user_id = p.id) AND (lm.active = true))) AS active_location_memberships
   FROM public.profiles p
  WHERE ((role)::text = 'kitchen'::text);


--
-- Name: lead_pipeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_pipeline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    company_name text,
    stage text DEFAULT 'lead'::text NOT NULL,
    value numeric DEFAULT 0,
    probability numeric DEFAULT 0,
    source text,
    contact_email text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: location_closed_dates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.location_closed_dates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_id uuid NOT NULL,
    closed_date date NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: location_policies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.location_policies (
    location_id uuid NOT NULL,
    cutoff_local_time time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    employee_subsidy_cents_inc_vat integer DEFAULT 0 NOT NULL,
    allow_standing_orders boolean DEFAULT true NOT NULL,
    menu_publish_days_ahead integer DEFAULT 14 NOT NULL,
    min_order_quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT location_policies_employee_subsidy_cents_inc_vat_check CHECK ((employee_subsidy_cents_inc_vat >= 0)),
    CONSTRAINT location_policies_menu_publish_days_ahead_check CHECK ((menu_publish_days_ahead > 0)),
    CONSTRAINT location_policies_min_order_quantity_check CHECK ((min_order_quantity > 0))
);


--
-- Name: marketing_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketing_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug public.citext NOT NULL,
    draft jsonb DEFAULT '{}'::jsonb NOT NULL,
    published jsonb,
    sections jsonb,
    seo jsonb,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.marketing_pages FORCE ROW LEVEL SECURITY;


--
-- Name: media_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text DEFAULT 'image'::text NOT NULL,
    status text DEFAULT 'proposed'::text NOT NULL,
    source text DEFAULT 'upload'::text NOT NULL,
    url text NOT NULL,
    alt text,
    caption text,
    width integer,
    height integer,
    mime_type text,
    bytes integer,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT media_items_source_check CHECK ((source = ANY (ARRAY['upload'::text, 'ai'::text]))),
    CONSTRAINT media_items_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'ready'::text, 'failed'::text]))),
    CONSTRAINT media_items_type_check CHECK ((type = 'image'::text))
);


--
-- Name: membership_backfill_audit_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.membership_backfill_audit_v AS
 SELECT ( SELECT count(*) AS count
           FROM public.company_memberships) AS company_membership_rows,
    ( SELECT count(*) AS count
           FROM public.location_memberships) AS location_membership_rows,
    ( SELECT count(*) AS count
           FROM public.profiles p
          WHERE ((p.company_id IS NOT NULL) AND (NOT (EXISTS ( SELECT 1
                   FROM public.company_memberships cm
                  WHERE ((cm.user_id = p.id) AND (cm.company_id = p.company_id))))))) AS profiles_missing_company_membership,
    ( SELECT count(*) AS count
           FROM public.profiles p
          WHERE ((p.company_id IS NOT NULL) AND (p.location_id IS NOT NULL) AND (NOT (EXISTS ( SELECT 1
                   FROM public.location_memberships lm
                  WHERE ((lm.user_id = p.id) AND (lm.location_id = p.location_id))))))) AS profiles_missing_location_membership,
    ( SELECT count(*) AS count
           FROM public.agreements a
          WHERE (NOT (EXISTS ( SELECT 1
                   FROM public.agreement_delivery_days addy
                  WHERE (addy.agreement_id = a.id))))) AS agreements_missing_normalized_delivery_days;


--
-- Name: membership_scope_drift_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.membership_scope_drift_v AS
 WITH profile_company_scope AS (
         SELECT p.id AS user_id,
            p.company_id
           FROM public.profiles p
          WHERE (p.company_id IS NOT NULL)
        ), profile_location_scope AS (
         SELECT p.id AS user_id,
            p.company_id,
            p.location_id
           FROM public.profiles p
          WHERE ((p.company_id IS NOT NULL) AND (p.location_id IS NOT NULL))
        )
 SELECT 'profile_missing_company_membership'::text AS issue_type,
    pcs.user_id,
    pcs.company_id,
    NULL::uuid AS location_id
   FROM profile_company_scope pcs
  WHERE (NOT (EXISTS ( SELECT 1
           FROM public.company_memberships cm
          WHERE ((cm.user_id = pcs.user_id) AND (cm.company_id = pcs.company_id) AND (cm.active = true)))))
UNION ALL
 SELECT 'profile_missing_location_membership'::text AS issue_type,
    pls.user_id,
    pls.company_id,
    pls.location_id
   FROM profile_location_scope pls
  WHERE (NOT (EXISTS ( SELECT 1
           FROM public.location_memberships lm
          WHERE ((lm.user_id = pls.user_id) AND (lm.company_id = pls.company_id) AND (lm.location_id = pls.location_id) AND (lm.active = true)))))
UNION ALL
 SELECT 'legacy_sync_company_membership_without_profile_match'::text AS issue_type,
    cm.user_id,
    cm.company_id,
    NULL::uuid AS location_id
   FROM public.company_memberships cm
  WHERE ((cm.source = 'legacy_profile_sync'::text) AND (NOT (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = cm.user_id) AND (p.company_id = cm.company_id))))))
UNION ALL
 SELECT 'legacy_sync_location_membership_without_profile_match'::text AS issue_type,
    lm.user_id,
    lm.company_id,
    lm.location_id
   FROM public.location_memberships lm
  WHERE ((lm.source = 'legacy_profile_sync'::text) AND (NOT (EXISTS ( SELECT 1
           FROM public.profiles p
          WHERE ((p.id = lm.user_id) AND (p.company_id = lm.company_id) AND (p.location_id = lm.location_id))))));


--
-- Name: menu_service_day_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_service_day_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    menu_service_day_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name_snapshot text NOT NULL,
    unit_name_snapshot text NOT NULL,
    offered_price_cents_ex_vat integer NOT NULL,
    vat_rate_snapshot numeric(5,2) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_optional boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT menu_service_day_items_offered_price_cents_ex_vat_check CHECK ((offered_price_cents_ex_vat >= 0)),
    CONSTRAINT menu_service_day_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT menu_service_day_items_vat_rate_snapshot_check CHECK (((vat_rate_snapshot >= (0)::numeric) AND (vat_rate_snapshot <= (100)::numeric)))
);


--
-- Name: menu_service_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_service_days (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid NOT NULL,
    service_date date NOT NULL,
    state public.menu_state DEFAULT 'draft'::public.menu_state NOT NULL,
    cutoff_at timestamp with time zone NOT NULL,
    published_at timestamp with time zone,
    locked_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: menu_visibility_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_visibility_days (
    date date NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ops_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ops_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    level text NOT NULL,
    event text NOT NULL,
    scope_company_id uuid,
    scope_user_id uuid,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    rid text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_status_history (
    id bigint NOT NULL,
    order_id uuid NOT NULL,
    from_status public.order_status,
    to_status public.order_status NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_status_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_status_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_status_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_status_history_id_seq OWNED BY public.order_status_history.id;


--
-- Name: orphan_kitchen_test_profiles_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.orphan_kitchen_test_profiles_v AS
 SELECT id AS profile_id,
    email,
    full_name,
    active,
    archived_at,
    created_at,
    updated_at,
    company_id AS legacy_company_id,
    location_id AS legacy_location_id,
    ( SELECT count(*) AS count
           FROM public.company_memberships cm
          WHERE ((cm.user_id = p.id) AND (cm.active = true))) AS active_company_memberships,
    ( SELECT count(*) AS count
           FROM public.location_memberships lm
          WHERE ((lm.user_id = p.id) AND (lm.active = true))) AS active_location_memberships
   FROM public.profiles p
  WHERE (((role)::text = 'kitchen'::text) AND (email ~~* 'kitchen.%@test.lunchportalen.no'::text) AND (full_name IS NULL) AND (company_id IS NULL) AND (location_id IS NULL) AND (NOT (EXISTS ( SELECT 1
           FROM public.company_memberships cm
          WHERE ((cm.user_id = p.id) AND (cm.active = true))))) AND (NOT (EXISTS ( SELECT 1
           FROM public.location_memberships lm
          WHERE ((lm.user_id = p.id) AND (lm.active = true))))));


--
-- Name: platform_user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_user_roles (
    user_id uuid NOT NULL,
    role public.platform_role NOT NULL,
    granted_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_allergens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_allergens (
    product_id uuid NOT NULL,
    allergen_id uuid NOT NULL,
    is_trace boolean DEFAULT false NOT NULL
);


--
-- Name: product_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: product_dietary_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_dietary_tags (
    product_id uuid NOT NULL,
    dietary_tag_id uuid NOT NULL
);


--
-- Name: production_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_days (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    status public.production_status DEFAULT 'OPEN'::public.production_status NOT NULL,
    frozen_at timestamp with time zone,
    frozen_by uuid,
    stable_hash text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: production_manifests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_manifests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid NOT NULL,
    tier public.agreement_tier NOT NULL,
    slot_start time without time zone NOT NULL,
    slot_end time without time zone NOT NULL,
    active_orders integer NOT NULL,
    totals jsonb DEFAULT '{}'::jsonb NOT NULL,
    export_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid,
    category_id uuid,
    name text NOT NULL,
    description text,
    sku text,
    unit_name text DEFAULT 'stk'::text NOT NULL,
    vat_rate numeric(5,2) DEFAULT 15.00 NOT NULL,
    base_price_cents_ex_vat integer NOT NULL,
    currency_code text DEFAULT 'NOK'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT products_base_price_cents_ex_vat_check CHECK ((base_price_cents_ex_vat >= 0)),
    CONSTRAINT products_currency_code_check CHECK ((char_length(currency_code) = 3)),
    CONSTRAINT products_vat_rate_check CHECK (((vat_rate >= (0)::numeric) AND (vat_rate <= (100)::numeric)))
);


--
-- Name: profile_cleanup_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_cleanup_audit (
    id bigint NOT NULL,
    cleanup_at timestamp with time zone DEFAULT now() NOT NULL,
    cleanup_type text NOT NULL,
    profile_id uuid NOT NULL,
    email text,
    old_role text,
    old_active boolean,
    new_active boolean,
    old_archived_at timestamp with time zone,
    new_archived_at timestamp with time zone,
    note text
);


--
-- Name: profile_cleanup_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.profile_cleanup_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: profile_cleanup_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.profile_cleanup_audit_id_seq OWNED BY public.profile_cleanup_audit.id;


--
-- Name: profile_scope_legacy_write_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_scope_legacy_write_audit (
    id bigint NOT NULL,
    audited_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_user_id uuid,
    profile_id uuid NOT NULL,
    old_company_id uuid,
    new_company_id uuid,
    old_location_id uuid,
    new_location_id uuid,
    note text DEFAULT 'direct_profile_scope_write'::text NOT NULL
);


--
-- Name: profile_scope_legacy_write_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.profile_scope_legacy_write_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: profile_scope_legacy_write_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.profile_scope_legacy_write_audit_id_seq OWNED BY public.profile_scope_legacy_write_audit.id;


--
-- Name: profile_scope_projection_status_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profile_scope_projection_status_v AS
 WITH company_scope AS (
         SELECT cm.user_id,
            count(*) FILTER (WHERE (cm.active = true)) AS active_company_memberships,
                CASE
                    WHEN (count(*) FILTER (WHERE (cm.active = true)) = 1) THEN (array_agg(cm.company_id ORDER BY (cm.company_id)::text) FILTER (WHERE (cm.active = true)))[1]
                    ELSE NULL::uuid
                END AS projected_company_id
           FROM public.company_memberships cm
          GROUP BY cm.user_id
        ), location_scope AS (
         SELECT lm.user_id,
            count(*) FILTER (WHERE (lm.active = true)) AS active_location_memberships,
                CASE
                    WHEN (count(*) FILTER (WHERE (lm.active = true)) = 1) THEN (array_agg(lm.location_id ORDER BY (lm.location_id)::text) FILTER (WHERE (lm.active = true)))[1]
                    ELSE NULL::uuid
                END AS projected_location_id,
                CASE
                    WHEN (count(*) FILTER (WHERE (lm.active = true)) = 1) THEN (array_agg(lm.company_id ORDER BY (lm.company_id)::text) FILTER (WHERE (lm.active = true)))[1]
                    ELSE NULL::uuid
                END AS projected_location_company_id
           FROM public.location_memberships lm
          GROUP BY lm.user_id
        ), base AS (
         SELECT p.id AS profile_id,
            (p.role)::text AS role_label,
            p.company_id AS current_company_id,
            p.location_id AS current_location_id,
            COALESCE(cs.active_company_memberships, (0)::bigint) AS active_company_memberships,
            COALESCE(ls.active_location_memberships, (0)::bigint) AS active_location_memberships,
                CASE
                    WHEN (COALESCE(cs.active_company_memberships, (0)::bigint) = 1) THEN cs.projected_company_id
                    WHEN ((COALESCE(cs.active_company_memberships, (0)::bigint) = 0) AND (COALESCE(ls.active_location_memberships, (0)::bigint) = 1)) THEN ls.projected_location_company_id
                    ELSE NULL::uuid
                END AS projected_company_id,
                CASE
                    WHEN (COALESCE(ls.active_location_memberships, (0)::bigint) = 1) THEN ls.projected_location_id
                    ELSE NULL::uuid
                END AS projected_location_id
           FROM ((public.profiles p
             LEFT JOIN company_scope cs ON ((cs.user_id = p.id)))
             LEFT JOIN location_scope ls ON ((ls.user_id = p.id)))
        )
 SELECT profile_id,
    role_label,
    current_company_id,
    current_location_id,
    active_company_memberships,
    active_location_memberships,
    projected_company_id,
    projected_location_id,
    (active_company_memberships > 1) AS has_ambiguous_company_scope,
    (active_location_memberships > 1) AS has_ambiguous_location_scope,
    (NOT (current_company_id IS DISTINCT FROM projected_company_id)) AS company_projection_matches,
    (NOT (current_location_id IS DISTINCT FROM projected_location_id)) AS location_projection_matches,
    ((NOT (current_company_id IS DISTINCT FROM projected_company_id)) AND (NOT (current_location_id IS DISTINCT FROM projected_location_id))) AS projection_matches
   FROM base b;


--
-- Name: profile_scope_projection_drift_v; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profile_scope_projection_drift_v AS
 SELECT profile_id,
    role_label,
    current_company_id,
    current_location_id,
    active_company_memberships,
    active_location_memberships,
    projected_company_id,
    projected_location_id,
    has_ambiguous_company_scope,
    has_ambiguous_location_scope,
    company_projection_matches,
    location_projection_matches,
    projection_matches
   FROM public.profile_scope_projection_status_v s
  WHERE ((projection_matches = false) OR (has_ambiguous_company_scope = true) OR (has_ambiguous_location_scope = true));


--
-- Name: social_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    status text DEFAULT 'planned'::text,
    content jsonb NOT NULL,
    scheduled_at timestamp with time zone,
    published_at timestamp with time zone,
    platform text,
    external_id text,
    metrics jsonb DEFAULT '{}'::jsonb,
    lead_id uuid,
    CONSTRAINT social_posts_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'ready'::text, 'published'::text, 'cancelled'::text])))
);


--
-- Name: standing_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.standing_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    location_id uuid NOT NULL,
    user_id uuid NOT NULL,
    weekday smallint NOT NULL,
    product_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    active_from date DEFAULT CURRENT_DATE NOT NULL,
    active_to date,
    paused_until date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT standing_orders_check CHECK (((active_to IS NULL) OR (active_to >= active_from))),
    CONSTRAINT standing_orders_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT standing_orders_weekday_check CHECK (((weekday >= 1) AND (weekday <= 7)))
);


--
-- Name: system_health_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_health_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_health_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_health_snapshots (
    id bigint DEFAULT nextval('public.system_health_snapshots_id_seq'::regclass) NOT NULL,
    ts timestamp with time zone DEFAULT now() NOT NULL,
    status text NOT NULL,
    checks jsonb DEFAULT '{}'::jsonb NOT NULL,
    rid text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    severity text NOT NULL,
    type text NOT NULL,
    scope_company_id uuid,
    scope_user_id uuid,
    scope_order_id uuid,
    first_seen timestamp with time zone DEFAULT now() NOT NULL,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    count integer DEFAULT 1 NOT NULL,
    status text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    rid text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    site_name text,
    support_email text,
    ai_enabled boolean DEFAULT true,
    autopilot_enabled boolean DEFAULT false,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    toggles jsonb DEFAULT '{}'::jsonb,
    killswitch jsonb DEFAULT '{}'::jsonb NOT NULL,
    retention jsonb DEFAULT '{}'::jsonb NOT NULL,
    limits jsonb DEFAULT '{}'::jsonb NOT NULL,
    flags jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: tripletex_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tripletex_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    external_customer_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tripletex_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tripletex_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    run_id uuid NOT NULL,
    company_id uuid NOT NULL,
    external_invoice_id text,
    status public.tripletex_sync_status DEFAULT 'PENDING'::public.tripletex_sync_status NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    next_retry_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_id uuid NOT NULL,
    CONSTRAINT tripletex_invoices_attempts_nonnegative CHECK ((attempts >= 0))
);


--
-- Name: v_kitchen_day_report; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_kitchen_day_report AS
 SELECT pm.date,
    pm.company_id,
    c.name AS company_name,
    pm.location_id,
    cl.name AS location_name,
    pm.tier,
    pm.active_orders,
    pm.totals,
    pm.export_id
   FROM ((public.production_manifests pm
     JOIN public.companies c ON ((c.id = pm.company_id)))
     JOIN public.company_locations cl ON ((cl.id = pm.location_id)));


--
-- Name: audit_log_y2026m05; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m05 FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');


--
-- Name: audit_log_y2026m06; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m06 FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');


--
-- Name: audit_log_y2026m07; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m07 FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');


--
-- Name: audit_log_y2026m08; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m08 FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');


--
-- Name: audit_log_y2026m09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m09 FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');


--
-- Name: audit_log_y2026m10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m10 FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');


--
-- Name: audit_log_y2026m11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m11 FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');


--
-- Name: audit_log_y2026m12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2026m12 FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');


--
-- Name: audit_log_y2027m01; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2027m01 FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');


--
-- Name: audit_log_y2027m02; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2027m02 FOR VALUES FROM ('2027-02-01 00:00:00+00') TO ('2027-03-01 00:00:00+00');


--
-- Name: audit_log_y2027m03; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2027m03 FOR VALUES FROM ('2027-03-01 00:00:00+00') TO ('2027-04-01 00:00:00+00');


--
-- Name: audit_log_y2027m04; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2027m04 FOR VALUES FROM ('2027-04-01 00:00:00+00') TO ('2027-05-01 00:00:00+00');


--
-- Name: audit_log_y2027m05; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2027m05 FOR VALUES FROM ('2027-05-01 00:00:00+00') TO ('2027-06-01 00:00:00+00');


--
-- Name: audit_log_y2027m06; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2027m06 FOR VALUES FROM ('2027-06-01 00:00:00+00') TO ('2027-07-01 00:00:00+00');


--
-- Name: audit_log_y2027m07; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2027m07 FOR VALUES FROM ('2027-07-01 00:00:00+00') TO ('2027-08-01 00:00:00+00');


--
-- Name: audit_log_y2027m08; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2027m08 FOR VALUES FROM ('2027-08-01 00:00:00+00') TO ('2027-09-01 00:00:00+00');


--
-- Name: audit_log_y2027m09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2027m09 FOR VALUES FROM ('2027-09-01 00:00:00+00') TO ('2027-10-01 00:00:00+00');


--
-- Name: audit_log_y2027m10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2027m10 FOR VALUES FROM ('2027-10-01 00:00:00+00') TO ('2027-11-01 00:00:00+00');


--
-- Name: audit_log_y2027m11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2027m11 FOR VALUES FROM ('2027-11-01 00:00:00+00') TO ('2027-12-01 00:00:00+00');


--
-- Name: audit_log_y2027m12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2027m12 FOR VALUES FROM ('2027-12-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');


--
-- Name: audit_log_y2028m01; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2028m01 FOR VALUES FROM ('2028-01-01 00:00:00+00') TO ('2028-02-01 00:00:00+00');


--
-- Name: audit_log_y2028m02; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2028m02 FOR VALUES FROM ('2028-02-01 00:00:00+00') TO ('2028-03-01 00:00:00+00');


--
-- Name: audit_log_y2028m03; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2028m03 FOR VALUES FROM ('2028-03-01 00:00:00+00') TO ('2028-04-01 00:00:00+00');


--
-- Name: audit_log_y2028m04; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2028m04 FOR VALUES FROM ('2028-04-01 00:00:00+00') TO ('2028-05-01 00:00:00+00');


--
-- Name: audit_log_y2028m05; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2028m05 FOR VALUES FROM ('2028-05-01 00:00:00+00') TO ('2028-06-01 00:00:00+00');


--
-- Name: audit_log_y2028m06; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2028m06 FOR VALUES FROM ('2028-06-01 00:00:00+00') TO ('2028-07-01 00:00:00+00');


--
-- Name: audit_log_y2028m07; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2028m07 FOR VALUES FROM ('2028-07-01 00:00:00+00') TO ('2028-08-01 00:00:00+00');


--
-- Name: audit_log_y2028m08; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2028m08 FOR VALUES FROM ('2028-08-01 00:00:00+00') TO ('2028-09-01 00:00:00+00');


--
-- Name: audit_log_y2028m09; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2028m09 FOR VALUES FROM ('2028-09-01 00:00:00+00') TO ('2028-10-01 00:00:00+00');


--
-- Name: audit_log_y2028m10; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2028m10 FOR VALUES FROM ('2028-10-01 00:00:00+00') TO ('2028-11-01 00:00:00+00');


--
-- Name: audit_log_y2028m11; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2028m11 FOR VALUES FROM ('2028-11-01 00:00:00+00') TO ('2028-12-01 00:00:00+00');


--
-- Name: audit_log_y2028m12; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2028m12 FOR VALUES FROM ('2028-12-01 00:00:00+00') TO ('2029-01-01 00:00:00+00');


--
-- Name: audit_log_y2029m01; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2029m01 FOR VALUES FROM ('2029-01-01 00:00:00+00') TO ('2029-02-01 00:00:00+00');


--
-- Name: audit_log_y2029m02; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2029m02 FOR VALUES FROM ('2029-02-01 00:00:00+00') TO ('2029-03-01 00:00:00+00');


--
-- Name: audit_log_y2029m03; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2029m03 FOR VALUES FROM ('2029-03-01 00:00:00+00') TO ('2029-04-01 00:00:00+00');


--
-- Name: audit_log_y2029m04; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y2029m04 FOR VALUES FROM ('2029-04-01 00:00:00+00') TO ('2029-05-01 00:00:00+00');


--
-- Name: audit_log_y_default; Type: TABLE ATTACH; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ATTACH PARTITION public.audit_log_y_default DEFAULT;


--
-- Name: agreement_cleanup_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_cleanup_audit ALTER COLUMN id SET DEFAULT nextval('public.agreement_cleanup_audit_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: order_status_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history ALTER COLUMN id SET DEFAULT nextval('public.order_status_history_id_seq'::regclass);


--
-- Name: profile_cleanup_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_cleanup_audit ALTER COLUMN id SET DEFAULT nextval('public.profile_cleanup_audit_id_seq'::regclass);


--
-- Name: profile_scope_legacy_write_audit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_scope_legacy_write_audit ALTER COLUMN id SET DEFAULT nextval('public.profile_scope_legacy_write_audit_id_seq'::regclass);


--
-- Name: _migration_legacy_stub_invoice_lines_archive _migration_legacy_stub_invoice_lines_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migration_legacy_stub_invoice_lines_archive
    ADD CONSTRAINT _migration_legacy_stub_invoice_lines_archive_pkey PRIMARY KEY (id);


--
-- Name: _migration_legacy_stub_order_items_archive _migration_legacy_stub_order_items_arch_order_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migration_legacy_stub_order_items_archive
    ADD CONSTRAINT _migration_legacy_stub_order_items_arch_order_id_product_id_key UNIQUE (order_id, product_id);


--
-- Name: _migration_legacy_stub_order_items_archive _migration_legacy_stub_order_items_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migration_legacy_stub_order_items_archive
    ADD CONSTRAINT _migration_legacy_stub_order_items_archive_pkey PRIMARY KEY (id);


--
-- Name: _migration_legacy_stub_orders_archive _migration_legacy_stub_orders_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migration_legacy_stub_orders_archive
    ADD CONSTRAINT _migration_legacy_stub_orders_archive_pkey PRIMARY KEY (id);


--
-- Name: _migration_legacy_stub_orders_manifest _migration_legacy_stub_orders_manifest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migration_legacy_stub_orders_manifest
    ADD CONSTRAINT _migration_legacy_stub_orders_manifest_pkey PRIMARY KEY (batch_id, order_id);


--
-- Name: _migration_orders_location_id_backup _migration_orders_location_id_backup_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._migration_orders_location_id_backup
    ADD CONSTRAINT _migration_orders_location_id_backup_pkey PRIMARY KEY (order_id_text);


--
-- Name: agreement_cleanup_audit agreement_cleanup_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_cleanup_audit
    ADD CONSTRAINT agreement_cleanup_audit_pkey PRIMARY KEY (id);


--
-- Name: agreement_delivery_days agreement_delivery_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_delivery_days
    ADD CONSTRAINT agreement_delivery_days_pkey PRIMARY KEY (agreement_id, weekday);


--
-- Name: agreement_requests agreement_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_requests
    ADD CONSTRAINT agreement_requests_pkey PRIMARY KEY (id);


--
-- Name: agreements agreements_no_active_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreements
    ADD CONSTRAINT agreements_no_active_overlap EXCLUDE USING gist (location_id WITH =, daterange(starts_at, COALESCE((ends_at + 1), 'infinity'::date), '[)'::text) WITH &&) WHERE ((status = ANY (ARRAY['ACTIVE'::public.agreement_status, 'PAUSED'::public.agreement_status])));


--
-- Name: agreements agreements_no_open_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreements
    ADD CONSTRAINT agreements_no_open_overlap EXCLUDE USING gist (location_id WITH =, daterange(starts_at, COALESCE((ends_at + 1), 'infinity'::date), '[)'::text) WITH &&) WHERE ((status = ANY (ARRAY['PENDING'::public.agreement_status, 'ACTIVE'::public.agreement_status, 'PAUSED'::public.agreement_status])));


--
-- Name: agreements agreements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreements
    ADD CONSTRAINT agreements_pkey PRIMARY KEY (id);


--
-- Name: ai_action_memory ai_action_memory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_action_memory
    ADD CONSTRAINT ai_action_memory_pkey PRIMARY KEY (id);


--
-- Name: ai_activity_log ai_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_activity_log
    ADD CONSTRAINT ai_activity_log_pkey PRIMARY KEY (id);


--
-- Name: ai_config_audit ai_config_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_config_audit
    ADD CONSTRAINT ai_config_audit_pkey PRIMARY KEY (id);


--
-- Name: ai_config ai_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_config
    ADD CONSTRAINT ai_config_pkey PRIMARY KEY (id);


--
-- Name: ai_health_checks ai_health_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_health_checks
    ADD CONSTRAINT ai_health_checks_pkey PRIMARY KEY (id);


--
-- Name: ai_jobs ai_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_jobs
    ADD CONSTRAINT ai_jobs_pkey PRIMARY KEY (id);


--
-- Name: ai_suggestions ai_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_suggestions
    ADD CONSTRAINT ai_suggestions_pkey PRIMARY KEY (id);


--
-- Name: allergens allergens_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allergens
    ADD CONSTRAINT allergens_code_key UNIQUE (code);


--
-- Name: allergens allergens_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allergens
    ADD CONSTRAINT allergens_name_key UNIQUE (name);


--
-- Name: allergens allergens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allergens
    ADD CONSTRAINT allergens_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: audit_log_legacy audit_log_legacy_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_legacy
    ADD CONSTRAINT audit_log_legacy_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m05 audit_log_y2026m05_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m05
    ADD CONSTRAINT audit_log_y2026m05_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m06 audit_log_y2026m06_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m06
    ADD CONSTRAINT audit_log_y2026m06_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m07 audit_log_y2026m07_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m07
    ADD CONSTRAINT audit_log_y2026m07_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m08 audit_log_y2026m08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m08
    ADD CONSTRAINT audit_log_y2026m08_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m09 audit_log_y2026m09_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m09
    ADD CONSTRAINT audit_log_y2026m09_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m10 audit_log_y2026m10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m10
    ADD CONSTRAINT audit_log_y2026m10_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m11 audit_log_y2026m11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m11
    ADD CONSTRAINT audit_log_y2026m11_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2026m12 audit_log_y2026m12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2026m12
    ADD CONSTRAINT audit_log_y2026m12_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2027m01 audit_log_y2027m01_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2027m01
    ADD CONSTRAINT audit_log_y2027m01_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2027m02 audit_log_y2027m02_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2027m02
    ADD CONSTRAINT audit_log_y2027m02_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2027m03 audit_log_y2027m03_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2027m03
    ADD CONSTRAINT audit_log_y2027m03_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2027m04 audit_log_y2027m04_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2027m04
    ADD CONSTRAINT audit_log_y2027m04_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2027m05 audit_log_y2027m05_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2027m05
    ADD CONSTRAINT audit_log_y2027m05_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2027m06 audit_log_y2027m06_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2027m06
    ADD CONSTRAINT audit_log_y2027m06_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2027m07 audit_log_y2027m07_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2027m07
    ADD CONSTRAINT audit_log_y2027m07_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2027m08 audit_log_y2027m08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2027m08
    ADD CONSTRAINT audit_log_y2027m08_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2027m09 audit_log_y2027m09_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2027m09
    ADD CONSTRAINT audit_log_y2027m09_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2027m10 audit_log_y2027m10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2027m10
    ADD CONSTRAINT audit_log_y2027m10_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2027m11 audit_log_y2027m11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2027m11
    ADD CONSTRAINT audit_log_y2027m11_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2027m12 audit_log_y2027m12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2027m12
    ADD CONSTRAINT audit_log_y2027m12_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2028m01 audit_log_y2028m01_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2028m01
    ADD CONSTRAINT audit_log_y2028m01_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2028m02 audit_log_y2028m02_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2028m02
    ADD CONSTRAINT audit_log_y2028m02_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2028m03 audit_log_y2028m03_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2028m03
    ADD CONSTRAINT audit_log_y2028m03_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2028m04 audit_log_y2028m04_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2028m04
    ADD CONSTRAINT audit_log_y2028m04_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2028m05 audit_log_y2028m05_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2028m05
    ADD CONSTRAINT audit_log_y2028m05_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2028m06 audit_log_y2028m06_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2028m06
    ADD CONSTRAINT audit_log_y2028m06_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2028m07 audit_log_y2028m07_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2028m07
    ADD CONSTRAINT audit_log_y2028m07_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2028m08 audit_log_y2028m08_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2028m08
    ADD CONSTRAINT audit_log_y2028m08_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2028m09 audit_log_y2028m09_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2028m09
    ADD CONSTRAINT audit_log_y2028m09_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2028m10 audit_log_y2028m10_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2028m10
    ADD CONSTRAINT audit_log_y2028m10_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2028m11 audit_log_y2028m11_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2028m11
    ADD CONSTRAINT audit_log_y2028m11_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2028m12 audit_log_y2028m12_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2028m12
    ADD CONSTRAINT audit_log_y2028m12_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2029m01 audit_log_y2029m01_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2029m01
    ADD CONSTRAINT audit_log_y2029m01_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2029m02 audit_log_y2029m02_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2029m02
    ADD CONSTRAINT audit_log_y2029m02_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2029m03 audit_log_y2029m03_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2029m03
    ADD CONSTRAINT audit_log_y2029m03_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y2029m04 audit_log_y2029m04_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y2029m04
    ADD CONSTRAINT audit_log_y2029m04_pkey PRIMARY KEY (id, created_at);


--
-- Name: audit_log_y_default audit_log_y_default_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_y_default
    ADD CONSTRAINT audit_log_y_default_pkey PRIMARY KEY (id, created_at);


--
-- Name: billing_adjustments billing_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_adjustments
    ADD CONSTRAINT billing_adjustments_pkey PRIMARY KEY (id);


--
-- Name: closed_dates closed_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closed_dates
    ADD CONSTRAINT closed_dates_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_contracts company_contracts_company_id_valid_from_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_contracts
    ADD CONSTRAINT company_contracts_company_id_valid_from_key UNIQUE (company_id, valid_from);


--
-- Name: company_contracts company_contracts_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_contracts
    ADD CONSTRAINT company_contracts_no_overlap EXCLUDE USING gist (company_id WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[]'::text) WITH &&);


--
-- Name: company_contracts company_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_contracts
    ADD CONSTRAINT company_contracts_pkey PRIMARY KEY (id);


--
-- Name: company_deletions company_deletions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_deletions
    ADD CONSTRAINT company_deletions_pkey PRIMARY KEY (id);


--
-- Name: company_invites company_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_invites
    ADD CONSTRAINT company_invites_pkey PRIMARY KEY (id);


--
-- Name: company_invites company_invites_token_hash_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_invites
    ADD CONSTRAINT company_invites_token_hash_uniq UNIQUE (token_hash);


--
-- Name: company_locations company_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_locations
    ADD CONSTRAINT company_locations_pkey PRIMARY KEY (id);


--
-- Name: company_memberships company_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_memberships
    ADD CONSTRAINT company_memberships_pkey PRIMARY KEY (id);


--
-- Name: company_memberships company_memberships_user_company_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_memberships
    ADD CONSTRAINT company_memberships_user_company_unique UNIQUE (user_id, company_id);


--
-- Name: company_product_prices company_product_prices_company_id_product_id_valid_from_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_product_prices
    ADD CONSTRAINT company_product_prices_company_id_product_id_valid_from_key UNIQUE (company_id, product_id, valid_from);


--
-- Name: company_product_prices company_product_prices_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_product_prices
    ADD CONSTRAINT company_product_prices_no_overlap EXCLUDE USING gist (company_id WITH =, product_id WITH =, daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[]'::text) WITH &&);


--
-- Name: company_product_prices company_product_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_product_prices
    ADD CONSTRAINT company_product_prices_pkey PRIMARY KEY (id);


--
-- Name: company_registrations company_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_registrations
    ADD CONSTRAINT company_registrations_pkey PRIMARY KEY (id);


--
-- Name: content_page_variants content_page_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_page_variants
    ADD CONSTRAINT content_page_variants_pkey PRIMARY KEY (id);


--
-- Name: content_pages content_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_pages
    ADD CONSTRAINT content_pages_pkey PRIMARY KEY (id);


--
-- Name: content_pages content_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_pages
    ADD CONSTRAINT content_pages_slug_key UNIQUE (slug);


--
-- Name: day_choices day_choices_company_location_user_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_choices
    ADD CONSTRAINT day_choices_company_location_user_date_key UNIQUE (company_id, location_id, user_id, date);


--
-- Name: day_choices day_choices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_choices
    ADD CONSTRAINT day_choices_pkey PRIMARY KEY (id);


--
-- Name: deliveries deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_pkey PRIMARY KEY (id);


--
-- Name: delivery_run_items delivery_run_items_delivery_run_id_product_name_snapshot_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_run_items
    ADD CONSTRAINT delivery_run_items_delivery_run_id_product_name_snapshot_key UNIQUE (delivery_run_id, product_name_snapshot);


--
-- Name: delivery_run_items delivery_run_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_run_items
    ADD CONSTRAINT delivery_run_items_pkey PRIMARY KEY (id);


--
-- Name: delivery_runs delivery_runs_location_id_service_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_runs
    ADD CONSTRAINT delivery_runs_location_id_service_date_key UNIQUE (location_id, service_date);


--
-- Name: delivery_runs delivery_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_runs
    ADD CONSTRAINT delivery_runs_pkey PRIMARY KEY (id);


--
-- Name: dietary_tags dietary_tags_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dietary_tags
    ADD CONSTRAINT dietary_tags_code_key UNIQUE (code);


--
-- Name: dietary_tags dietary_tags_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dietary_tags
    ADD CONSTRAINT dietary_tags_name_key UNIQUE (name);


--
-- Name: dietary_tags dietary_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dietary_tags
    ADD CONSTRAINT dietary_tags_pkey PRIMARY KEY (id);


--
-- Name: driver_runs driver_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_runs
    ADD CONSTRAINT driver_runs_pkey PRIMARY KEY (id);


--
-- Name: employee_invites employee_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_invites
    ADD CONSTRAINT employee_invites_pkey PRIMARY KEY (id);


--
-- Name: enterprise_groups enterprise_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enterprise_groups
    ADD CONSTRAINT enterprise_groups_pkey PRIMARY KEY (id);


--
-- Name: esg_daily esg_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.esg_daily
    ADD CONSTRAINT esg_daily_pkey PRIMARY KEY (id);


--
-- Name: esg_monthly esg_monthly_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.esg_monthly
    ADD CONSTRAINT esg_monthly_pkey PRIMARY KEY (id);


--
-- Name: form_submissions form_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_pkey PRIMARY KEY (id);


--
-- Name: forms forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_pkey PRIMARY KEY (id);


--
-- Name: idempotency idempotency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.idempotency
    ADD CONSTRAINT idempotency_pkey PRIMARY KEY (id);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: invoice_lines invoice_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_pkey PRIMARY KEY (id);


--
-- Name: invoice_runs invoice_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_runs
    ADD CONSTRAINT invoice_runs_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_id_company_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_id_company_unique UNIQUE (id, company_id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_run_company_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_run_company_unique UNIQUE (run_id, company_id);


--
-- Name: kitchen_batches kitchen_batches_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_batches
    ADD CONSTRAINT kitchen_batches_key UNIQUE (delivery_date, delivery_window, company_location_id);


--
-- Name: kitchen_batches kitchen_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_batches
    ADD CONSTRAINT kitchen_batches_pkey PRIMARY KEY (id);


--
-- Name: lead_pipeline lead_pipeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_pipeline
    ADD CONSTRAINT lead_pipeline_pkey PRIMARY KEY (id);


--
-- Name: location_closed_dates location_closed_dates_location_id_closed_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_closed_dates
    ADD CONSTRAINT location_closed_dates_location_id_closed_date_key UNIQUE (location_id, closed_date);


--
-- Name: location_closed_dates location_closed_dates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_closed_dates
    ADD CONSTRAINT location_closed_dates_pkey PRIMARY KEY (id);


--
-- Name: location_memberships location_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_memberships
    ADD CONSTRAINT location_memberships_pkey PRIMARY KEY (id);


--
-- Name: location_memberships location_memberships_user_location_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_memberships
    ADD CONSTRAINT location_memberships_user_location_unique UNIQUE (user_id, location_id);


--
-- Name: location_policies location_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_policies
    ADD CONSTRAINT location_policies_pkey PRIMARY KEY (location_id);


--
-- Name: marketing_pages marketing_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_pages
    ADD CONSTRAINT marketing_pages_pkey PRIMARY KEY (id);


--
-- Name: marketing_pages marketing_pages_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketing_pages
    ADD CONSTRAINT marketing_pages_slug_key UNIQUE (slug);


--
-- Name: media_items media_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_items
    ADD CONSTRAINT media_items_pkey PRIMARY KEY (id);


--
-- Name: menu_service_day_items menu_service_day_items_menu_service_day_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_service_day_items
    ADD CONSTRAINT menu_service_day_items_menu_service_day_id_product_id_key UNIQUE (menu_service_day_id, product_id);


--
-- Name: menu_service_day_items menu_service_day_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_service_day_items
    ADD CONSTRAINT menu_service_day_items_pkey PRIMARY KEY (id);


--
-- Name: menu_service_days menu_service_days_location_id_service_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_service_days
    ADD CONSTRAINT menu_service_days_location_id_service_date_key UNIQUE (location_id, service_date);


--
-- Name: menu_service_days menu_service_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_service_days
    ADD CONSTRAINT menu_service_days_pkey PRIMARY KEY (id);


--
-- Name: menu_visibility_days menu_visibility_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_visibility_days
    ADD CONSTRAINT menu_visibility_days_pkey PRIMARY KEY (date);


--
-- Name: ops_events ops_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ops_events
    ADD CONSTRAINT ops_events_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_order_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_product_id_key UNIQUE (order_id, product_id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: outbox outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outbox
    ADD CONSTRAINT outbox_pkey PRIMARY KEY (id);


--
-- Name: platform_user_roles platform_user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_user_roles
    ADD CONSTRAINT platform_user_roles_pkey PRIMARY KEY (user_id, role);


--
-- Name: product_allergens product_allergens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_allergens
    ADD CONSTRAINT product_allergens_pkey PRIMARY KEY (product_id, allergen_id);


--
-- Name: product_categories product_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_name_key UNIQUE (name);


--
-- Name: product_categories product_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_categories
    ADD CONSTRAINT product_categories_pkey PRIMARY KEY (id);


--
-- Name: product_dietary_tags product_dietary_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_dietary_tags
    ADD CONSTRAINT product_dietary_tags_pkey PRIMARY KEY (product_id, dietary_tag_id);


--
-- Name: production_days production_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_days
    ADD CONSTRAINT production_days_pkey PRIMARY KEY (id);


--
-- Name: production_manifests production_manifests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_manifests
    ADD CONSTRAINT production_manifests_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: profile_cleanup_audit profile_cleanup_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_cleanup_audit
    ADD CONSTRAINT profile_cleanup_audit_pkey PRIMARY KEY (id);


--
-- Name: profile_scope_legacy_write_audit profile_scope_legacy_write_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_scope_legacy_write_audit
    ADD CONSTRAINT profile_scope_legacy_write_audit_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: repair_jobs repair_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.repair_jobs
    ADD CONSTRAINT repair_jobs_pkey PRIMARY KEY (id);


--
-- Name: social_posts social_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_pkey PRIMARY KEY (id);


--
-- Name: standing_orders standing_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standing_orders
    ADD CONSTRAINT standing_orders_pkey PRIMARY KEY (id);


--
-- Name: system_health_snapshots system_health_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_health_snapshots
    ADD CONSTRAINT system_health_snapshots_pkey PRIMARY KEY (id);


--
-- Name: system_incidents system_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_incidents
    ADD CONSTRAINT system_incidents_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: tripletex_customers tripletex_customers_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tripletex_customers
    ADD CONSTRAINT tripletex_customers_company_id_key UNIQUE (company_id);


--
-- Name: tripletex_customers tripletex_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tripletex_customers
    ADD CONSTRAINT tripletex_customers_pkey PRIMARY KEY (id);


--
-- Name: tripletex_invoices tripletex_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tripletex_invoices
    ADD CONSTRAINT tripletex_invoices_pkey PRIMARY KEY (id);


--
-- Name: _migration_legacy_stub_invoic_company_id_location_id_servic_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_invoic_company_id_location_id_servic_idx ON public._migration_legacy_stub_invoice_lines_archive USING btree (company_id, location_id, service_on);


--
-- Name: _migration_legacy_stub_invoice_lines_archive_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_invoice_lines_archive_company_id_idx ON public._migration_legacy_stub_invoice_lines_archive USING btree (company_id);


--
-- Name: _migration_legacy_stub_invoice_lines_archive_invoice_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_invoice_lines_archive_invoice_id_idx ON public._migration_legacy_stub_invoice_lines_archive USING btree (invoice_id);


--
-- Name: _migration_legacy_stub_invoice_lines_archive_invoice_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_invoice_lines_archive_invoice_run_id_idx ON public._migration_legacy_stub_invoice_lines_archive USING btree (invoice_run_id);


--
-- Name: _migration_legacy_stub_invoice_lines_archive_location_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_invoice_lines_archive_location_id_idx ON public._migration_legacy_stub_invoice_lines_archive USING btree (location_id);


--
-- Name: _migration_legacy_stub_invoice_lines_archive_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_invoice_lines_archive_order_id_idx ON public._migration_legacy_stub_invoice_lines_archive USING btree (order_id);


--
-- Name: _migration_legacy_stub_invoice_lines_archive_order_id_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX _migration_legacy_stub_invoice_lines_archive_order_id_idx1 ON public._migration_legacy_stub_invoice_lines_archive USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: _migration_legacy_stub_invoice_lines_archive_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_invoice_lines_archive_run_id_idx ON public._migration_legacy_stub_invoice_lines_archive USING btree (run_id);


--
-- Name: _migration_legacy_stub_invoice_lines_archive_service_on_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_invoice_lines_archive_service_on_idx ON public._migration_legacy_stub_invoice_lines_archive USING btree (service_on);


--
-- Name: _migration_legacy_stub_order_items_archive_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_order_items_archive_order_id_idx ON public._migration_legacy_stub_order_items_archive USING btree (order_id);


--
-- Name: _migration_legacy_stub_orders_archive_agreement_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_orders_archive_agreement_id_idx ON public._migration_legacy_stub_orders_archive USING btree (agreement_id);


--
-- Name: _migration_legacy_stub_orders_archive_company_id_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_orders_archive_company_id_date_idx ON public._migration_legacy_stub_orders_archive USING btree (company_id, date);


--
-- Name: _migration_legacy_stub_orders_archive_date_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_orders_archive_date_status_idx ON public._migration_legacy_stub_orders_archive USING btree (date, status);


--
-- Name: _migration_legacy_stub_orders_archive_location_id_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_orders_archive_location_id_date_idx ON public._migration_legacy_stub_orders_archive USING btree (location_id, date);


--
-- Name: _migration_legacy_stub_orders_archive_location_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_orders_archive_location_id_idx ON public._migration_legacy_stub_orders_archive USING btree (location_id);


--
-- Name: _migration_legacy_stub_orders_archive_tier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_orders_archive_tier_idx ON public._migration_legacy_stub_orders_archive USING btree (tier);


--
-- Name: _migration_legacy_stub_orders_archive_unit_price_nok_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_orders_archive_unit_price_nok_idx ON public._migration_legacy_stub_orders_archive USING btree (unit_price_nok);


--
-- Name: _migration_legacy_stub_orders_archive_user_id_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX _migration_legacy_stub_orders_archive_user_id_date_idx ON public._migration_legacy_stub_orders_archive USING btree (user_id, date) WHERE (status = 'ACTIVE'::public.order_status);


--
-- Name: _migration_legacy_stub_orders_archive_user_id_service_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_orders_archive_user_id_service_date_idx ON public._migration_legacy_stub_orders_archive USING btree (user_id, service_date DESC);


--
-- Name: _migration_legacy_stub_orders_location_id_service_date_stat_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX _migration_legacy_stub_orders_location_id_service_date_stat_idx ON public._migration_legacy_stub_orders_archive USING btree (location_id, service_date, status);


--
-- Name: agreement_delivery_days_agreement_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agreement_delivery_days_agreement_id_idx ON public.agreement_delivery_days USING btree (agreement_id);


--
-- Name: agreement_delivery_days_weekday_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agreement_delivery_days_weekday_idx ON public.agreement_delivery_days USING btree (weekday);


--
-- Name: agreement_requests_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agreement_requests_company_idx ON public.agreement_requests USING btree (company_id);


--
-- Name: agreements_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agreements_company_idx ON public.agreements USING btree (company_id);


--
-- Name: agreements_id_company_location_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX agreements_id_company_location_uq ON public.agreements USING btree (id, company_id, location_id);


--
-- Name: agreements_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agreements_location_idx ON public.agreements USING btree (location_id);


--
-- Name: agreements_one_active_per_company_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX agreements_one_active_per_company_uq ON public.agreements USING btree (company_id) WHERE (status = 'ACTIVE'::public.agreement_status);


--
-- Name: agreements_one_active_per_location_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX agreements_one_active_per_location_uq ON public.agreements USING btree (location_id) WHERE (status = 'ACTIVE'::public.agreement_status);


--
-- Name: agreements_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agreements_status_idx ON public.agreements USING btree (status);


--
-- Name: ai_config_singleton; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ai_config_singleton ON public.ai_config USING btree ((true));


--
-- Name: audit_events_company_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_events_company_created_idx ON public.audit_events USING btree (company_id, created_at DESC);


--
-- Name: audit_events_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_events_entity_idx ON public.audit_events USING btree (entity_type, entity_id);


--
-- Name: idx_audit_log_actor_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_actor_user_id ON ONLY public.audit_log USING btree (actor_user_id);


--
-- Name: audit_log_y2026m05_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m05_actor_user_id_idx ON public.audit_log_y2026m05 USING btree (actor_user_id);


--
-- Name: audit_log_y2026m06_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m06_actor_user_id_idx ON public.audit_log_y2026m06 USING btree (actor_user_id);


--
-- Name: audit_log_y2026m07_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m07_actor_user_id_idx ON public.audit_log_y2026m07 USING btree (actor_user_id);


--
-- Name: audit_log_y2026m08_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m08_actor_user_id_idx ON public.audit_log_y2026m08 USING btree (actor_user_id);


--
-- Name: audit_log_y2026m09_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m09_actor_user_id_idx ON public.audit_log_y2026m09 USING btree (actor_user_id);


--
-- Name: audit_log_y2026m10_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m10_actor_user_id_idx ON public.audit_log_y2026m10 USING btree (actor_user_id);


--
-- Name: audit_log_y2026m11_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m11_actor_user_id_idx ON public.audit_log_y2026m11 USING btree (actor_user_id);


--
-- Name: audit_log_y2026m12_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2026m12_actor_user_id_idx ON public.audit_log_y2026m12 USING btree (actor_user_id);


--
-- Name: audit_log_y2027m01_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2027m01_actor_user_id_idx ON public.audit_log_y2027m01 USING btree (actor_user_id);


--
-- Name: audit_log_y2027m02_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2027m02_actor_user_id_idx ON public.audit_log_y2027m02 USING btree (actor_user_id);


--
-- Name: audit_log_y2027m03_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2027m03_actor_user_id_idx ON public.audit_log_y2027m03 USING btree (actor_user_id);


--
-- Name: audit_log_y2027m04_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2027m04_actor_user_id_idx ON public.audit_log_y2027m04 USING btree (actor_user_id);


--
-- Name: audit_log_y2027m05_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2027m05_actor_user_id_idx ON public.audit_log_y2027m05 USING btree (actor_user_id);


--
-- Name: audit_log_y2027m06_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2027m06_actor_user_id_idx ON public.audit_log_y2027m06 USING btree (actor_user_id);


--
-- Name: audit_log_y2027m07_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2027m07_actor_user_id_idx ON public.audit_log_y2027m07 USING btree (actor_user_id);


--
-- Name: audit_log_y2027m08_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2027m08_actor_user_id_idx ON public.audit_log_y2027m08 USING btree (actor_user_id);


--
-- Name: audit_log_y2027m09_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2027m09_actor_user_id_idx ON public.audit_log_y2027m09 USING btree (actor_user_id);


--
-- Name: audit_log_y2027m10_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2027m10_actor_user_id_idx ON public.audit_log_y2027m10 USING btree (actor_user_id);


--
-- Name: audit_log_y2027m11_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2027m11_actor_user_id_idx ON public.audit_log_y2027m11 USING btree (actor_user_id);


--
-- Name: audit_log_y2027m12_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2027m12_actor_user_id_idx ON public.audit_log_y2027m12 USING btree (actor_user_id);


--
-- Name: audit_log_y2028m01_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2028m01_actor_user_id_idx ON public.audit_log_y2028m01 USING btree (actor_user_id);


--
-- Name: audit_log_y2028m02_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2028m02_actor_user_id_idx ON public.audit_log_y2028m02 USING btree (actor_user_id);


--
-- Name: audit_log_y2028m03_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2028m03_actor_user_id_idx ON public.audit_log_y2028m03 USING btree (actor_user_id);


--
-- Name: audit_log_y2028m04_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2028m04_actor_user_id_idx ON public.audit_log_y2028m04 USING btree (actor_user_id);


--
-- Name: audit_log_y2028m05_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2028m05_actor_user_id_idx ON public.audit_log_y2028m05 USING btree (actor_user_id);


--
-- Name: audit_log_y2028m06_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2028m06_actor_user_id_idx ON public.audit_log_y2028m06 USING btree (actor_user_id);


--
-- Name: audit_log_y2028m07_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2028m07_actor_user_id_idx ON public.audit_log_y2028m07 USING btree (actor_user_id);


--
-- Name: audit_log_y2028m08_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2028m08_actor_user_id_idx ON public.audit_log_y2028m08 USING btree (actor_user_id);


--
-- Name: audit_log_y2028m09_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2028m09_actor_user_id_idx ON public.audit_log_y2028m09 USING btree (actor_user_id);


--
-- Name: audit_log_y2028m10_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2028m10_actor_user_id_idx ON public.audit_log_y2028m10 USING btree (actor_user_id);


--
-- Name: audit_log_y2028m11_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2028m11_actor_user_id_idx ON public.audit_log_y2028m11 USING btree (actor_user_id);


--
-- Name: audit_log_y2028m12_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2028m12_actor_user_id_idx ON public.audit_log_y2028m12 USING btree (actor_user_id);


--
-- Name: audit_log_y2029m01_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2029m01_actor_user_id_idx ON public.audit_log_y2029m01 USING btree (actor_user_id);


--
-- Name: audit_log_y2029m02_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2029m02_actor_user_id_idx ON public.audit_log_y2029m02 USING btree (actor_user_id);


--
-- Name: audit_log_y2029m03_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2029m03_actor_user_id_idx ON public.audit_log_y2029m03 USING btree (actor_user_id);


--
-- Name: audit_log_y2029m04_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y2029m04_actor_user_id_idx ON public.audit_log_y2029m04 USING btree (actor_user_id);


--
-- Name: audit_log_y_default_actor_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_log_y_default_actor_user_id_idx ON public.audit_log_y_default USING btree (actor_user_id);


--
-- Name: billing_adjustments_company_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX billing_adjustments_company_date_idx ON public.billing_adjustments USING btree (company_id, effective_date);


--
-- Name: closed_dates_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX closed_dates_company_idx ON public.closed_dates USING btree (scope_company_id);


--
-- Name: closed_dates_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX closed_dates_location_idx ON public.closed_dates USING btree (scope_location_id);


--
-- Name: closed_dates_unique_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX closed_dates_unique_scope ON public.closed_dates USING btree (date, COALESCE(scope_company_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(scope_location_id, '00000000-0000-0000-0000-000000000000'::uuid));


--
-- Name: companies_default_location_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX companies_default_location_id_idx ON public.companies USING btree (default_location_id) WHERE (default_location_id IS NOT NULL);


--
-- Name: companies_enterprise_group_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX companies_enterprise_group_idx ON public.companies USING btree (enterprise_group_id);


--
-- Name: companies_orgnr_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX companies_orgnr_uq ON public.companies USING btree (orgnr) WHERE ((orgnr IS NOT NULL) AND (btrim(orgnr) <> ''::text));


--
-- Name: companies_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX companies_status_idx ON public.companies USING btree (status);


--
-- Name: company_deletions_company_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX company_deletions_company_id_uq ON public.company_deletions USING btree (company_id);


--
-- Name: company_deletions_deleted_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_deletions_deleted_at_idx ON public.company_deletions USING btree (deleted_at DESC);


--
-- Name: company_invites_active_company_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX company_invites_active_company_uniq ON public.company_invites USING btree (company_id) WHERE (revoked_at IS NULL);


--
-- Name: company_invites_code_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX company_invites_code_uniq ON public.company_invites USING btree (code);


--
-- Name: company_invites_company_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_invites_company_created_idx ON public.company_invites USING btree (company_id, created_at DESC);


--
-- Name: company_locations_company_id_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX company_locations_company_id_id_uq ON public.company_locations USING btree (company_id, id);


--
-- Name: company_locations_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_locations_company_idx ON public.company_locations USING btree (company_id);


--
-- Name: company_locations_company_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_locations_company_location_idx ON public.company_locations USING btree (company_id, id);


--
-- Name: company_locations_company_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX company_locations_company_name_uq ON public.company_locations USING btree (company_id, lower(btrim(name)));


--
-- Name: company_memberships_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_memberships_company_id_idx ON public.company_memberships USING btree (company_id);


--
-- Name: company_memberships_company_role_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_memberships_company_role_active_idx ON public.company_memberships USING btree (company_id, role, active);


--
-- Name: company_memberships_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_memberships_location_idx ON public.company_memberships USING btree (location_id, user_id, status);


--
-- Name: company_memberships_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_memberships_source_idx ON public.company_memberships USING btree (source);


--
-- Name: company_memberships_unique_role_scope_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX company_memberships_unique_role_scope_idx ON public.company_memberships USING btree (company_id, user_id, role, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid));


--
-- Name: company_memberships_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_memberships_user_id_idx ON public.company_memberships USING btree (user_id);


--
-- Name: company_memberships_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_memberships_user_idx ON public.company_memberships USING btree (user_id, company_id, status);


--
-- Name: company_product_prices_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_product_prices_lookup_idx ON public.company_product_prices USING btree (company_id, product_id, valid_from DESC);


--
-- Name: company_registrations_agreement_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_registrations_agreement_id_idx ON public.company_registrations USING btree (agreement_id);


--
-- Name: company_registrations_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_registrations_company_id_idx ON public.company_registrations USING btree (company_id);


--
-- Name: company_registrations_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_registrations_created_at_idx ON public.company_registrations USING btree (created_at DESC);


--
-- Name: company_registrations_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX company_registrations_status_idx ON public.company_registrations USING btree (status);


--
-- Name: content_page_variants_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX content_page_variants_unique ON public.content_page_variants USING btree (page_id, locale, environment);


--
-- Name: content_pages_tree_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_pages_tree_parent_idx ON public.content_pages USING btree (tree_parent_id);


--
-- Name: day_choices_company_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX day_choices_company_date_idx ON public.day_choices USING btree (company_id, date);


--
-- Name: day_choices_date_company_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX day_choices_date_company_user_idx ON public.day_choices USING btree (date, company_id, user_id);


--
-- Name: day_choices_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX day_choices_date_idx ON public.day_choices USING btree (date);


--
-- Name: day_choices_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX day_choices_user_date_idx ON public.day_choices USING btree (user_id, date);


--
-- Name: deliveries_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deliveries_company_idx ON public.deliveries USING btree (company_id);


--
-- Name: deliveries_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deliveries_date_idx ON public.deliveries USING btree (date);


--
-- Name: deliveries_driver_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deliveries_driver_idx ON public.deliveries USING btree (delivered_by);


--
-- Name: deliveries_location_date_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX deliveries_location_date_uq ON public.deliveries USING btree (location_id, date);


--
-- Name: deliveries_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deliveries_location_idx ON public.deliveries USING btree (location_id);


--
-- Name: deliveries_run_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deliveries_run_idx ON public.deliveries USING btree (run_id);


--
-- Name: deliveries_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deliveries_status_idx ON public.deliveries USING btree (status);


--
-- Name: delivery_runs_location_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_runs_location_date_idx ON public.delivery_runs USING btree (location_id, service_date);


--
-- Name: driver_runs_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX driver_runs_date_idx ON public.driver_runs USING btree (date);


--
-- Name: driver_runs_driver_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX driver_runs_driver_idx ON public.driver_runs USING btree (driver_user_id);


--
-- Name: driver_runs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX driver_runs_status_idx ON public.driver_runs USING btree (status);


--
-- Name: employee_invites_active_company_email_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_invites_active_company_email_uniq ON public.employee_invites USING btree (company_id, lower(email)) WHERE (used_at IS NULL);


--
-- Name: employee_invites_company_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_invites_company_expires_idx ON public.employee_invites USING btree (company_id, expires_at);


--
-- Name: employee_invites_company_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employee_invites_company_location_idx ON public.employee_invites USING btree (company_id, location_id);


--
-- Name: employee_invites_token_hash_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_invites_token_hash_uniq ON public.employee_invites USING btree (token_hash);


--
-- Name: enterprise_groups_orgnr_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX enterprise_groups_orgnr_uq ON public.enterprise_groups USING btree (orgnr) WHERE ((orgnr IS NOT NULL) AND (btrim(orgnr) <> ''::text));


--
-- Name: esg_daily_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX esg_daily_company_idx ON public.esg_daily USING btree (company_id);


--
-- Name: esg_daily_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX esg_daily_location_idx ON public.esg_daily USING btree (location_id);


--
-- Name: esg_daily_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX esg_daily_unique ON public.esg_daily USING btree (date, location_id);


--
-- Name: esg_monthly_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX esg_monthly_company_idx ON public.esg_monthly USING btree (company_id);


--
-- Name: esg_monthly_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX esg_monthly_unique ON public.esg_monthly USING btree (month_start, company_id);


--
-- Name: form_submissions_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_submissions_created_by_idx ON public.form_submissions USING btree (created_by);


--
-- Name: form_submissions_form_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_submissions_form_id_idx ON public.form_submissions USING btree (form_id, created_at DESC);


--
-- Name: forms_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forms_created_at_idx ON public.forms USING btree (created_at DESC);


--
-- Name: forms_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forms_created_by_idx ON public.forms USING btree (created_by);


--
-- Name: forms_env_locale_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forms_env_locale_idx ON public.forms USING btree (environment, locale);


--
-- Name: idempotency_expires_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idempotency_expires_idx ON public.idempotency USING btree (expires_at);


--
-- Name: idempotency_scope_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idempotency_scope_key_uq ON public.idempotency USING btree (scope, key);


--
-- Name: idx_agreement_delivery_days_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agreement_delivery_days_tier ON public.agreement_delivery_days USING btree (agreement_id, tier);


--
-- Name: idx_agreements_reviewed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agreements_reviewed_by ON public.agreements USING btree (reviewed_by);


--
-- Name: idx_ai_activity_log_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_activity_log_action ON public.ai_activity_log USING btree (action);


--
-- Name: idx_ai_activity_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_activity_log_created_at ON public.ai_activity_log USING btree (created_at DESC);


--
-- Name: idx_ai_activity_log_page_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_activity_log_page_id ON public.ai_activity_log USING btree (page_id);


--
-- Name: idx_ai_activity_log_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_activity_log_variant_id ON public.ai_activity_log USING btree (variant_id);


--
-- Name: idx_ai_health_checks_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_health_checks_created_at ON public.ai_health_checks USING btree (created_at DESC);


--
-- Name: idx_ai_health_checks_page_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_health_checks_page_id ON public.ai_health_checks USING btree (page_id);


--
-- Name: idx_ai_health_checks_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_health_checks_variant_id ON public.ai_health_checks USING btree (variant_id);


--
-- Name: idx_ai_jobs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_jobs_created_at ON public.ai_jobs USING btree (created_at DESC);


--
-- Name: idx_ai_jobs_run_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_jobs_run_at ON public.ai_jobs USING btree (run_at);


--
-- Name: idx_ai_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_jobs_status ON public.ai_jobs USING btree (status);


--
-- Name: idx_ai_suggestions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_suggestions_created_at ON public.ai_suggestions USING btree (created_at DESC);


--
-- Name: idx_ai_suggestions_environment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_suggestions_environment ON public.ai_suggestions USING btree (environment);


--
-- Name: idx_ai_suggestions_page_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_suggestions_page_id ON public.ai_suggestions USING btree (page_id);


--
-- Name: idx_ai_suggestions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_suggestions_status ON public.ai_suggestions USING btree (status);


--
-- Name: idx_ai_suggestions_tool; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_suggestions_tool ON public.ai_suggestions USING btree (tool);


--
-- Name: idx_ai_suggestions_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ai_suggestions_variant_id ON public.ai_suggestions USING btree (variant_id);


--
-- Name: idx_audit_log_legacy_actor_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_legacy_actor_user_id ON public.audit_log_legacy USING btree (actor_user_id);


--
-- Name: idx_billing_adjustments_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_adjustments_created_by ON public.billing_adjustments USING btree (created_by);


--
-- Name: idx_billing_adjustments_invoice_run_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_adjustments_invoice_run_id ON public.billing_adjustments USING btree (invoice_run_id);


--
-- Name: idx_billing_adjustments_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_billing_adjustments_location_id ON public.billing_adjustments USING btree (location_id);


--
-- Name: idx_companies_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_companies_created_by ON public.companies USING btree (created_by);


--
-- Name: idx_company_invites_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_invites_created_by ON public.company_invites USING btree (created_by);


--
-- Name: idx_company_memberships_granted_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_memberships_granted_by ON public.company_memberships USING btree (granted_by);


--
-- Name: idx_company_registrations_reviewed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_company_registrations_reviewed_by ON public.company_registrations USING btree (reviewed_by);


--
-- Name: idx_delivery_run_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_run_items_product_id ON public.delivery_run_items USING btree (product_id);


--
-- Name: idx_delivery_runs_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_runs_company_id ON public.delivery_runs USING btree (company_id);


--
-- Name: idx_delivery_runs_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_delivery_runs_created_by ON public.delivery_runs USING btree (created_by);


--
-- Name: idx_employee_invites_created_by_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_invites_created_by_user_id ON public.employee_invites USING btree (created_by_user_id);


--
-- Name: idx_invoice_lines_billing_adjustment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_lines_billing_adjustment_id ON public.invoice_lines USING btree (billing_adjustment_id);


--
-- Name: idx_invoice_lines_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_lines_user_id ON public.invoice_lines USING btree (user_id);


--
-- Name: idx_invoice_runs_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoice_runs_created_by ON public.invoice_runs USING btree (created_by);


--
-- Name: idx_marketing_pages_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_pages_is_published ON public.marketing_pages USING btree (((published IS NOT NULL)));


--
-- Name: idx_marketing_pages_published_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_pages_published_at ON public.marketing_pages USING btree (published_at DESC);


--
-- Name: idx_marketing_pages_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_marketing_pages_updated_at ON public.marketing_pages USING btree (updated_at DESC);


--
-- Name: idx_menu_service_days_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_service_days_company_id ON public.menu_service_days USING btree (company_id);


--
-- Name: idx_menu_service_days_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_service_days_created_by ON public.menu_service_days USING btree (created_by);


--
-- Name: idx_menu_visibility_days_updated_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_visibility_days_updated_by ON public.menu_visibility_days USING btree (updated_by);


--
-- Name: idx_order_items_menu_service_day_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_menu_service_day_item_id ON public.order_items USING btree (menu_service_day_item_id);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_status_history_changed_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_status_history_changed_by ON public.order_status_history USING btree (changed_by);


--
-- Name: idx_orders_company_service_date_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_company_service_date_active ON public.orders USING btree (company_id, service_date) WHERE (status = 'ACTIVE'::public.order_status);


--
-- Name: idx_orders_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_created_by ON public.orders USING btree (created_by);


--
-- Name: idx_orders_menu_service_day_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_menu_service_day_id ON public.orders USING btree (menu_service_day_id);


--
-- Name: idx_pipeline_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_company ON public.lead_pipeline USING btree (company_id);


--
-- Name: idx_pipeline_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_stage ON public.lead_pipeline USING btree (stage);


--
-- Name: idx_platform_user_roles_granted_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_user_roles_granted_by ON public.platform_user_roles USING btree (granted_by);


--
-- Name: idx_products_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);


--
-- Name: idx_social_posts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_social_posts_status ON public.social_posts USING btree (status);


--
-- Name: idx_standing_orders_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_standing_orders_company_id ON public.standing_orders USING btree (company_id);


--
-- Name: invoice_lines_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_lines_company_idx ON public.invoice_lines USING btree (company_id);


--
-- Name: invoice_lines_company_location_service_on_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_lines_company_location_service_on_idx ON public.invoice_lines USING btree (company_id, location_id, service_on);


--
-- Name: invoice_lines_invoice_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_lines_invoice_id_idx ON public.invoice_lines USING btree (invoice_id);


--
-- Name: invoice_lines_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_lines_invoice_idx ON public.invoice_lines USING btree (invoice_run_id);


--
-- Name: invoice_lines_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_lines_location_idx ON public.invoice_lines USING btree (location_id);


--
-- Name: invoice_lines_order_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_lines_order_id_idx ON public.invoice_lines USING btree (order_id);


--
-- Name: invoice_lines_order_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoice_lines_order_id_uq ON public.invoice_lines USING btree (order_id) WHERE (order_id IS NOT NULL);


--
-- Name: invoice_lines_run_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_lines_run_idx ON public.invoice_lines USING btree (run_id);


--
-- Name: invoice_lines_service_on_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_lines_service_on_idx ON public.invoice_lines USING btree (service_on);


--
-- Name: invoice_runs_company_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_runs_company_period_idx ON public.invoice_runs USING btree (company_id, period_start, period_end);


--
-- Name: invoice_runs_period_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoice_runs_period_uq ON public.invoice_runs USING btree (period_start, period_end);


--
-- Name: invoice_runs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_runs_status_idx ON public.invoice_runs USING btree (status);


--
-- Name: invoices_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_company_id_idx ON public.invoices USING btree (company_id);


--
-- Name: invoices_external_invoice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoices_external_invoice_id_uq ON public.invoices USING btree (external_invoice_id) WHERE (external_invoice_id IS NOT NULL);


--
-- Name: invoices_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_run_id_idx ON public.invoices USING btree (run_id);


--
-- Name: invoices_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_status_idx ON public.invoices USING btree (status);


--
-- Name: ix_agreements_company_id_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_agreements_company_id_location_id ON public.agreements USING btree (company_id, location_id);


--
-- Name: ix_ai_action_memory_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ai_action_memory_action_type ON public.ai_action_memory USING btree (action_type);


--
-- Name: ix_ai_action_memory_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ai_action_memory_expires_at ON public.ai_action_memory USING btree (expires_at);


--
-- Name: ix_ai_action_memory_surface; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ai_action_memory_surface ON public.ai_action_memory USING btree (surface);


--
-- Name: ix_day_choices_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_day_choices_location_id ON public.day_choices USING btree (location_id);


--
-- Name: ix_deliveries_company_id_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_deliveries_company_id_location_id ON public.deliveries USING btree (company_id, location_id);


--
-- Name: ix_location_memberships_company_id_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_location_memberships_company_id_location_id ON public.location_memberships USING btree (company_id, location_id);


--
-- Name: ix_location_memberships_user_id_company_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_location_memberships_user_id_company_id ON public.location_memberships USING btree (user_id, company_id);


--
-- Name: ix_order_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_order_items_product_id ON public.order_items USING btree (product_id);


--
-- Name: ix_orders_agreement_id_company_id_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_agreement_id_company_id_location_id ON public.orders USING btree (agreement_id, company_id, location_id);


--
-- Name: ix_orders_company_id_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_orders_company_id_location_id ON public.orders USING btree (company_id, location_id);


--
-- Name: ix_profiles_company_id_location_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_profiles_company_id_location_id ON public.profiles USING btree (company_id, location_id);


--
-- Name: kitchen_batches_delivery_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kitchen_batches_delivery_date_idx ON public.kitchen_batches USING btree (delivery_date);


--
-- Name: kitchen_batches_location_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX kitchen_batches_location_date_idx ON public.kitchen_batches USING btree (company_location_id, delivery_date);


--
-- Name: location_closed_dates_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX location_closed_dates_lookup_idx ON public.location_closed_dates USING btree (location_id, closed_date);


--
-- Name: location_memberships_company_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX location_memberships_company_id_idx ON public.location_memberships USING btree (company_id);


--
-- Name: location_memberships_location_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX location_memberships_location_id_idx ON public.location_memberships USING btree (location_id);


--
-- Name: location_memberships_location_role_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX location_memberships_location_role_active_idx ON public.location_memberships USING btree (location_id, role, active);


--
-- Name: location_memberships_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX location_memberships_source_idx ON public.location_memberships USING btree (source);


--
-- Name: location_memberships_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX location_memberships_user_id_idx ON public.location_memberships USING btree (user_id);


--
-- Name: media_items_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_items_created_at_idx ON public.media_items USING btree (created_at DESC);


--
-- Name: media_items_created_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_items_created_by_idx ON public.media_items USING btree (created_by);


--
-- Name: media_items_source_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX media_items_source_status_idx ON public.media_items USING btree (source, status, created_at DESC);


--
-- Name: menu_service_day_items_menu_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX menu_service_day_items_menu_idx ON public.menu_service_day_items USING btree (menu_service_day_id);


--
-- Name: menu_service_days_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX menu_service_days_lookup_idx ON public.menu_service_days USING btree (location_id, service_date, state);


--
-- Name: menu_visibility_days_is_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX menu_visibility_days_is_published_idx ON public.menu_visibility_days USING btree (is_published);


--
-- Name: menu_visibility_days_updated_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX menu_visibility_days_updated_at_idx ON public.menu_visibility_days USING btree (updated_at DESC);


--
-- Name: ops_events_scope_company_ts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ops_events_scope_company_ts_idx ON public.ops_events USING btree (scope_company_id, ts DESC);


--
-- Name: ops_events_ts_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ops_events_ts_idx ON public.ops_events USING btree (ts DESC);


--
-- Name: order_items_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_items_order_idx ON public.order_items USING btree (order_id);


--
-- Name: order_status_history_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_status_history_order_idx ON public.order_status_history USING btree (order_id, changed_at DESC);


--
-- Name: orders_agreement_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_agreement_id_idx ON public.orders USING btree (agreement_id);


--
-- Name: orders_company_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_company_date_idx ON public.orders USING btree (company_id, date);


--
-- Name: orders_date_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_date_status_idx ON public.orders USING btree (date, status);


--
-- Name: orders_location_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_location_date_idx ON public.orders USING btree (location_id, date);


--
-- Name: orders_location_date_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_location_date_status_idx ON public.orders USING btree (location_id, service_date, status);


--
-- Name: orders_location_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_location_id_idx ON public.orders USING btree (location_id);


--
-- Name: orders_one_active_per_user_per_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX orders_one_active_per_user_per_day_idx ON public.orders USING btree (user_id, date) WHERE (status = 'ACTIVE'::public.order_status);


--
-- Name: orders_tier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_tier_idx ON public.orders USING btree (tier);


--
-- Name: orders_unit_price_nok_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_unit_price_nok_idx ON public.orders USING btree (unit_price_nok);


--
-- Name: orders_user_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_user_date_idx ON public.orders USING btree (user_id, service_date DESC);


--
-- Name: outbox_claim_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX outbox_claim_idx ON public.outbox USING btree (status, next_retry_at, created_at);


--
-- Name: outbox_event_key_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX outbox_event_key_uq ON public.outbox USING btree (event_key);


--
-- Name: outbox_processing_locked_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX outbox_processing_locked_idx ON public.outbox USING btree (status, locked_at);


--
-- Name: outbox_status_next_retry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX outbox_status_next_retry_idx ON public.outbox USING btree (status, next_retry_at);


--
-- Name: production_days_date_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX production_days_date_uq ON public.production_days USING btree (date);


--
-- Name: production_days_frozen_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX production_days_frozen_by_idx ON public.production_days USING btree (frozen_by);


--
-- Name: production_days_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX production_days_status_idx ON public.production_days USING btree (status);


--
-- Name: production_manifests_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX production_manifests_company_idx ON public.production_manifests USING btree (company_id);


--
-- Name: production_manifests_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX production_manifests_date_idx ON public.production_manifests USING btree (date);


--
-- Name: production_manifests_location_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX production_manifests_location_date_idx ON public.production_manifests USING btree (location_id, date);


--
-- Name: production_manifests_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX production_manifests_location_idx ON public.production_manifests USING btree (location_id);


--
-- Name: products_company_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_company_active_idx ON public.products USING btree (company_id, is_active, is_visible);


--
-- Name: products_company_sku_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX products_company_sku_idx ON public.products USING btree (COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid), sku) WHERE (sku IS NOT NULL);


--
-- Name: profile_cleanup_audit_cleanup_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_cleanup_audit_cleanup_at_idx ON public.profile_cleanup_audit USING btree (cleanup_at DESC);


--
-- Name: profile_cleanup_audit_profile_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_cleanup_audit_profile_id_idx ON public.profile_cleanup_audit USING btree (profile_id);


--
-- Name: profile_scope_legacy_write_audit_audited_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_scope_legacy_write_audit_audited_at_idx ON public.profile_scope_legacy_write_audit USING btree (audited_at DESC);


--
-- Name: profile_scope_legacy_write_audit_profile_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profile_scope_legacy_write_audit_profile_id_idx ON public.profile_scope_legacy_write_audit USING btree (profile_id);


--
-- Name: profiles_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_company_idx ON public.profiles USING btree (company_id);


--
-- Name: profiles_location_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_location_idx ON public.profiles USING btree (location_id);


--
-- Name: profiles_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX profiles_role_idx ON public.profiles USING btree (role);


--
-- Name: repair_jobs_state_next_run_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX repair_jobs_state_next_run_idx ON public.repair_jobs USING btree (state, next_run_at);


--
-- Name: standing_orders_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX standing_orders_lookup_idx ON public.standing_orders USING btree (location_id, user_id, weekday, active_from);


--
-- Name: standing_orders_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX standing_orders_unique_idx ON public.standing_orders USING btree (user_id, location_id, weekday, product_id, active_from);


--
-- Name: tripletex_customers_external_customer_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tripletex_customers_external_customer_id_uq ON public.tripletex_customers USING btree (external_customer_id);


--
-- Name: tripletex_invoices_company_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tripletex_invoices_company_idx ON public.tripletex_invoices USING btree (company_id);


--
-- Name: tripletex_invoices_external_invoice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tripletex_invoices_external_invoice_id_uq ON public.tripletex_invoices USING btree (external_invoice_id) WHERE (external_invoice_id IS NOT NULL);


--
-- Name: tripletex_invoices_invoice_id_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tripletex_invoices_invoice_id_uq ON public.tripletex_invoices USING btree (invoice_id) WHERE (invoice_id IS NOT NULL);


--
-- Name: tripletex_invoices_run_company_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tripletex_invoices_run_company_uq ON public.tripletex_invoices USING btree (run_id, company_id);


--
-- Name: tripletex_invoices_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tripletex_invoices_status_idx ON public.tripletex_invoices USING btree (status);


--
-- Name: ux_ai_action_memory_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_ai_action_memory_key ON public.ai_action_memory USING btree (action_key);


--
-- Name: audit_log_y2026m05_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2026m05_actor_user_id_idx;


--
-- Name: audit_log_y2026m05_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2026m05_pkey;


--
-- Name: audit_log_y2026m06_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2026m06_actor_user_id_idx;


--
-- Name: audit_log_y2026m06_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2026m06_pkey;


--
-- Name: audit_log_y2026m07_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2026m07_actor_user_id_idx;


--
-- Name: audit_log_y2026m07_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2026m07_pkey;


--
-- Name: audit_log_y2026m08_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2026m08_actor_user_id_idx;


--
-- Name: audit_log_y2026m08_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2026m08_pkey;


--
-- Name: audit_log_y2026m09_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2026m09_actor_user_id_idx;


--
-- Name: audit_log_y2026m09_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2026m09_pkey;


--
-- Name: audit_log_y2026m10_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2026m10_actor_user_id_idx;


--
-- Name: audit_log_y2026m10_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2026m10_pkey;


--
-- Name: audit_log_y2026m11_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2026m11_actor_user_id_idx;


--
-- Name: audit_log_y2026m11_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2026m11_pkey;


--
-- Name: audit_log_y2026m12_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2026m12_actor_user_id_idx;


--
-- Name: audit_log_y2026m12_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2026m12_pkey;


--
-- Name: audit_log_y2027m01_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2027m01_actor_user_id_idx;


--
-- Name: audit_log_y2027m01_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2027m01_pkey;


--
-- Name: audit_log_y2027m02_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2027m02_actor_user_id_idx;


--
-- Name: audit_log_y2027m02_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2027m02_pkey;


--
-- Name: audit_log_y2027m03_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2027m03_actor_user_id_idx;


--
-- Name: audit_log_y2027m03_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2027m03_pkey;


--
-- Name: audit_log_y2027m04_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2027m04_actor_user_id_idx;


--
-- Name: audit_log_y2027m04_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2027m04_pkey;


--
-- Name: audit_log_y2027m05_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2027m05_actor_user_id_idx;


--
-- Name: audit_log_y2027m05_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2027m05_pkey;


--
-- Name: audit_log_y2027m06_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2027m06_actor_user_id_idx;


--
-- Name: audit_log_y2027m06_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2027m06_pkey;


--
-- Name: audit_log_y2027m07_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2027m07_actor_user_id_idx;


--
-- Name: audit_log_y2027m07_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2027m07_pkey;


--
-- Name: audit_log_y2027m08_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2027m08_actor_user_id_idx;


--
-- Name: audit_log_y2027m08_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2027m08_pkey;


--
-- Name: audit_log_y2027m09_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2027m09_actor_user_id_idx;


--
-- Name: audit_log_y2027m09_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2027m09_pkey;


--
-- Name: audit_log_y2027m10_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2027m10_actor_user_id_idx;


--
-- Name: audit_log_y2027m10_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2027m10_pkey;


--
-- Name: audit_log_y2027m11_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2027m11_actor_user_id_idx;


--
-- Name: audit_log_y2027m11_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2027m11_pkey;


--
-- Name: audit_log_y2027m12_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2027m12_actor_user_id_idx;


--
-- Name: audit_log_y2027m12_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2027m12_pkey;


--
-- Name: audit_log_y2028m01_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2028m01_actor_user_id_idx;


--
-- Name: audit_log_y2028m01_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2028m01_pkey;


--
-- Name: audit_log_y2028m02_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2028m02_actor_user_id_idx;


--
-- Name: audit_log_y2028m02_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2028m02_pkey;


--
-- Name: audit_log_y2028m03_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2028m03_actor_user_id_idx;


--
-- Name: audit_log_y2028m03_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2028m03_pkey;


--
-- Name: audit_log_y2028m04_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2028m04_actor_user_id_idx;


--
-- Name: audit_log_y2028m04_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2028m04_pkey;


--
-- Name: audit_log_y2028m05_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2028m05_actor_user_id_idx;


--
-- Name: audit_log_y2028m05_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2028m05_pkey;


--
-- Name: audit_log_y2028m06_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2028m06_actor_user_id_idx;


--
-- Name: audit_log_y2028m06_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2028m06_pkey;


--
-- Name: audit_log_y2028m07_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2028m07_actor_user_id_idx;


--
-- Name: audit_log_y2028m07_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2028m07_pkey;


--
-- Name: audit_log_y2028m08_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2028m08_actor_user_id_idx;


--
-- Name: audit_log_y2028m08_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2028m08_pkey;


--
-- Name: audit_log_y2028m09_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2028m09_actor_user_id_idx;


--
-- Name: audit_log_y2028m09_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2028m09_pkey;


--
-- Name: audit_log_y2028m10_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2028m10_actor_user_id_idx;


--
-- Name: audit_log_y2028m10_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2028m10_pkey;


--
-- Name: audit_log_y2028m11_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2028m11_actor_user_id_idx;


--
-- Name: audit_log_y2028m11_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2028m11_pkey;


--
-- Name: audit_log_y2028m12_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2028m12_actor_user_id_idx;


--
-- Name: audit_log_y2028m12_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2028m12_pkey;


--
-- Name: audit_log_y2029m01_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2029m01_actor_user_id_idx;


--
-- Name: audit_log_y2029m01_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2029m01_pkey;


--
-- Name: audit_log_y2029m02_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2029m02_actor_user_id_idx;


--
-- Name: audit_log_y2029m02_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2029m02_pkey;


--
-- Name: audit_log_y2029m03_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2029m03_actor_user_id_idx;


--
-- Name: audit_log_y2029m03_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2029m03_pkey;


--
-- Name: audit_log_y2029m04_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y2029m04_actor_user_id_idx;


--
-- Name: audit_log_y2029m04_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y2029m04_pkey;


--
-- Name: audit_log_y_default_actor_user_id_idx; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.idx_audit_log_actor_user_id ATTACH PARTITION public.audit_log_y_default_actor_user_id_idx;


--
-- Name: audit_log_y_default_pkey; Type: INDEX ATTACH; Schema: public; Owner: -
--

ALTER INDEX public.audit_log_pkey ATTACH PARTITION public.audit_log_y_default_pkey;


--
-- Name: deliveries a0_deliveries_validate_v2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a0_deliveries_validate_v2 BEFORE INSERT OR UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.tg_validate_delivery_v2();


--
-- Name: driver_runs a0_driver_runs_validate_assignment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a0_driver_runs_validate_assignment BEFORE INSERT OR UPDATE ON public.driver_runs FOR EACH ROW EXECUTE FUNCTION public.tg_validate_driver_run_assignment_v2();


--
-- Name: invoice_lines a0_invoice_lines_hydrate_v2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a0_invoice_lines_hydrate_v2 BEFORE INSERT OR UPDATE ON public.invoice_lines FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_lines_hydrate_v2();


--
-- Name: invoices a0_invoices_normalize_v2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a0_invoices_normalize_v2 BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_invoice_v2();


--
-- Name: orders a0_orders_hydrate_core_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a0_orders_hydrate_core_fields BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_orders_hydrate_core_fields();


--
-- Name: production_days a0_production_days_normalize_v2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a0_production_days_normalize_v2 BEFORE INSERT OR UPDATE ON public.production_days FOR EACH ROW EXECUTE FUNCTION public.tg_normalize_production_day_v2();


--
-- Name: tripletex_invoices a0_tripletex_invoices_hydrate_v2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a0_tripletex_invoices_hydrate_v2 BEFORE INSERT OR UPDATE ON public.tripletex_invoices FOR EACH ROW EXECUTE FUNCTION public.tg_tripletex_invoices_hydrate_v2();


--
-- Name: invoice_lines a9_invoice_lines_recalculate_invoice_v2; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER a9_invoice_lines_recalculate_invoice_v2 AFTER INSERT OR DELETE OR UPDATE ON public.invoice_lines FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_lines_recalculate_invoice_v2();


--
-- Name: agreements agreements_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agreements_set_updated_at BEFORE UPDATE ON public.agreements FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: billing_adjustments audit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_row AFTER INSERT OR DELETE OR UPDATE ON public.billing_adjustments FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();


--
-- Name: companies audit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_row AFTER INSERT OR DELETE OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();


--
-- Name: company_contracts audit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_row AFTER INSERT OR DELETE OR UPDATE ON public.company_contracts FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();


--
-- Name: company_memberships audit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_row AFTER INSERT OR DELETE OR UPDATE ON public.company_memberships FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();


--
-- Name: company_product_prices audit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_row AFTER INSERT OR DELETE OR UPDATE ON public.company_product_prices FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();


--
-- Name: delivery_runs audit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_row AFTER INSERT OR DELETE OR UPDATE ON public.delivery_runs FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();


--
-- Name: invoice_lines audit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_row AFTER INSERT OR DELETE OR UPDATE ON public.invoice_lines FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();


--
-- Name: invoice_runs audit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_row AFTER INSERT OR DELETE OR UPDATE ON public.invoice_runs FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();


--
-- Name: location_policies audit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_row AFTER INSERT OR DELETE OR UPDATE ON public.location_policies FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();


--
-- Name: menu_service_day_items audit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_row AFTER INSERT OR DELETE OR UPDATE ON public.menu_service_day_items FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();


--
-- Name: menu_service_days audit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_row AFTER INSERT OR DELETE OR UPDATE ON public.menu_service_days FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();


--
-- Name: order_items audit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_row AFTER INSERT OR DELETE OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();


--
-- Name: orders audit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_row AFTER INSERT OR DELETE OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();


--
-- Name: products audit_row; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_row AFTER INSERT OR DELETE OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();


--
-- Name: companies companies_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER companies_set_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: company_invites company_invites_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER company_invites_set_updated_at BEFORE UPDATE ON public.company_invites FOR EACH ROW EXECUTE FUNCTION public.lp_touch_invites_updated_at();


--
-- Name: company_locations company_locations_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER company_locations_set_updated_at BEFORE UPDATE ON public.company_locations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: day_choices day_choices_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER day_choices_set_updated_at BEFORE UPDATE ON public.day_choices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: deliveries deliveries_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER deliveries_set_updated_at BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: driver_runs driver_runs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER driver_runs_set_updated_at BEFORE UPDATE ON public.driver_runs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: employee_invites employee_invites_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER employee_invites_set_updated_at BEFORE UPDATE ON public.employee_invites FOR EACH ROW EXECUTE FUNCTION public.lp_touch_invites_updated_at();


--
-- Name: forms forms_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER forms_set_updated_at BEFORE UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: orders guard_order_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_order_mutation BEFORE DELETE OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_guard_order_mutation();


--
-- Name: idempotency idempotency_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER idempotency_set_updated_at BEFORE UPDATE ON public.idempotency FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: invoice_lines invoice_lines_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER invoice_lines_set_updated_at BEFORE UPDATE ON public.invoice_lines FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: invoice_runs invoice_runs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER invoice_runs_set_updated_at BEFORE UPDATE ON public.invoice_runs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: invoices invoices_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: kitchen_batches kitchen_batches_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER kitchen_batches_set_updated_at BEFORE UPDATE ON public.kitchen_batches FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: menu_service_days menu_service_day_defaults; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER menu_service_day_defaults BEFORE INSERT OR UPDATE ON public.menu_service_days FOR EACH ROW EXECUTE FUNCTION public.tg_menu_service_day_defaults();


--
-- Name: menu_service_day_items menu_service_day_item_snapshot; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER menu_service_day_item_snapshot BEFORE INSERT OR UPDATE ON public.menu_service_day_items FOR EACH ROW EXECUTE FUNCTION public.tg_menu_service_day_item_snapshot();


--
-- Name: orders order_defaults; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_defaults BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_order_defaults();


--
-- Name: orders order_identity_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_identity_immutable BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_order_identity_immutable();


--
-- Name: order_items order_item_snapshot; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_item_snapshot BEFORE INSERT OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.tg_order_item_snapshot();


--
-- Name: orders order_status_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_status_history AFTER INSERT OR UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_order_status_history();


--
-- Name: orders orders_block_closed_dates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_block_closed_dates BEFORE INSERT OR UPDATE OF date ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_orders_block_closed_dates();


--
-- Name: orders orders_block_if_frozen; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_block_if_frozen BEFORE INSERT OR UPDATE OF date, status, note ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_orders_block_if_frozen();


--
-- Name: orders orders_cutoff_0800; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_cutoff_0800 BEFORE INSERT OR UPDATE OF date, status, note ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_orders_cutoff_0800();


--
-- Name: orders orders_enforce_integrity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_enforce_integrity BEFORE INSERT OR UPDATE OF company_id, location_id, user_id ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_orders_enforce_integrity();


--
-- Name: orders orders_require_active_agreement; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_require_active_agreement BEFORE INSERT OR UPDATE OF company_id, location_id, date ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_orders_require_active_agreement();


--
-- Name: orders orders_require_active_company; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_require_active_company BEFORE INSERT OR UPDATE OF company_id ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_orders_require_active_company();


--
-- Name: orders orders_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: outbox outbox_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER outbox_set_updated_at BEFORE UPDATE ON public.outbox FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: production_days production_days_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER production_days_set_updated_at BEFORE UPDATE ON public.production_days FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: profiles profiles_enforce_company_location; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_enforce_company_location BEFORE INSERT OR UPDATE OF company_id, location_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_enforce_company_location();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: order_items recalculate_order_totals_after_item_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER recalculate_order_totals_after_item_change AFTER INSERT OR DELETE OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.tg_recalculate_order_totals_from_items();


--
-- Name: repair_jobs repair_jobs_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER repair_jobs_set_updated_at BEFORE UPDATE ON public.repair_jobs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: billing_adjustments set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.billing_adjustments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: companies set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: company_contracts set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.company_contracts FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: company_memberships set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.company_memberships FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: company_product_prices set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.company_product_prices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: delivery_runs set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.delivery_runs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: invoice_runs set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.invoice_runs FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: location_policies set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.location_policies FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: menu_service_day_items set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.menu_service_day_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: menu_service_days set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.menu_service_days FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: order_items set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: orders set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: product_categories set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: products set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: standing_orders set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.standing_orders FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: agreements trg_agreements_sync_delivery_days; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_agreements_sync_delivery_days AFTER INSERT OR UPDATE OF delivery_days ON public.agreements FOR EACH ROW EXECUTE FUNCTION public.sync_agreement_delivery_days_from_legacy_jsonb();


--
-- Name: ai_config trg_ai_config_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ai_config_audit AFTER UPDATE ON public.ai_config FOR EACH ROW EXECUTE FUNCTION public.log_ai_config_changes();


--
-- Name: company_memberships trg_company_memberships_recompute_profile_legacy_scope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_company_memberships_recompute_profile_legacy_scope AFTER INSERT OR DELETE OR UPDATE ON public.company_memberships FOR EACH ROW EXECUTE FUNCTION public.trg_company_memberships_recompute_profile_legacy_scope();


--
-- Name: company_memberships trg_company_memberships_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_company_memberships_set_updated_at BEFORE UPDATE ON public.company_memberships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: location_memberships trg_location_memberships_recompute_profile_legacy_scope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_location_memberships_recompute_profile_legacy_scope AFTER INSERT OR DELETE OR UPDATE ON public.location_memberships FOR EACH ROW EXECUTE FUNCTION public.trg_location_memberships_recompute_profile_legacy_scope();


--
-- Name: location_memberships trg_location_memberships_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_location_memberships_set_updated_at BEFORE UPDATE ON public.location_memberships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: marketing_pages trg_marketing_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_marketing_pages_updated_at BEFORE UPDATE ON public.marketing_pages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_audit_legacy_scope_write; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_audit_legacy_scope_write BEFORE UPDATE OF company_id, location_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_direct_profile_scope_write();


--
-- Name: profiles trg_profiles_sync_memberships; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_sync_memberships AFTER INSERT OR UPDATE OF company_id, location_id, role, active, is_active, disabled_at, archived_at ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.sync_memberships_from_legacy_profile();


--
-- Name: tripletex_customers tripletex_customers_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tripletex_customers_set_updated_at BEFORE UPDATE ON public.tripletex_customers FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: tripletex_invoices tripletex_invoices_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tripletex_invoices_set_updated_at BEFORE UPDATE ON public.tripletex_invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: company_memberships validate_company_membership_scope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_company_membership_scope BEFORE INSERT OR UPDATE ON public.company_memberships FOR EACH ROW EXECUTE FUNCTION public.tg_validate_membership_scope();


--
-- Name: company_product_prices validate_company_product_price_scope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_company_product_price_scope BEFORE INSERT OR UPDATE ON public.company_product_prices FOR EACH ROW EXECUTE FUNCTION public.tg_validate_company_product_price_scope();


--
-- Name: standing_orders validate_standing_order_scope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_standing_order_scope BEFORE INSERT OR UPDATE ON public.standing_orders FOR EACH ROW EXECUTE FUNCTION public.tg_validate_standing_order_scope();


--
-- Name: agreement_delivery_days agreement_delivery_days_agreement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_delivery_days
    ADD CONSTRAINT agreement_delivery_days_agreement_id_fkey FOREIGN KEY (agreement_id) REFERENCES public.agreements(id) ON DELETE CASCADE;


--
-- Name: agreement_requests agreement_requests_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreement_requests
    ADD CONSTRAINT agreement_requests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: agreements agreements_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreements
    ADD CONSTRAINT agreements_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: agreements agreements_company_location_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreements
    ADD CONSTRAINT agreements_company_location_fk FOREIGN KEY (company_id, location_id) REFERENCES public.company_locations(company_id, id) ON DELETE RESTRICT;


--
-- Name: agreements agreements_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agreements
    ADD CONSTRAINT agreements_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: audit_log audit_log_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.audit_log
    ADD CONSTRAINT audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: audit_log_legacy audit_log_legacy_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_legacy
    ADD CONSTRAINT audit_log_legacy_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: billing_adjustments billing_adjustments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_adjustments
    ADD CONSTRAINT billing_adjustments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: billing_adjustments billing_adjustments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_adjustments
    ADD CONSTRAINT billing_adjustments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: billing_adjustments billing_adjustments_invoice_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_adjustments
    ADD CONSTRAINT billing_adjustments_invoice_run_id_fkey FOREIGN KEY (invoice_run_id) REFERENCES public.invoice_runs(id) ON DELETE SET NULL;


--
-- Name: billing_adjustments billing_adjustments_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_adjustments
    ADD CONSTRAINT billing_adjustments_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON DELETE RESTRICT;


--
-- Name: closed_dates closed_dates_scope_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closed_dates
    ADD CONSTRAINT closed_dates_scope_company_id_fkey FOREIGN KEY (scope_company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: closed_dates closed_dates_scope_company_location_pair_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closed_dates
    ADD CONSTRAINT closed_dates_scope_company_location_pair_fk FOREIGN KEY (scope_company_id, scope_location_id) REFERENCES public.company_locations(company_id, id) ON DELETE CASCADE;


--
-- Name: closed_dates closed_dates_scope_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closed_dates
    ADD CONSTRAINT closed_dates_scope_location_id_fkey FOREIGN KEY (scope_location_id) REFERENCES public.company_locations(id) ON DELETE CASCADE;


--
-- Name: companies companies_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: companies companies_default_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_default_location_id_fkey FOREIGN KEY (default_location_id) REFERENCES public.company_locations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: companies companies_enterprise_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_enterprise_group_id_fkey FOREIGN KEY (enterprise_group_id) REFERENCES public.enterprise_groups(id);


--
-- Name: company_contracts company_contracts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_contracts
    ADD CONSTRAINT company_contracts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_invites company_invites_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_invites
    ADD CONSTRAINT company_invites_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: company_invites company_invites_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_invites
    ADD CONSTRAINT company_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: company_locations company_locations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_locations
    ADD CONSTRAINT company_locations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: company_memberships company_memberships_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_memberships
    ADD CONSTRAINT company_memberships_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_memberships company_memberships_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_memberships
    ADD CONSTRAINT company_memberships_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: company_memberships company_memberships_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_memberships
    ADD CONSTRAINT company_memberships_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON DELETE RESTRICT;


--
-- Name: company_memberships company_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_memberships
    ADD CONSTRAINT company_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: company_product_prices company_product_prices_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_product_prices
    ADD CONSTRAINT company_product_prices_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_product_prices company_product_prices_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_product_prices
    ADD CONSTRAINT company_product_prices_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: company_registrations company_registrations_agreement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_registrations
    ADD CONSTRAINT company_registrations_agreement_id_fkey FOREIGN KEY (agreement_id) REFERENCES public.agreements(id) ON DELETE SET NULL;


--
-- Name: company_registrations company_registrations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_registrations
    ADD CONSTRAINT company_registrations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: company_registrations company_registrations_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_registrations
    ADD CONSTRAINT company_registrations_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: content_page_variants content_page_variants_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_page_variants
    ADD CONSTRAINT content_page_variants_page_id_fkey FOREIGN KEY (page_id) REFERENCES public.content_pages(id) ON DELETE CASCADE;


--
-- Name: content_pages content_pages_tree_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_pages
    ADD CONSTRAINT content_pages_tree_parent_id_fkey FOREIGN KEY (tree_parent_id) REFERENCES public.content_pages(id) ON DELETE SET NULL;


--
-- Name: day_choices day_choices_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_choices
    ADD CONSTRAINT day_choices_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: day_choices day_choices_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_choices
    ADD CONSTRAINT day_choices_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON DELETE CASCADE;


--
-- Name: day_choices day_choices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.day_choices
    ADD CONSTRAINT day_choices_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: deliveries deliveries_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: deliveries deliveries_company_location_pair_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_company_location_pair_fk FOREIGN KEY (company_id, location_id) REFERENCES public.company_locations(company_id, id) ON DELETE RESTRICT;


--
-- Name: deliveries deliveries_delivered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_delivered_by_fkey FOREIGN KEY (delivered_by) REFERENCES auth.users(id);


--
-- Name: deliveries deliveries_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON DELETE RESTRICT;


--
-- Name: deliveries deliveries_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.driver_runs(id) ON DELETE SET NULL;


--
-- Name: delivery_run_items delivery_run_items_delivery_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_run_items
    ADD CONSTRAINT delivery_run_items_delivery_run_id_fkey FOREIGN KEY (delivery_run_id) REFERENCES public.delivery_runs(id) ON DELETE CASCADE;


--
-- Name: delivery_run_items delivery_run_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_run_items
    ADD CONSTRAINT delivery_run_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: delivery_runs delivery_runs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_runs
    ADD CONSTRAINT delivery_runs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: delivery_runs delivery_runs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_runs
    ADD CONSTRAINT delivery_runs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: delivery_runs delivery_runs_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_runs
    ADD CONSTRAINT delivery_runs_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON DELETE RESTRICT;


--
-- Name: driver_runs driver_runs_driver_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_runs
    ADD CONSTRAINT driver_runs_driver_user_id_fkey FOREIGN KEY (driver_user_id) REFERENCES auth.users(id);


--
-- Name: employee_invites employee_invites_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_invites
    ADD CONSTRAINT employee_invites_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: employee_invites employee_invites_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_invites
    ADD CONSTRAINT employee_invites_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: employee_invites employee_invites_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_invites
    ADD CONSTRAINT employee_invites_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: esg_daily esg_daily_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.esg_daily
    ADD CONSTRAINT esg_daily_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: esg_daily esg_daily_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.esg_daily
    ADD CONSTRAINT esg_daily_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON DELETE CASCADE;


--
-- Name: esg_monthly esg_monthly_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.esg_monthly
    ADD CONSTRAINT esg_monthly_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: form_submissions form_submissions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: form_submissions form_submissions_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;


--
-- Name: forms forms_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: invoice_lines invoice_lines_billing_adjustment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_billing_adjustment_id_fkey FOREIGN KEY (billing_adjustment_id) REFERENCES public.billing_adjustments(id) ON DELETE SET NULL;


--
-- Name: invoice_lines invoice_lines_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: invoice_lines invoice_lines_company_location_pair_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_company_location_pair_fk FOREIGN KEY (company_id, location_id) REFERENCES public.company_locations(company_id, id) ON DELETE RESTRICT;


--
-- Name: invoice_lines invoice_lines_invoice_company_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_invoice_company_fk FOREIGN KEY (invoice_id, company_id) REFERENCES public.invoices(id, company_id) ON DELETE CASCADE;


--
-- Name: invoice_lines invoice_lines_invoice_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_invoice_run_id_fkey FOREIGN KEY (invoice_run_id) REFERENCES public.invoice_runs(id) ON DELETE CASCADE;


--
-- Name: invoice_lines invoice_lines_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON DELETE RESTRICT;


--
-- Name: invoice_lines invoice_lines_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: invoice_lines invoice_lines_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.invoice_runs(id) ON DELETE CASCADE;


--
-- Name: invoice_lines invoice_lines_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: invoice_runs invoice_runs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_runs
    ADD CONSTRAINT invoice_runs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: invoice_runs invoice_runs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_runs
    ADD CONSTRAINT invoice_runs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: invoices invoices_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.invoice_runs(id) ON DELETE CASCADE;


--
-- Name: kitchen_batches kitchen_batches_company_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kitchen_batches
    ADD CONSTRAINT kitchen_batches_company_location_id_fkey FOREIGN KEY (company_location_id) REFERENCES public.company_locations(id) ON DELETE CASCADE;


--
-- Name: lead_pipeline lead_pipeline_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_pipeline
    ADD CONSTRAINT lead_pipeline_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: location_closed_dates location_closed_dates_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_closed_dates
    ADD CONSTRAINT location_closed_dates_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON DELETE RESTRICT;


--
-- Name: location_memberships location_memberships_company_location_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_memberships
    ADD CONSTRAINT location_memberships_company_location_fk FOREIGN KEY (company_id, location_id) REFERENCES public.company_locations(company_id, id) ON DELETE CASCADE;


--
-- Name: location_memberships location_memberships_user_company_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_memberships
    ADD CONSTRAINT location_memberships_user_company_fk FOREIGN KEY (user_id, company_id) REFERENCES public.company_memberships(user_id, company_id) ON DELETE CASCADE;


--
-- Name: location_memberships location_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_memberships
    ADD CONSTRAINT location_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: location_policies location_policies_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.location_policies
    ADD CONSTRAINT location_policies_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON DELETE RESTRICT;


--
-- Name: media_items media_items_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_items
    ADD CONSTRAINT media_items_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: menu_service_day_items menu_service_day_items_menu_service_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_service_day_items
    ADD CONSTRAINT menu_service_day_items_menu_service_day_id_fkey FOREIGN KEY (menu_service_day_id) REFERENCES public.menu_service_days(id) ON DELETE CASCADE;


--
-- Name: menu_service_day_items menu_service_day_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_service_day_items
    ADD CONSTRAINT menu_service_day_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: menu_service_days menu_service_days_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_service_days
    ADD CONSTRAINT menu_service_days_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: menu_service_days menu_service_days_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_service_days
    ADD CONSTRAINT menu_service_days_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: menu_service_days menu_service_days_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_service_days
    ADD CONSTRAINT menu_service_days_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON DELETE RESTRICT;


--
-- Name: menu_visibility_days menu_visibility_days_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_visibility_days
    ADD CONSTRAINT menu_visibility_days_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_menu_service_day_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_menu_service_day_item_id_fkey FOREIGN KEY (menu_service_day_item_id) REFERENCES public.menu_service_day_items(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: order_status_history order_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_agreement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_agreement_id_fkey FOREIGN KEY (agreement_id) REFERENCES public.agreements(id) ON DELETE RESTRICT;


--
-- Name: orders orders_agreement_scope_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_agreement_scope_fk FOREIGN KEY (agreement_id, company_id, location_id) REFERENCES public.agreements(id, company_id, location_id) ON DELETE RESTRICT;


--
-- Name: orders orders_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: orders orders_company_location_pair_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_company_location_pair_fk FOREIGN KEY (company_id, location_id) REFERENCES public.company_locations(company_id, id) ON DELETE RESTRICT;


--
-- Name: orders orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: orders orders_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON DELETE RESTRICT;


--
-- Name: orders orders_menu_service_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_menu_service_day_id_fkey FOREIGN KEY (menu_service_day_id) REFERENCES public.menu_service_days(id) ON DELETE SET NULL;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;


--
-- Name: platform_user_roles platform_user_roles_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_user_roles
    ADD CONSTRAINT platform_user_roles_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: platform_user_roles platform_user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_user_roles
    ADD CONSTRAINT platform_user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: product_allergens product_allergens_allergen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_allergens
    ADD CONSTRAINT product_allergens_allergen_id_fkey FOREIGN KEY (allergen_id) REFERENCES public.allergens(id) ON DELETE RESTRICT;


--
-- Name: product_allergens product_allergens_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_allergens
    ADD CONSTRAINT product_allergens_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_dietary_tags product_dietary_tags_dietary_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_dietary_tags
    ADD CONSTRAINT product_dietary_tags_dietary_tag_id_fkey FOREIGN KEY (dietary_tag_id) REFERENCES public.dietary_tags(id) ON DELETE RESTRICT;


--
-- Name: product_dietary_tags product_dietary_tags_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_dietary_tags
    ADD CONSTRAINT product_dietary_tags_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: production_days production_days_frozen_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_days
    ADD CONSTRAINT production_days_frozen_by_fkey FOREIGN KEY (frozen_by) REFERENCES auth.users(id);


--
-- Name: production_manifests production_manifests_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_manifests
    ADD CONSTRAINT production_manifests_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: production_manifests production_manifests_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_manifests
    ADD CONSTRAINT production_manifests_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON DELETE RESTRICT;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.product_categories(id) ON DELETE SET NULL;


--
-- Name: products products_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_company_location_pair_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_company_location_pair_fk FOREIGN KEY (company_id, location_id) REFERENCES public.company_locations(company_id, id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON DELETE SET NULL;


--
-- Name: standing_orders standing_orders_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standing_orders
    ADD CONSTRAINT standing_orders_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: standing_orders standing_orders_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standing_orders
    ADD CONSTRAINT standing_orders_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.company_locations(id) ON DELETE RESTRICT;


--
-- Name: standing_orders standing_orders_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standing_orders
    ADD CONSTRAINT standing_orders_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;


--
-- Name: standing_orders standing_orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.standing_orders
    ADD CONSTRAINT standing_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tripletex_customers tripletex_customers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tripletex_customers
    ADD CONSTRAINT tripletex_customers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: tripletex_invoices tripletex_invoices_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tripletex_invoices
    ADD CONSTRAINT tripletex_invoices_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: tripletex_invoices tripletex_invoices_invoice_company_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tripletex_invoices
    ADD CONSTRAINT tripletex_invoices_invoice_company_fk FOREIGN KEY (invoice_id, company_id) REFERENCES public.invoices(id, company_id) ON DELETE CASCADE;


--
-- Name: tripletex_invoices tripletex_invoices_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tripletex_invoices
    ADD CONSTRAINT tripletex_invoices_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.invoice_runs(id) ON DELETE CASCADE;


--
-- Name: system_settings Service role full access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role full access" ON public.system_settings USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: _migration_legacy_stub_invoice_lines_archive; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._migration_legacy_stub_invoice_lines_archive ENABLE ROW LEVEL SECURITY;

--
-- Name: _migration_legacy_stub_order_items_archive; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._migration_legacy_stub_order_items_archive ENABLE ROW LEVEL SECURITY;

--
-- Name: _migration_legacy_stub_orders_archive; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._migration_legacy_stub_orders_archive ENABLE ROW LEVEL SECURITY;

--
-- Name: _migration_legacy_stub_orders_manifest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._migration_legacy_stub_orders_manifest ENABLE ROW LEVEL SECURITY;

--
-- Name: _migration_orders_location_id_backup; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public._migration_orders_location_id_backup ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement_cleanup_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agreement_cleanup_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement_delivery_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agreement_delivery_days ENABLE ROW LEVEL SECURITY;

--
-- Name: agreement_delivery_days agreement_delivery_days_delete_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agreement_delivery_days_delete_platform_admin ON public.agreement_delivery_days FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: agreement_delivery_days agreement_delivery_days_insert_admin_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agreement_delivery_days_insert_admin_scoped ON public.agreement_delivery_days FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.agreements a
  WHERE ((a.id = agreement_delivery_days.agreement_id) AND (public.is_platform_admin() OR public.can_admin_company(a.company_id) OR public.can_admin_location(a.location_id))))));


--
-- Name: agreement_delivery_days agreement_delivery_days_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agreement_delivery_days_select_scoped ON public.agreement_delivery_days FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.agreements a
  WHERE ((a.id = agreement_delivery_days.agreement_id) AND (public.is_platform_admin() OR public.can_access_company(a.company_id) OR public.can_access_location(a.location_id) OR public.can_kitchen_location(a.location_id))))));


--
-- Name: agreement_delivery_days agreement_delivery_days_update_admin_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agreement_delivery_days_update_admin_scoped ON public.agreement_delivery_days FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.agreements a
  WHERE ((a.id = agreement_delivery_days.agreement_id) AND (public.is_platform_admin() OR public.can_admin_company(a.company_id) OR public.can_admin_location(a.location_id)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.agreements a
  WHERE ((a.id = agreement_delivery_days.agreement_id) AND (public.is_platform_admin() OR public.can_admin_company(a.company_id) OR public.can_admin_location(a.location_id))))));


--
-- Name: agreement_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agreement_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: agreements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

--
-- Name: agreements agreements_delete_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agreements_delete_platform_admin ON public.agreements FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: agreements agreements_insert_admin_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agreements_insert_admin_scoped ON public.agreements FOR INSERT TO authenticated WITH CHECK ((public.is_platform_admin() OR public.can_admin_company(company_id) OR public.can_admin_location(location_id)));


--
-- Name: agreements agreements_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agreements_select_scoped ON public.agreements FOR SELECT TO authenticated USING ((public.is_platform_admin() OR public.can_access_company(company_id) OR public.can_access_location(location_id) OR public.can_kitchen_location(location_id)));


--
-- Name: agreements agreements_update_admin_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agreements_update_admin_scoped ON public.agreements FOR UPDATE TO authenticated USING ((public.is_platform_admin() OR public.can_admin_company(company_id) OR public.can_admin_location(location_id))) WITH CHECK ((public.is_platform_admin() OR public.can_admin_company(company_id) OR public.can_admin_location(location_id)));


--
-- Name: ai_action_memory; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_action_memory ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_action_memory ai_action_memory_service_role_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_action_memory_service_role_only ON public.ai_action_memory USING ((auth.role() = 'service_role'::text)) WITH CHECK ((auth.role() = 'service_role'::text));


--
-- Name: ai_activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_activity_log ai_activity_log_delete_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_activity_log_delete_none ON public.ai_activity_log FOR DELETE TO authenticated USING (false);


--
-- Name: ai_activity_log ai_activity_log_insert_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_activity_log_insert_platform_admin ON public.ai_activity_log FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: ai_activity_log ai_activity_log_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_activity_log_select_platform_admin ON public.ai_activity_log FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: ai_activity_log ai_activity_log_update_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_activity_log_update_none ON public.ai_activity_log FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: ai_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_config_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_config_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_config_audit ai_config_audit_delete_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_config_audit_delete_none ON public.ai_config_audit FOR DELETE TO authenticated USING (false);


--
-- Name: ai_config_audit ai_config_audit_insert_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_config_audit_insert_none ON public.ai_config_audit FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: ai_config_audit ai_config_audit_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_config_audit_select_platform_admin ON public.ai_config_audit FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: ai_config_audit ai_config_audit_update_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_config_audit_update_none ON public.ai_config_audit FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: ai_config ai_config_mutate_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_config_mutate_platform_admin ON public.ai_config TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: ai_config ai_config_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_config_select_platform_admin ON public.ai_config FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: ai_health_checks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_health_checks ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_health_checks ai_health_checks_delete_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_health_checks_delete_none ON public.ai_health_checks FOR DELETE TO authenticated USING (false);


--
-- Name: ai_health_checks ai_health_checks_insert_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_health_checks_insert_platform_admin ON public.ai_health_checks FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: ai_health_checks ai_health_checks_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_health_checks_select_platform_admin ON public.ai_health_checks FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: ai_health_checks ai_health_checks_update_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_health_checks_update_none ON public.ai_health_checks FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: ai_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_jobs ai_jobs_delete_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_jobs_delete_none ON public.ai_jobs FOR DELETE TO authenticated USING (false);


--
-- Name: ai_jobs ai_jobs_insert_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_jobs_insert_platform_admin ON public.ai_jobs FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: ai_jobs ai_jobs_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_jobs_select_platform_admin ON public.ai_jobs FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: ai_jobs ai_jobs_update_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_jobs_update_platform_admin ON public.ai_jobs FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: ai_suggestions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_suggestions ai_suggestions_delete_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_suggestions_delete_none ON public.ai_suggestions FOR DELETE TO authenticated USING (false);


--
-- Name: ai_suggestions ai_suggestions_insert_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_suggestions_insert_platform_admin ON public.ai_suggestions FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin());


--
-- Name: ai_suggestions ai_suggestions_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_suggestions_select_platform_admin ON public.ai_suggestions FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: ai_suggestions ai_suggestions_update_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_suggestions_update_platform_admin ON public.ai_suggestions FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: allergens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.allergens ENABLE ROW LEVEL SECURITY;

--
-- Name: allergens allergens_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allergens_manage ON public.allergens TO authenticated USING (( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role]) AS has_platform_role)) WITH CHECK (( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role]) AS has_platform_role));


--
-- Name: allergens allergens_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allergens_select ON public.allergens FOR SELECT TO authenticated USING (true);


--
-- Name: audit_events audit_delete_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_delete_none ON public.audit_events FOR DELETE TO authenticated USING (false);


--
-- Name: audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_events audit_insert_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_insert_none ON public.audit_events FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log_legacy; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log_legacy ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log audit_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated USING (( SELECT private.is_platform_admin() AS is_platform_admin));


--
-- Name: audit_log_legacy audit_log_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_select ON public.audit_log_legacy FOR SELECT TO authenticated USING (( SELECT private.is_platform_admin() AS is_platform_admin));


--
-- Name: audit_events audit_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_select_platform_admin ON public.audit_events FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: audit_events audit_update_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_update_none ON public.audit_events FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: billing_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_adjustments billing_adjustments_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_adjustments_manage ON public.billing_adjustments TO authenticated USING (( SELECT private.can_finance_company(billing_adjustments.company_id) AS can_finance_company)) WITH CHECK (( SELECT private.can_finance_company(billing_adjustments.company_id) AS can_finance_company));


--
-- Name: billing_adjustments billing_adjustments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_adjustments_select ON public.billing_adjustments FOR SELECT TO authenticated USING (( SELECT private.can_finance_company(billing_adjustments.company_id) AS can_finance_company));


--
-- Name: closed_dates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.closed_dates ENABLE ROW LEVEL SECURITY;

--
-- Name: closed_dates closed_dates_delete_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY closed_dates_delete_platform_admin ON public.closed_dates FOR DELETE TO authenticated USING (public.is_platform_admin());


--
-- Name: closed_dates closed_dates_insert_admin_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY closed_dates_insert_admin_scoped ON public.closed_dates FOR INSERT TO authenticated WITH CHECK ((public.is_platform_admin() OR ((scope_company_id IS NOT NULL) AND (scope_location_id IS NULL) AND public.can_admin_company(scope_company_id)) OR ((scope_location_id IS NOT NULL) AND public.can_admin_location(scope_location_id))));


--
-- Name: closed_dates closed_dates_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY closed_dates_select_scoped ON public.closed_dates FOR SELECT TO authenticated USING ((public.is_platform_admin() OR ((scope_company_id IS NULL) AND (scope_location_id IS NULL)) OR ((scope_company_id IS NOT NULL) AND (scope_location_id IS NULL) AND public.can_access_company(scope_company_id)) OR ((scope_location_id IS NOT NULL) AND public.can_access_location(scope_location_id)) OR ((scope_location_id IS NOT NULL) AND public.can_kitchen_location(scope_location_id))));


--
-- Name: closed_dates closed_dates_update_admin_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY closed_dates_update_admin_scoped ON public.closed_dates FOR UPDATE TO authenticated USING ((public.is_platform_admin() OR ((scope_company_id IS NOT NULL) AND (scope_location_id IS NULL) AND public.can_admin_company(scope_company_id)) OR ((scope_location_id IS NOT NULL) AND public.can_admin_location(scope_location_id)))) WITH CHECK ((public.is_platform_admin() OR ((scope_company_id IS NOT NULL) AND (scope_location_id IS NULL) AND public.can_admin_company(scope_company_id)) OR ((scope_location_id IS NOT NULL) AND public.can_admin_location(scope_location_id))));


--
-- Name: companies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

--
-- Name: companies companies_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_insert ON public.companies FOR INSERT TO authenticated WITH CHECK (( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role]) AS has_platform_role));


--
-- Name: companies companies_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_select ON public.companies FOR SELECT TO authenticated USING (( SELECT private.can_access_company(companies.id) AS can_access_company));


--
-- Name: companies companies_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_update ON public.companies FOR UPDATE TO authenticated USING (( SELECT private.can_manage_company(companies.id) AS can_manage_company)) WITH CHECK (( SELECT private.can_manage_company(companies.id) AS can_manage_company));


--
-- Name: companies companies_write_superadmin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY companies_write_superadmin ON public.companies TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());


--
-- Name: company_contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: company_contracts company_contracts_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_contracts_manage ON public.company_contracts TO authenticated USING (( SELECT private.can_manage_company(company_contracts.company_id) AS can_manage_company)) WITH CHECK (( SELECT private.can_manage_company(company_contracts.company_id) AS can_manage_company));


--
-- Name: company_contracts company_contracts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_contracts_select ON public.company_contracts FOR SELECT TO authenticated USING (( SELECT private.can_access_company(company_contracts.company_id) AS can_access_company));


--
-- Name: company_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: company_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: company_locations company_locations_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_locations_delete ON public.company_locations FOR DELETE TO authenticated USING (((public.current_profile_active() = true) AND ((public.current_profile_role() = 'superadmin'::public.user_role) OR ((public.current_profile_role() = 'company_admin'::public.user_role) AND (company_id = public.current_profile_company_id())))));


--
-- Name: company_locations company_locations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_locations_insert ON public.company_locations FOR INSERT TO authenticated WITH CHECK (((public.current_profile_active() = true) AND ((public.current_profile_role() = 'superadmin'::public.user_role) OR ((public.current_profile_role() = 'company_admin'::public.user_role) AND (company_id = public.current_profile_company_id())))));


--
-- Name: company_locations company_locations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_locations_select ON public.company_locations FOR SELECT TO authenticated USING (((public.current_profile_active() = true) AND ((public.current_profile_role() = 'superadmin'::public.user_role) OR (company_id = public.current_profile_company_id()))));


--
-- Name: company_locations company_locations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_locations_update ON public.company_locations FOR UPDATE TO authenticated USING (((public.current_profile_active() = true) AND ((public.current_profile_role() = 'superadmin'::public.user_role) OR ((public.current_profile_role() = 'company_admin'::public.user_role) AND (company_id = public.current_profile_company_id()))))) WITH CHECK (((public.current_profile_active() = true) AND ((public.current_profile_role() = 'superadmin'::public.user_role) OR ((public.current_profile_role() = 'company_admin'::public.user_role) AND (company_id = public.current_profile_company_id())))));


--
-- Name: company_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: company_memberships company_memberships_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_memberships_manage ON public.company_memberships TO authenticated USING (( SELECT private.can_manage_company(company_memberships.company_id) AS can_manage_company)) WITH CHECK (( SELECT private.can_manage_company(company_memberships.company_id) AS can_manage_company));


--
-- Name: company_memberships company_memberships_mutate_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_memberships_mutate_platform_admin ON public.company_memberships TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: company_memberships company_memberships_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_memberships_select ON public.company_memberships FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.can_access_company(company_memberships.company_id) AS can_access_company)));


--
-- Name: company_memberships company_memberships_select_self_admin_or_platform; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_memberships_select_self_admin_or_platform ON public.company_memberships FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_platform_admin() OR public.can_admin_company(company_id)));


--
-- Name: company_product_prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_product_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: company_product_prices company_product_prices_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_product_prices_manage ON public.company_product_prices TO authenticated USING (( SELECT private.can_manage_company(company_product_prices.company_id) AS can_manage_company)) WITH CHECK (( SELECT private.can_manage_company(company_product_prices.company_id) AS can_manage_company));


--
-- Name: company_product_prices company_product_prices_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_product_prices_select ON public.company_product_prices FOR SELECT TO authenticated USING (( SELECT private.can_access_company(company_product_prices.company_id) AS can_access_company));


--
-- Name: company_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.company_registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: company_registrations company_registrations_service_role_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_registrations_service_role_full ON public.company_registrations TO service_role USING (true) WITH CHECK (true);


--
-- Name: company_registrations company_registrations_superadmin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY company_registrations_superadmin ON public.company_registrations TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'superadmin'::public.user_role))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'superadmin'::public.user_role)))));


--
-- Name: content_page_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_page_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: content_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: day_choices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.day_choices ENABLE ROW LEVEL SECURITY;

--
-- Name: day_choices day_choices_insert_employee_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY day_choices_insert_employee_own ON public.day_choices FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.disabled_at IS NULL) AND (COALESCE(p.is_active, true) = true) AND ((p.role)::text = 'employee'::text) AND (day_choices.user_id = auth.uid()) AND (p.company_id = day_choices.company_id) AND (p.location_id = day_choices.location_id)))));


--
-- Name: day_choices day_choices_select_employee_kitchen_superadmin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY day_choices_select_employee_kitchen_superadmin ON public.day_choices FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.disabled_at IS NULL) AND (COALESCE(p.is_active, true) = true) AND (((p.role)::text = 'superadmin'::text) OR (((p.role)::text = 'kitchen'::text) AND (p.company_id = day_choices.company_id) AND (p.location_id = day_choices.location_id)) OR (((p.role)::text = 'employee'::text) AND (day_choices.user_id = auth.uid()) AND (p.company_id = day_choices.company_id) AND (p.location_id = day_choices.location_id)))))));


--
-- Name: day_choices day_choices_update_employee_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY day_choices_update_employee_own ON public.day_choices FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.disabled_at IS NULL) AND (COALESCE(p.is_active, true) = true) AND ((p.role)::text = 'employee'::text) AND (day_choices.user_id = auth.uid()) AND (p.company_id = day_choices.company_id) AND (p.location_id = day_choices.location_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.disabled_at IS NULL) AND (COALESCE(p.is_active, true) = true) AND ((p.role)::text = 'employee'::text) AND (day_choices.user_id = auth.uid()) AND (p.company_id = day_choices.company_id) AND (p.location_id = day_choices.location_id)))));


--
-- Name: deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: deliveries deliveries_delete_admin_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deliveries_delete_admin_scoped ON public.deliveries FOR DELETE TO authenticated USING ((public.is_platform_admin() OR public.can_admin_company(company_id) OR public.can_admin_location(location_id)));


--
-- Name: deliveries deliveries_insert_admin_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deliveries_insert_admin_scoped ON public.deliveries FOR INSERT TO authenticated WITH CHECK ((public.is_platform_admin() OR public.can_admin_company(company_id) OR public.can_admin_location(location_id)));


--
-- Name: deliveries deliveries_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deliveries_select_scoped ON public.deliveries FOR SELECT TO authenticated USING ((public.is_platform_admin() OR public.can_admin_company(company_id) OR public.can_admin_location(location_id) OR public.can_kitchen_location(location_id) OR (EXISTS ( SELECT 1
   FROM public.driver_runs dr
  WHERE ((dr.id = deliveries.run_id) AND (dr.driver_user_id = auth.uid()))))));


--
-- Name: deliveries deliveries_update_driver_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deliveries_update_driver_or_admin ON public.deliveries FOR UPDATE TO authenticated USING ((public.is_platform_admin() OR public.can_admin_company(company_id) OR public.can_admin_location(location_id) OR (EXISTS ( SELECT 1
   FROM public.driver_runs dr
  WHERE ((dr.id = deliveries.run_id) AND (dr.driver_user_id = auth.uid())))))) WITH CHECK ((public.is_platform_admin() OR public.can_admin_company(company_id) OR public.can_admin_location(location_id) OR (EXISTS ( SELECT 1
   FROM public.driver_runs dr
  WHERE ((dr.id = deliveries.run_id) AND (dr.driver_user_id = auth.uid()))))));


--
-- Name: delivery_run_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_run_items ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_run_items delivery_run_items_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_run_items_manage ON public.delivery_run_items TO authenticated USING (( SELECT private.can_operate_delivery_run(delivery_run_items.delivery_run_id) AS can_operate_delivery_run)) WITH CHECK (( SELECT private.can_operate_delivery_run(delivery_run_items.delivery_run_id) AS can_operate_delivery_run));


--
-- Name: delivery_run_items delivery_run_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_run_items_select ON public.delivery_run_items FOR SELECT TO authenticated USING (( SELECT private.can_access_delivery_run(delivery_run_items.delivery_run_id) AS can_access_delivery_run));


--
-- Name: delivery_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_runs delivery_runs_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_runs_manage ON public.delivery_runs TO authenticated USING ((( SELECT private.can_manage_location(delivery_runs.location_id) AS can_manage_location) OR ( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role, 'kitchen'::public.platform_role, 'courier'::public.platform_role]) AS has_platform_role))) WITH CHECK ((( SELECT private.can_manage_location(delivery_runs.location_id) AS can_manage_location) OR ( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role, 'kitchen'::public.platform_role, 'courier'::public.platform_role]) AS has_platform_role)));


--
-- Name: delivery_runs delivery_runs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY delivery_runs_select ON public.delivery_runs FOR SELECT TO authenticated USING ((( SELECT private.can_access_location(delivery_runs.location_id) AS can_access_location) OR ( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role, 'kitchen'::public.platform_role, 'courier'::public.platform_role]) AS has_platform_role)));


--
-- Name: dietary_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dietary_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: dietary_tags dietary_tags_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dietary_tags_manage ON public.dietary_tags TO authenticated USING (( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role]) AS has_platform_role)) WITH CHECK (( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role]) AS has_platform_role));


--
-- Name: dietary_tags dietary_tags_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dietary_tags_select ON public.dietary_tags FOR SELECT TO authenticated USING (true);


--
-- Name: driver_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.driver_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: driver_runs driver_runs_mutate_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY driver_runs_mutate_platform_admin ON public.driver_runs TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: driver_runs driver_runs_select_assigned_or_platform; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY driver_runs_select_assigned_or_platform ON public.driver_runs FOR SELECT TO authenticated USING ((public.is_platform_admin() OR (driver_user_id = auth.uid())));


--
-- Name: employee_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.employee_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: enterprise_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enterprise_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: enterprise_groups enterprise_groups_select_superadmin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY enterprise_groups_select_superadmin ON public.enterprise_groups FOR SELECT TO authenticated USING (public.is_superadmin());


--
-- Name: enterprise_groups enterprise_groups_write_superadmin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY enterprise_groups_write_superadmin ON public.enterprise_groups TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());


--
-- Name: esg_daily; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.esg_daily ENABLE ROW LEVEL SECURITY;

--
-- Name: esg_daily esg_daily_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esg_daily_select ON public.esg_daily FOR SELECT TO authenticated USING ((public.is_superadmin() OR ((public.current_profile_role() = 'company_admin'::public.user_role) AND (company_id = public.current_profile_company_id()))));


--
-- Name: esg_daily esg_daily_write_superadmin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esg_daily_write_superadmin ON public.esg_daily TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());


--
-- Name: esg_monthly; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.esg_monthly ENABLE ROW LEVEL SECURITY;

--
-- Name: esg_monthly esg_monthly_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esg_monthly_select ON public.esg_monthly FOR SELECT TO authenticated USING ((public.is_superadmin() OR ((public.current_profile_role() = 'company_admin'::public.user_role) AND (company_id = public.current_profile_company_id()))));


--
-- Name: esg_monthly esg_monthly_write_superadmin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esg_monthly_write_superadmin ON public.esg_monthly TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());


--
-- Name: form_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: form_submissions form_submissions_platform_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_submissions_platform_admin_only ON public.form_submissions TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: forms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

--
-- Name: forms forms_platform_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forms_platform_admin_only ON public.forms TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: system_health_snapshots health_delete_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY health_delete_none ON public.system_health_snapshots FOR DELETE TO authenticated USING (false);


--
-- Name: system_health_snapshots health_insert_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY health_insert_none ON public.system_health_snapshots FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: system_health_snapshots health_update_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY health_update_none ON public.system_health_snapshots FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: idempotency; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.idempotency ENABLE ROW LEVEL SECURITY;

--
-- Name: idempotency idempotency_delete_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY idempotency_delete_none ON public.idempotency FOR DELETE TO authenticated USING (false);


--
-- Name: idempotency idempotency_insert_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY idempotency_insert_none ON public.idempotency FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: idempotency idempotency_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY idempotency_select_platform_admin ON public.idempotency FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: idempotency idempotency_update_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY idempotency_update_none ON public.idempotency FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: incidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: incidents incidents_delete_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY incidents_delete_none ON public.incidents FOR DELETE TO authenticated USING (false);


--
-- Name: incidents incidents_insert_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY incidents_insert_none ON public.incidents FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: incidents incidents_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY incidents_select_platform_admin ON public.incidents FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: incidents incidents_update_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY incidents_update_none ON public.incidents FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: invoice_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_lines invoice_lines_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoice_lines_manage ON public.invoice_lines TO authenticated USING (( SELECT private.can_finance_company(invoice_lines.company_id) AS can_finance_company)) WITH CHECK (( SELECT private.can_finance_company(invoice_lines.company_id) AS can_finance_company));


--
-- Name: invoice_lines invoice_lines_mutate_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoice_lines_mutate_platform_admin ON public.invoice_lines TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: invoice_lines invoice_lines_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoice_lines_select ON public.invoice_lines FOR SELECT TO authenticated USING (( SELECT private.can_finance_company(invoice_lines.company_id) AS can_finance_company));


--
-- Name: invoice_lines invoice_lines_select_company_admin_or_platform; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoice_lines_select_company_admin_or_platform ON public.invoice_lines FOR SELECT TO authenticated USING ((public.is_platform_admin() OR public.can_admin_company(company_id)));


--
-- Name: invoice_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoice_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: invoice_runs invoice_runs_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoice_runs_manage ON public.invoice_runs TO authenticated USING (( SELECT private.can_finance_company(invoice_runs.company_id) AS can_finance_company)) WITH CHECK (( SELECT private.can_finance_company(invoice_runs.company_id) AS can_finance_company));


--
-- Name: invoice_runs invoice_runs_mutate_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoice_runs_mutate_platform_admin ON public.invoice_runs TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: invoice_runs invoice_runs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoice_runs_select ON public.invoice_runs FOR SELECT TO authenticated USING (( SELECT private.can_finance_company(invoice_runs.company_id) AS can_finance_company));


--
-- Name: invoice_runs invoice_runs_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoice_runs_select_platform_admin ON public.invoice_runs FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices invoices_mutate_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoices_mutate_platform_admin ON public.invoices TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: invoices invoices_select_company_admin_or_platform; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoices_select_company_admin_or_platform ON public.invoices FOR SELECT TO authenticated USING ((public.is_platform_admin() OR public.can_admin_company(company_id)));


--
-- Name: kitchen_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.kitchen_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: kitchen_batches kitchen_batches_delete_superadmin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kitchen_batches_delete_superadmin ON public.kitchen_batches FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.disabled_at IS NULL) AND (COALESCE(p.is_active, true) = true) AND ((p.role)::text = 'superadmin'::text)))));


--
-- Name: kitchen_batches kitchen_batches_insert_kitchen_superadmin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kitchen_batches_insert_kitchen_superadmin ON public.kitchen_batches FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.disabled_at IS NULL) AND (COALESCE(p.is_active, true) = true) AND (((p.role)::text = 'superadmin'::text) OR (((p.role)::text = 'kitchen'::text) AND (p.location_id = kitchen_batches.company_location_id)))))));


--
-- Name: kitchen_batches kitchen_batches_select_kitchen_superadmin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kitchen_batches_select_kitchen_superadmin ON public.kitchen_batches FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.disabled_at IS NULL) AND (COALESCE(p.is_active, true) = true) AND (((p.role)::text = 'superadmin'::text) OR (((p.role)::text = 'kitchen'::text) AND (p.location_id = kitchen_batches.company_location_id)))))));


--
-- Name: kitchen_batches kitchen_batches_update_kitchen_superadmin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY kitchen_batches_update_kitchen_superadmin ON public.kitchen_batches FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.disabled_at IS NULL) AND (COALESCE(p.is_active, true) = true) AND (((p.role)::text = 'superadmin'::text) OR (((p.role)::text = 'kitchen'::text) AND (p.location_id = kitchen_batches.company_location_id))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.disabled_at IS NULL) AND (COALESCE(p.is_active, true) = true) AND (((p.role)::text = 'superadmin'::text) OR (((p.role)::text = 'kitchen'::text) AND (p.location_id = kitchen_batches.company_location_id)))))));


--
-- Name: lead_pipeline; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_pipeline ENABLE ROW LEVEL SECURITY;

--
-- Name: location_closed_dates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.location_closed_dates ENABLE ROW LEVEL SECURITY;

--
-- Name: location_closed_dates location_closed_dates_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY location_closed_dates_manage ON public.location_closed_dates TO authenticated USING (( SELECT private.can_manage_location(location_closed_dates.location_id) AS can_manage_location)) WITH CHECK (( SELECT private.can_manage_location(location_closed_dates.location_id) AS can_manage_location));


--
-- Name: location_closed_dates location_closed_dates_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY location_closed_dates_select ON public.location_closed_dates FOR SELECT TO authenticated USING (( SELECT private.can_access_location(location_closed_dates.location_id) AS can_access_location));


--
-- Name: location_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.location_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: location_memberships location_memberships_mutate_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY location_memberships_mutate_platform_admin ON public.location_memberships TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: location_memberships location_memberships_select_self_admin_or_platform; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY location_memberships_select_self_admin_or_platform ON public.location_memberships FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_platform_admin() OR public.can_admin_company(company_id) OR public.can_admin_location(location_id)));


--
-- Name: location_policies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.location_policies ENABLE ROW LEVEL SECURITY;

--
-- Name: location_policies location_policies_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY location_policies_manage ON public.location_policies TO authenticated USING (( SELECT private.can_manage_location(location_policies.location_id) AS can_manage_location)) WITH CHECK (( SELECT private.can_manage_location(location_policies.location_id) AS can_manage_location));


--
-- Name: location_policies location_policies_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY location_policies_select ON public.location_policies FOR SELECT TO authenticated USING (( SELECT private.can_access_location(location_policies.location_id) AS can_access_location));


--
-- Name: marketing_pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketing_pages ENABLE ROW LEVEL SECURITY;

--
-- Name: marketing_pages marketing_pages_platform_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY marketing_pages_platform_admin_all ON public.marketing_pages TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: media_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;

--
-- Name: media_items media_items_platform_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY media_items_platform_admin_only ON public.media_items TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: menu_service_day_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_service_day_items ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_service_day_items menu_service_day_items_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_service_day_items_manage ON public.menu_service_day_items TO authenticated USING (( SELECT private.can_manage_menu_day(menu_service_day_items.menu_service_day_id) AS can_manage_menu_day)) WITH CHECK (( SELECT private.can_manage_menu_day(menu_service_day_items.menu_service_day_id) AS can_manage_menu_day));


--
-- Name: menu_service_day_items menu_service_day_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_service_day_items_select ON public.menu_service_day_items FOR SELECT TO authenticated USING (( SELECT private.can_access_menu_day(menu_service_day_items.menu_service_day_id) AS can_access_menu_day));


--
-- Name: menu_service_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_service_days ENABLE ROW LEVEL SECURITY;

--
-- Name: menu_service_days menu_service_days_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_service_days_manage ON public.menu_service_days TO authenticated USING (( SELECT private.can_manage_menu_day(menu_service_days.id) AS can_manage_menu_day)) WITH CHECK (( SELECT private.can_manage_location(menu_service_days.location_id) AS can_manage_location));


--
-- Name: menu_service_days menu_service_days_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY menu_service_days_select ON public.menu_service_days FOR SELECT TO authenticated USING (( SELECT private.can_access_menu_day(menu_service_days.id) AS can_access_menu_day));


--
-- Name: menu_visibility_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.menu_visibility_days ENABLE ROW LEVEL SECURITY;

--
-- Name: ops_events ops_delete_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ops_delete_none ON public.ops_events FOR DELETE TO authenticated USING (false);


--
-- Name: ops_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ops_events ENABLE ROW LEVEL SECURITY;

--
-- Name: ops_events ops_insert_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ops_insert_none ON public.ops_events FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: ops_events ops_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ops_select_platform_admin ON public.ops_events FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: ops_events ops_update_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ops_update_none ON public.ops_events FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items order_items_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_items_delete ON public.order_items FOR DELETE TO authenticated USING (( SELECT private.can_edit_order(order_items.order_id) AS can_edit_order));


--
-- Name: order_items order_items_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_items_insert ON public.order_items FOR INSERT TO authenticated WITH CHECK (( SELECT private.can_edit_order(order_items.order_id) AS can_edit_order));


--
-- Name: order_items order_items_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_items_select ON public.order_items FOR SELECT TO authenticated USING (( SELECT private.can_view_order(order_items.order_id) AS can_view_order));


--
-- Name: order_items order_items_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_items_update ON public.order_items FOR UPDATE TO authenticated USING (( SELECT private.can_view_order(order_items.order_id) AS can_view_order)) WITH CHECK (( SELECT private.can_edit_order(order_items.order_id) AS can_edit_order));


--
-- Name: order_status_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

--
-- Name: order_status_history order_status_history_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_status_history_select ON public.order_status_history FOR SELECT TO authenticated USING (( SELECT private.can_view_order(order_status_history.order_id) AS can_view_order));


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_delete ON public.orders FOR DELETE TO authenticated USING (( SELECT private.can_edit_order(orders.id) AS can_edit_order));


--
-- Name: orders orders_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_insert ON public.orders FOR INSERT TO authenticated WITH CHECK ((((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.can_access_location(orders.location_id) AS can_access_location)) OR ( SELECT private.can_manage_location(orders.location_id) AS can_manage_location) OR ( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role]) AS has_platform_role)));


--
-- Name: orders orders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_select ON public.orders FOR SELECT TO authenticated USING (( SELECT private.can_view_order(orders.id) AS can_view_order));


--
-- Name: orders orders_select_bridge_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_select_bridge_scoped ON public.orders FOR SELECT TO authenticated USING ((public.is_platform_admin() OR (user_id = auth.uid()) OR public.can_admin_company(company_id) OR public.can_admin_location(location_id) OR public.can_kitchen_location(location_id) OR (EXISTS ( SELECT 1
   FROM (public.deliveries d
     JOIN public.driver_runs dr ON ((dr.id = d.run_id)))
  WHERE ((d.company_id = orders.company_id) AND (d.location_id = orders.location_id) AND (d.date = orders.date) AND (dr.driver_user_id = auth.uid()))))));


--
-- Name: orders orders_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_update ON public.orders FOR UPDATE TO authenticated USING (( SELECT private.can_view_order(orders.id) AS can_view_order)) WITH CHECK ((((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.can_access_location(orders.location_id) AS can_access_location)) OR ( SELECT private.can_manage_location(orders.location_id) AS can_manage_location) OR ( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role, 'kitchen'::public.platform_role, 'courier'::public.platform_role]) AS has_platform_role)));


--
-- Name: outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: outbox outbox_delete_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY outbox_delete_none ON public.outbox FOR DELETE TO authenticated USING (false);


--
-- Name: outbox outbox_insert_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY outbox_insert_none ON public.outbox FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: outbox outbox_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY outbox_select_platform_admin ON public.outbox FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: outbox outbox_update_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY outbox_update_none ON public.outbox FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: platform_user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_user_roles platform_user_roles_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_user_roles_manage ON public.platform_user_roles TO authenticated USING (( SELECT private.is_platform_admin() AS is_platform_admin)) WITH CHECK (( SELECT private.is_platform_admin() AS is_platform_admin));


--
-- Name: platform_user_roles platform_user_roles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_user_roles_select ON public.platform_user_roles FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_platform_admin() AS is_platform_admin)));


--
-- Name: product_allergens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_allergens ENABLE ROW LEVEL SECURITY;

--
-- Name: product_allergens product_allergens_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_allergens_manage ON public.product_allergens TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_allergens.product_id) AND (((p.company_id IS NULL) AND ( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role]) AS has_platform_role)) OR ((p.company_id IS NOT NULL) AND ( SELECT private.can_manage_company(p.company_id) AS can_manage_company))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_allergens.product_id) AND (((p.company_id IS NULL) AND ( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role]) AS has_platform_role)) OR ((p.company_id IS NOT NULL) AND ( SELECT private.can_manage_company(p.company_id) AS can_manage_company)))))));


--
-- Name: product_allergens product_allergens_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_allergens_select ON public.product_allergens FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_allergens.product_id) AND ((p.company_id IS NULL) OR ( SELECT private.can_access_company(p.company_id) AS can_access_company))))));


--
-- Name: product_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: product_categories product_categories_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_categories_manage ON public.product_categories TO authenticated USING (( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role]) AS has_platform_role)) WITH CHECK (( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role]) AS has_platform_role));


--
-- Name: product_categories product_categories_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_categories_select ON public.product_categories FOR SELECT TO authenticated USING (true);


--
-- Name: product_dietary_tags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_dietary_tags ENABLE ROW LEVEL SECURITY;

--
-- Name: product_dietary_tags product_dietary_tags_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_dietary_tags_manage ON public.product_dietary_tags TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_dietary_tags.product_id) AND (((p.company_id IS NULL) AND ( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role]) AS has_platform_role)) OR ((p.company_id IS NOT NULL) AND ( SELECT private.can_manage_company(p.company_id) AS can_manage_company))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_dietary_tags.product_id) AND (((p.company_id IS NULL) AND ( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role]) AS has_platform_role)) OR ((p.company_id IS NOT NULL) AND ( SELECT private.can_manage_company(p.company_id) AS can_manage_company)))))));


--
-- Name: product_dietary_tags product_dietary_tags_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_dietary_tags_select ON public.product_dietary_tags FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_dietary_tags.product_id) AND ((p.company_id IS NULL) OR ( SELECT private.can_access_company(p.company_id) AS can_access_company))))));


--
-- Name: production_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.production_days ENABLE ROW LEVEL SECURITY;

--
-- Name: production_days production_days_mutate_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY production_days_mutate_platform_admin ON public.production_days TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: production_days production_days_select_admin_scope; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY production_days_select_admin_scope ON public.production_days FOR SELECT TO authenticated USING ((public.is_platform_admin() OR (EXISTS ( SELECT 1
   FROM public.company_memberships cm
  WHERE ((cm.user_id = auth.uid()) AND (cm.role = 'company_admin'::public.membership_role) AND (cm.active = true)))) OR (EXISTS ( SELECT 1
   FROM public.location_memberships lm
  WHERE ((lm.user_id = auth.uid()) AND (lm.role = 'location_admin'::public.membership_role) AND (lm.active = true)))) OR (EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (lower(COALESCE((p.role)::text, ''::text)) = ANY (ARRAY['company_admin'::text, 'location_admin'::text, 'kitchen'::text])) AND (COALESCE(p.active, true) = true) AND (p.archived_at IS NULL) AND (p.disabled_at IS NULL))))));


--
-- Name: production_manifests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.production_manifests ENABLE ROW LEVEL SECURITY;

--
-- Name: production_manifests production_manifests_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY production_manifests_select ON public.production_manifests FOR SELECT TO authenticated USING (((public.current_profile_active() = true) AND ((public.current_profile_role() = 'superadmin'::public.user_role) OR ((public.current_profile_role() = 'company_admin'::public.user_role) AND (company_id = public.current_profile_company_id())) OR ((public.current_profile_role() = 'kitchen'::public.user_role) AND (location_id = public.current_profile_location_id())))));


--
-- Name: production_manifests production_manifests_write_superadmin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY production_manifests_write_superadmin ON public.production_manifests TO authenticated USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: products products_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_manage ON public.products TO authenticated USING ((((company_id IS NULL) AND ( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role]) AS has_platform_role)) OR ((company_id IS NOT NULL) AND ( SELECT private.can_manage_company(products.company_id) AS can_manage_company)))) WITH CHECK ((((company_id IS NULL) AND ( SELECT private.has_platform_role(ARRAY['platform_admin'::public.platform_role, 'platform_ops'::public.platform_role]) AS has_platform_role)) OR ((company_id IS NOT NULL) AND ( SELECT private.can_manage_company(products.company_id) AS can_manage_company))));


--
-- Name: products products_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING (((company_id IS NULL) OR ( SELECT private.can_access_company(products.company_id) AS can_access_company)));


--
-- Name: profile_cleanup_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_cleanup_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_cleanup_audit profile_cleanup_audit_mutate_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_cleanup_audit_mutate_platform_admin ON public.profile_cleanup_audit TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: profile_cleanup_audit profile_cleanup_audit_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_cleanup_audit_select_platform_admin ON public.profile_cleanup_audit FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: profile_scope_legacy_write_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_scope_legacy_write_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_scope_legacy_write_audit profile_scope_legacy_write_audit_mutate_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_scope_legacy_write_audit_mutate_platform_admin ON public.profile_scope_legacy_write_audit TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: profile_scope_legacy_write_audit profile_scope_legacy_write_audit_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_scope_legacy_write_audit_select_platform_admin ON public.profile_scope_legacy_write_audit FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_delete_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_delete_none ON public.profiles FOR DELETE TO authenticated USING (false);


--
-- Name: profiles profiles_insert_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_none ON public.profiles FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: profiles profiles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (( SELECT private.can_view_profile(profiles.id) AS can_view_profile));


--
-- Name: profiles profiles_select_authenticated_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_authenticated_scoped ON public.profiles FOR SELECT TO authenticated USING (((COALESCE(active, true) = true) AND ((id = auth.uid()) OR public.is_platform_admin() OR ((company_id IS NOT NULL) AND public.can_admin_company(company_id)))));


--
-- Name: profiles profiles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_platform_admin() AS is_platform_admin))) WITH CHECK (((id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.is_platform_admin() AS is_platform_admin)));


--
-- Name: profiles profiles_update_authenticated_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_authenticated_scoped ON public.profiles FOR UPDATE TO authenticated USING (((COALESCE(active, true) = true) AND ((id = auth.uid()) OR public.is_platform_admin() OR ((company_id IS NOT NULL) AND public.can_admin_company(company_id))))) WITH CHECK (((COALESCE(active, true) = true) AND ((id = auth.uid()) OR public.is_platform_admin() OR ((company_id IS NOT NULL) AND public.can_admin_company(company_id) AND (lower(COALESCE((role)::text, ''::text)) <> 'superadmin'::text)))));


--
-- Name: repair_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.repair_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: repair_jobs repair_jobs_delete_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_jobs_delete_none ON public.repair_jobs FOR DELETE TO authenticated USING (false);


--
-- Name: repair_jobs repair_jobs_insert_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_jobs_insert_none ON public.repair_jobs FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: repair_jobs repair_jobs_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_jobs_select_platform_admin ON public.repair_jobs FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: repair_jobs repair_jobs_update_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repair_jobs_update_none ON public.repair_jobs FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: social_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: standing_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.standing_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: standing_orders standing_orders_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY standing_orders_delete ON public.standing_orders FOR DELETE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.can_manage_location(standing_orders.location_id) AS can_manage_location)));


--
-- Name: standing_orders standing_orders_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY standing_orders_insert ON public.standing_orders FOR INSERT TO authenticated WITH CHECK ((((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.can_access_location(standing_orders.location_id) AS can_access_location)) OR ( SELECT private.can_manage_location(standing_orders.location_id) AS can_manage_location)));


--
-- Name: standing_orders standing_orders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY standing_orders_select ON public.standing_orders FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.can_manage_location(standing_orders.location_id) AS can_manage_location) OR ( SELECT private.can_finance_company(standing_orders.company_id) AS can_finance_company)));


--
-- Name: standing_orders standing_orders_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY standing_orders_update ON public.standing_orders FOR UPDATE TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT private.can_manage_location(standing_orders.location_id) AS can_manage_location))) WITH CHECK ((((user_id = ( SELECT auth.uid() AS uid)) AND ( SELECT private.can_access_location(standing_orders.location_id) AS can_access_location)) OR ( SELECT private.can_manage_location(standing_orders.location_id) AS can_manage_location)));


--
-- Name: agreement_cleanup_audit superadmin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superadmin_only ON public.agreement_cleanup_audit USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::public.user_role)))));


--
-- Name: agreement_requests superadmin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superadmin_only ON public.agreement_requests USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::public.user_role)))));


--
-- Name: content_page_variants superadmin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superadmin_only ON public.content_page_variants USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::public.user_role)))));


--
-- Name: content_pages superadmin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superadmin_only ON public.content_pages USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::public.user_role)))));


--
-- Name: lead_pipeline superadmin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superadmin_only ON public.lead_pipeline USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::public.user_role)))));


--
-- Name: social_posts superadmin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY superadmin_only ON public.social_posts USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superadmin'::public.user_role)))));


--
-- Name: system_health_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_health_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: system_health_snapshots system_health_snapshots_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_health_snapshots_select_platform_admin ON public.system_health_snapshots FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: system_incidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: system_incidents system_incidents_delete_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_incidents_delete_none ON public.system_incidents FOR DELETE TO authenticated USING (false);


--
-- Name: system_incidents system_incidents_insert_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_incidents_insert_none ON public.system_incidents FOR INSERT TO authenticated WITH CHECK (false);


--
-- Name: system_incidents system_incidents_select_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_incidents_select_platform_admin ON public.system_incidents FOR SELECT TO authenticated USING (public.is_platform_admin());


--
-- Name: system_incidents system_incidents_update_none; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_incidents_update_none ON public.system_incidents FOR UPDATE TO authenticated USING (false) WITH CHECK (false);


--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings system_settings_platform_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_settings_platform_admin_all ON public.system_settings TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: tripletex_customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tripletex_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: tripletex_customers tripletex_customers_mutate_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tripletex_customers_mutate_platform_admin ON public.tripletex_customers TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: tripletex_customers tripletex_customers_select_company_admin_or_platform; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tripletex_customers_select_company_admin_or_platform ON public.tripletex_customers FOR SELECT TO authenticated USING ((public.is_platform_admin() OR public.can_admin_company(company_id)));


--
-- Name: tripletex_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tripletex_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: tripletex_invoices tripletex_invoices_mutate_platform_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tripletex_invoices_mutate_platform_admin ON public.tripletex_invoices TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());


--
-- Name: tripletex_invoices tripletex_invoices_select_company_admin_or_platform; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tripletex_invoices_select_company_admin_or_platform ON public.tripletex_invoices FOR SELECT TO authenticated USING ((public.is_platform_admin() OR public.can_admin_company(company_id)));


--
-- PostgreSQL database dump complete
--

\unrestrict SsJ1Nh0mmke9fDnVG6dFItFMW4EexbDQH6SOFoZhZFGDp0snTlC739T6HkeojLb

