-- FASE 13-IMPL-3A — lp_order_set + order_items + day_choices + MVA desimal (0.15)
-- STOPP: kjør mot prod først etter eksplisitt review/godkjenning.
--
-- Blokker (data): hvis menu_service_day_items er tom for et menu_service_day kan SET ikke prises.
-- Synk meny til DB (webhook/cron/seed) før end-to-end-test av ordrelinjer.
--
-- Konvensjon: menu_service_day_items.vat_rate_snapshot og order_items.vat_rate_snapshot som DESIMAL (0.15).
-- Backfill: verdier >= 1 tolkes som prosentpoeng (15) og normaliseres til 0.15.

begin;

-- ── VAT snapshot normalisering (desimal 0.15) ─────────────────────────────
update public.menu_service_day_items
set vat_rate_snapshot = case
    when vat_rate_snapshot is null then 0.15
    when vat_rate_snapshot >= 1 then round((vat_rate_snapshot / 100.0)::numeric, 4)
    else round(vat_rate_snapshot::numeric, 4)
  end
where vat_rate_snapshot is null
   or vat_rate_snapshot >= 1;

update public.order_items
set vat_rate_snapshot = case
    when vat_rate_snapshot is null then 0.15
    when vat_rate_snapshot >= 1 then round((vat_rate_snapshot / 100.0)::numeric, 4)
    else round(vat_rate_snapshot::numeric, 4)
  end
where vat_rate_snapshot is null
   or vat_rate_snapshot >= 1;

create or replace function public.tg_order_item_snapshot()
returns trigger
language plpgsql
set search_path to ''
as $function$
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
$function$;

drop function if exists public.lp_order_set(date, text, text, text);

create or replace function public.lp_order_set(
  p_date date,
  p_action text,
  p_note text default null,
  p_slot text default null,
  p_choice_key text default null,
  p_item_key text default 'default'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
$function$;

revoke all on function public.lp_order_set(date, text, text, text, text, text) from public;
revoke all on function public.lp_order_set(date, text, text, text, text, text) from anon;
grant execute on function public.lp_order_set(date, text, text, text, text, text) to authenticated;
grant execute on function public.lp_order_set(date, text, text, text, text, text) to service_role;
grant execute on function public.lp_order_set(date, text, text, text, text, text) to postgres;

notify pgrst, 'reload schema';

commit;
