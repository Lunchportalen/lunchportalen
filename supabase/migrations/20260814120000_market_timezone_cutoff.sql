-- GLOBAL RELEASE GATE (Fase F/G): market/location timezone-aware order cutoff.
--
-- Protected Golden Path Impact: replaces lp_order_set + tg_orders_cutoff_0800
-- cutoff computation. Semantics for NO are UNCHANGED (Europe/Oslo, 08:00) because
-- lp_company_cutoff_context falls back to exactly that when no market/company
-- timezone is configured. Regression cover: npm run test:golden-path +
-- tests/db/marketCutoffContext.test.ts. Rollback: re-apply function bodies from
-- 20260612120000 (lp_order_set) and 20260713120000 (tg_orders_cutoff_0800).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Cutoff context resolver (fail-closed to Europe/Oslo 08:00)
--    Priority: companies.timezone → markets.default_timezone (via billing_country)
--    Cutoff time: markets.cutoff_local_time (via billing_country) → 08:00
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_company_cutoff_context(p_company_id uuid)
RETURNS TABLE (tz text, cutoff_at time)
LANGUAGE plpgsql
STABLE
SET search_path TO public
AS $$
DECLARE
  v_company_tz text;
  v_country text;
  v_market_tz text;
  v_market_cutoff time;
BEGIN
  SELECT NULLIF(trim(c.timezone), ''), NULLIF(upper(trim(c.billing_country)), '')
    INTO v_company_tz, v_country
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_country IS NOT NULL THEN
    SELECT m.default_timezone, m.cutoff_local_time
      INTO v_market_tz, v_market_cutoff
    FROM public.markets m
    WHERE m.country_code = v_country
    ORDER BY m.locale
    LIMIT 1;
  END IF;

  tz := COALESCE(v_company_tz, v_market_tz, 'Europe/Oslo');
  cutoff_at := COALESCE(v_market_cutoff, time '08:00');

  -- Fail-closed: invalid timezone names must never break order writes.
  BEGIN
    PERFORM timezone(tz, now());
  EXCEPTION WHEN OTHERS THEN
    tz := 'Europe/Oslo';
  END;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.lp_company_cutoff_context(uuid) IS
  'Order cutoff context per company: company timezone → market default (billing_country) → Europe/Oslo; cutoff time per market → 08:00.';

GRANT EXECUTE ON FUNCTION public.lp_company_cutoff_context(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) lp_order_set — identical to 20260612120000 except the cutoff block now
--    resolves timezone/cutoff via lp_company_cutoff_context (after profile load).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_order_set(p_date date, p_action text, p_note text DEFAULT NULL::text, p_slot text DEFAULT NULL::text, p_choice_key text DEFAULT NULL::text, p_item_key text DEFAULT 'default'::text) RETURNS jsonb
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

  v_cutoff_tz text := 'Europe/Oslo';
  v_cutoff_time time := time '08:00';
  v_local_today date;
  v_local_time time;

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
  v_slug_msdi text;

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

  -- Market/location timezone-aware cutoff (NO unchanged: Europe/Oslo 08:00).
  select ctx.tz, ctx.cutoff_at
    into v_cutoff_tz, v_cutoff_time
  from public.lp_company_cutoff_context(v_profile.company_id) ctx;

  v_local_today := (timezone(v_cutoff_tz, now()))::date;
  v_local_time := (timezone(v_cutoff_tz, now()))::time;

  if p_date < v_local_today then
    raise exception using errcode = 'P0001', message = 'CUTOFF_PASSED';
  end if;

  if p_date = v_local_today and v_local_time >= v_cutoff_time then
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
      delete from public.day_choices dc
      where dc.company_id = v_profile.company_id
        and dc.location_id = v_profile.location_id
        and dc.user_id = v_uid
        and dc.date = p_date;

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

  -- App/API choice_key "varmmat" (ORDER_CHOICE_KEY_BY_CATEGORY) maps to product_categories slug
  -- "varmrett" (name "Varmrett") for MSDI lookup only. day_choices keeps v_choice_raw (e.g. varmmat).
  v_slug_msdi := v_slug_choice;
  if v_slug_msdi = 'varmmat' then
    v_slug_msdi := 'varmrett';
  end if;

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

  -- item_key is CMS-validated variant slug (day_choices); NOT products.sku (one SKU per category in MSDI).
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
    ) = v_slug_msdi
    and (
      v_expect_cents is null
      or msdi.offered_price_cents_ex_vat = v_expect_cents
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
      ) = v_slug_msdi
      and (
        v_expect_cents is null
        or msdi.offered_price_cents_ex_vat = v_expect_cents
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

-- ---------------------------------------------------------------------------
-- 3) Cutoff trigger — same guard, market/company timezone-aware.
--    (Function name kept for trigger-binding stability; "0800" is now the
--    default cutoff, actual time comes from lp_company_cutoff_context.)
-- ---------------------------------------------------------------------------
create or replace function public.tg_orders_cutoff_0800() returns trigger
    language plpgsql
    set search_path to public
    as $$
declare
  role public.user_role;
  v_tz text := 'Europe/Oslo';
  v_cutoff time := time '08:00';
  today date;
  now_t time;
begin
  if coalesce(current_setting('app.batch_derived_advance', true), '') = '1' then
    return new;
  end if;

  role := (select coalesce((select p.role from public.profiles p where p.id=auth.uid()), 'employee'::public.user_role));
  if role='superadmin' then return new; end if;

  select ctx.tz, ctx.cutoff_at into v_tz, v_cutoff
  from public.lp_company_cutoff_context(new.company_id) ctx;

  today := (timezone(v_tz, now()))::date;
  now_t := (timezone(v_tz, now()))::time;

  if new.date < today then
    raise exception 'orders locked: cannot write past' using errcode='23514';
  end if;

  if new.date = today and now_t >= v_cutoff then
    raise exception 'orders locked after % local cutoff for today', v_cutoff using errcode='23514';
  end if;

  return new;
end;
$$;

COMMIT;
