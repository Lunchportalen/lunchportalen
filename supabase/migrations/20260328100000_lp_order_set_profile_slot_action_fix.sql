-- Align public.lp_order_set (4-arg) with canonical schema:
-- - profiles.id = auth.uid() (profiles.user_id may not exist)
-- - orders.slot check allows only 'default'; coerce legacy 'lunch' -> 'default'
-- - Accept SET/PLACE as aliases for ORDER (app + rpcWrite use SET)
begin;

create or replace function public.lp_order_set(
  p_date date,
  p_action text,
  p_note text default null,
  p_slot text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
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

  v_order_id uuid;
  v_saved_status text;
  v_receipt timestamptz := clock_timestamp();
  v_rid text := format('rid_%s', replace(gen_random_uuid()::text, '-', ''));

  v_status_out text;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  if p_date is null then
    raise exception using errcode = 'P0001', message = 'DATE_REQUIRED';
  end if;

  if v_action in ('SET', 'PLACE') then
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
          and regexp_replace(d.v::text, '\\s', '', 'g') = v_isodow::text
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
          '[,\\s]+'
        ) as token(v)
        where token.v in (v_day_key, v_isodow::text)
      )
    )
  ) then
    raise exception using errcode = 'P0001', message = 'OUTSIDE_DELIVERY_DAYS';
  end if;

  v_db_status := case
    when v_action = 'ORDER' then 'ACTIVE'
    else 'CANCELLED'
  end;

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
    case when v_action = 'ORDER' then v_note else null end,
    now()
  )
  on conflict (user_id, date, slot)
  do update set
    company_id = excluded.company_id,
    location_id = excluded.location_id,
    status = excluded.status,
    note = excluded.note,
    updated_at = now()
  returning id, status::text into v_order_id, v_saved_status;

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
      'action', v_action,
      'order_id', v_order_id,
      'company_id', v_profile.company_id,
      'location_id', v_profile.location_id,
      'user_id', v_uid,
      'date', p_date,
      'slot', v_slot,
      'status', v_saved_status,
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
    when upper(v_saved_status) in ('ACTIVE', 'ORDERED') then 'ORDERED'
    else 'CANCELED'
  end;

  return jsonb_build_object(
    'order_id', v_order_id,
    'status', v_status_out,
    'company_id', v_profile.company_id,
    'location_id', v_profile.location_id,
    'date', p_date,
    'slot', v_slot,
    'receipt', v_receipt,
    'rid', v_rid
  );
end;
$$;

revoke all on function public.lp_order_set(date, text, text, text) from public;
revoke all on function public.lp_order_set(date, text, text, text) from anon;
grant execute on function public.lp_order_set(date, text, text, text) to authenticated;
grant execute on function public.lp_order_set(date, text, text, text) to service_role;
grant execute on function public.lp_order_set(date, text, text, text) to postgres;

notify pgrst, 'reload schema';

commit;
