


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."agreement_status" AS ENUM (
    'PENDING',
    'ACTIVE',
    'PAUSED',
    'CLOSED'
);


ALTER TYPE "public"."agreement_status" OWNER TO "postgres";


CREATE TYPE "public"."agreement_tier" AS ENUM (
    'BASIS',
    'LUXUS'
);


ALTER TYPE "public"."agreement_tier" OWNER TO "postgres";


CREATE TYPE "public"."company_status" AS ENUM (
    'PENDING',
    'ACTIVE',
    'PAUSED',
    'CLOSED'
);


ALTER TYPE "public"."company_status" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'ACTIVE',
    'CANCELED',
    'CANCELLED'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'employee',
    'company_admin',
    'superadmin',
    'kitchen',
    'driver'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."repair_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "state" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "next_run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "rid" "text"
);


ALTER TABLE "public"."repair_jobs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_repair_jobs"("p_limit" integer) RETURNS SETOF "public"."repair_jobs"
    LANGUAGE "sql"
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


ALTER FUNCTION "public"."claim_repair_jobs"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lp_agreement_approve"("p_agreement_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
begin
  return public.lp_agreement_approve_active(p_agreement_id, auth.uid());
end
$$;


ALTER FUNCTION "public"."lp_agreement_approve"("p_agreement_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lp_agreement_approve_active"("p_agreement_id" "uuid", "p_actor_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_agreement public.agreements%rowtype;
  v_company_status public.company_status;
  v_now timestamptz := clock_timestamp();
begin
  if p_agreement_id is null then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_ID_REQUIRED';
  end if;

  select a.*
    into v_agreement
  from public.agreements a
  where a.id = p_agreement_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'AGREEMENT_NOT_FOUND';
  end if;

  if v_agreement.status <> 'PENDING'::public.agreement_status then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_NOT_PENDING';
  end if;

  select c.status
    into v_company_status
  from public.companies c
  where c.id = v_agreement.company_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'COMPANY_NOT_FOUND';
  end if;

  update public.agreements
     set status = 'ACTIVE'::public.agreement_status,
         updated_at = now()
   where id = v_agreement.id;

  if v_company_status in ('PENDING'::public.company_status, 'PAUSED'::public.company_status) then
    update public.companies
       set status = 'ACTIVE'::public.company_status,
           updated_at = now()
     where id = v_agreement.company_id;
  end if;

  insert into public.outbox (
    event_key,
    payload,
    status,
    attempts,
    last_error,
    locked_at,
    locked_by,
    next_retry_at,
    delivered_at
  )
  values (
    format('agreement.activated:%s', v_agreement.id::text),
    jsonb_build_object(
      'event', 'agreement.activated',
      'agreementId', v_agreement.id,
      'companyId', v_agreement.company_id,
      'actorUserId', p_actor_user_id,
      'receipt', v_now
    ),
    'PENDING',
    0,
    null,
    null,
    null,
    null,
    null
  )
  on conflict (event_key) do nothing;

  insert into public.outbox (
    event_key,
    payload,
    status,
    attempts,
    last_error,
    locked_at,
    locked_by,
    next_retry_at,
    delivered_at
  )
  values (
    format('company.activated:%s', v_agreement.company_id::text),
    jsonb_build_object(
      'event', 'company.activated',
      'agreementId', v_agreement.id,
      'companyId', v_agreement.company_id,
      'actorUserId', p_actor_user_id,
      'receipt', v_now
    ),
    'PENDING',
    0,
    null,
    null,
    null,
    null,
    null
  )
  on conflict (event_key) do nothing;

  return jsonb_build_object(
    'agreement_id', v_agreement.id,
    'company_id', v_agreement.company_id,
    'status', 'ACTIVE',
    'receipt', v_now
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'ACTIVE_AGREEMENT_EXISTS';
end
$$;


ALTER FUNCTION "public"."lp_agreement_approve_active"("p_agreement_id" "uuid", "p_actor_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lp_agreement_create_pending"("p_company_id" "uuid", "p_location_id" "uuid" DEFAULT NULL::"uuid", "p_tier" "text" DEFAULT 'BASIS'::"text", "p_delivery_days" "jsonb" DEFAULT '["mon", "tue", "wed", "thu", "fri"]'::"jsonb", "p_slot_start" time without time zone DEFAULT '11:00:00'::time without time zone, "p_slot_end" time without time zone DEFAULT '13:00:00'::time without time zone, "p_starts_at" "date" DEFAULT NULL::"date", "p_binding_months" integer DEFAULT 12, "p_notice_months" integer DEFAULT 3, "p_price_per_employee" numeric DEFAULT NULL::numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_company_id uuid;
  v_location_id uuid;
  v_tier text := upper(trim(coalesce(p_tier, '')));
  v_binding integer := coalesce(p_binding_months, 12);
  v_notice integer := coalesce(p_notice_months, 3);
  v_price numeric := p_price_per_employee;
  v_delivery jsonb := coalesce(p_delivery_days, '[]'::jsonb);
  v_days text[];
  v_agreement_id uuid;
begin
  if p_company_id is null then
    raise exception using errcode = 'P0001', message = 'COMPANY_ID_REQUIRED';
  end if;

  select c.id
    into v_company_id
  from public.companies c
  where c.id = p_company_id
  for update;

  if v_company_id is null then
    raise exception using errcode = 'P0002', message = 'COMPANY_NOT_FOUND';
  end if;

  if p_location_id is null then
    select cl.id
      into v_location_id
    from public.company_locations cl
    where cl.company_id = p_company_id
    order by cl.created_at asc
    limit 1;

    if v_location_id is null then
      raise exception using errcode = 'P0001', message = 'LOCATION_REQUIRED';
    end if;
  else
    select cl.id
      into v_location_id
    from public.company_locations cl
    where cl.id = p_location_id
      and cl.company_id = p_company_id
    limit 1;

    if v_location_id is null then
      raise exception using errcode = 'P0001', message = 'LOCATION_INVALID';
    end if;
  end if;

  if v_tier not in ('BASIS', 'LUXUS') then
    raise exception using errcode = 'P0001', message = 'TIER_INVALID';
  end if;

  if p_starts_at is null then
    raise exception using errcode = 'P0001', message = 'STARTS_AT_REQUIRED';
  end if;

  if p_slot_start is null or p_slot_end is null or p_slot_start >= p_slot_end then
    raise exception using errcode = 'P0001', message = 'SLOT_RANGE_INVALID';
  end if;

  if v_binding <= 0 then
    raise exception using errcode = 'P0001', message = 'BINDING_MONTHS_INVALID';
  end if;

  if v_notice < 0 then
    raise exception using errcode = 'P0001', message = 'NOTICE_MONTHS_INVALID';
  end if;

  if v_price is null or v_price <= 0 then
    raise exception using errcode = 'P0001', message = 'PRICE_PER_EMPLOYEE_INVALID';
  end if;

  if jsonb_typeof(v_delivery) <> 'array' then
    raise exception using errcode = 'P0001', message = 'DELIVERY_DAYS_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(v_delivery) d(v)
    where lower(trim(d.v)) not in ('mon', 'tue', 'wed', 'thu', 'fri')
  ) then
    raise exception using errcode = 'P0001', message = 'DELIVERY_DAYS_INVALID';
  end if;

  select array_agg(day_key order by ord)
    into v_days
  from (
    select distinct
      case lower(trim(d.v))
        when 'mon' then 'mon'
        when 'tue' then 'tue'
        when 'wed' then 'wed'
        when 'thu' then 'thu'
        when 'fri' then 'fri'
      end as day_key,
      case lower(trim(d.v))
        when 'mon' then 1
        when 'tue' then 2
        when 'wed' then 3
        when 'thu' then 4
        when 'fri' then 5
      end as ord
    from jsonb_array_elements_text(v_delivery) d(v)
  ) x
  where day_key is not null;

  if coalesce(array_length(v_days, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'DELIVERY_DAYS_REQUIRED';
  end if;

  insert into public.agreements (
    company_id,
    location_id,
    tier,
    status,
    delivery_days,
    slot_start,
    slot_end,
    starts_at,
    binding_months,
    notice_months,
    price_per_employee
  )
  values (
    p_company_id,
    v_location_id,
    v_tier::public.agreement_tier,
    'PENDING'::public.agreement_status,
    to_jsonb(v_days),
    p_slot_start,
    p_slot_end,
    p_starts_at,
    v_binding,
    v_notice,
    v_price
  )
  returning id into v_agreement_id;

  return jsonb_build_object(
    'agreement_id', v_agreement_id,
    'company_id', p_company_id,
    'status', 'PENDING'
  );
end
$$;


ALTER FUNCTION "public"."lp_agreement_create_pending"("p_company_id" "uuid", "p_location_id" "uuid", "p_tier" "text", "p_delivery_days" "jsonb", "p_slot_start" time without time zone, "p_slot_end" time without time zone, "p_starts_at" "date", "p_binding_months" integer, "p_notice_months" integer, "p_price_per_employee" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lp_company_register"("p_orgnr" "text", "p_company_name" "text", "p_employee_count" integer, "p_contact_name" "text", "p_contact_email" "text", "p_contact_phone" "text", "p_address_line" "text", "p_postal_code" "text", "p_postal_city" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $_$
declare
  v_company_id uuid;
  v_status public.company_status;
  v_now timestamptz := clock_timestamp();

  v_orgnr text := regexp_replace(btrim(coalesce(p_orgnr, '')), '\D', '', 'g');
  v_company_name text := btrim(coalesce(p_company_name, ''));
  v_contact_name text := btrim(coalesce(p_contact_name, ''));
  v_contact_email text := lower(btrim(coalesce(p_contact_email, '')));
  v_contact_phone text := btrim(coalesce(p_contact_phone, ''));
  v_address_line text := btrim(coalesce(p_address_line, ''));
  v_postal_code text := regexp_replace(btrim(coalesce(p_postal_code, '')), '\D', '', 'g');
  v_postal_city text := btrim(coalesce(p_postal_city, ''));
begin
  if length(v_orgnr) <> 9 then
    raise exception using errcode = 'P0001', message = 'ORGNR_INVALID';
  end if;

  if v_company_name = '' then
    raise exception using errcode = 'P0001', message = 'COMPANY_NAME_REQUIRED';
  end if;

  if p_employee_count is null or p_employee_count < 20 then
    raise exception using errcode = 'P0001', message = 'EMPLOYEE_COUNT_MIN_20';
  end if;

  if v_contact_name = '' then
    raise exception using errcode = 'P0001', message = 'CONTACT_NAME_REQUIRED';
  end if;

  if v_contact_email = '' then
    raise exception using errcode = 'P0001', message = 'CONTACT_EMAIL_REQUIRED';
  end if;

  if not (v_contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception using errcode = 'P0001', message = 'CONTACT_EMAIL_INVALID';
  end if;

  if v_contact_phone = '' then
    raise exception using errcode = 'P0001', message = 'CONTACT_PHONE_REQUIRED';
  end if;

  if v_address_line = '' then
    raise exception using errcode = 'P0001', message = 'ADDRESS_LINE_REQUIRED';
  end if;

  if v_postal_code !~ '^[0-9]{4}$' then
    raise exception using errcode = 'P0001', message = 'POSTAL_CODE_INVALID';
  end if;

  if v_postal_city = '' then
    raise exception using errcode = 'P0001', message = 'POSTAL_CITY_REQUIRED';
  end if;

  select c.id, c.status
    into v_company_id, v_status
  from public.companies c
  where c.orgnr = v_orgnr
  limit 1
  for update;

  if v_company_id is null then
    insert into public.companies (
      orgnr,
      name,
      status,
      employee_count,
      contact_name,
      contact_email,
      contact_phone,
      address,
      address_line,
      postal_code,
      postal_city
    )
    values (
      v_orgnr,
      v_company_name,
      'PENDING'::public.company_status,
      p_employee_count,
      v_contact_name,
      v_contact_email,
      v_contact_phone,
      v_address_line,
      v_address_line,
      v_postal_code,
      v_postal_city
    )
    returning id, status
      into v_company_id, v_status;
  else
    update public.companies c
       set
         name = case
           when (c.name is null or btrim(c.name) = '') and v_company_name <> '' then v_company_name
           else c.name
         end,
         employee_count = case
           when c.employee_count is null then p_employee_count
           else c.employee_count
         end,
         contact_name = case
           when (c.contact_name is null or btrim(c.contact_name) = '') and v_contact_name <> '' then v_contact_name
           else c.contact_name
         end,
         contact_email = case
           when (c.contact_email is null or btrim(c.contact_email) = '') and v_contact_email <> '' then v_contact_email
           else c.contact_email
         end,
         contact_phone = case
           when (c.contact_phone is null or btrim(c.contact_phone) = '') and v_contact_phone <> '' then v_contact_phone
           else c.contact_phone
         end,
         address_line = case
           when (c.address_line is null or btrim(c.address_line) = '') and v_address_line <> '' then v_address_line
           else c.address_line
         end,
         address = case
           when (c.address is null or btrim(c.address) = '') and v_address_line <> '' then v_address_line
           else c.address
         end,
         postal_code = case
           when (c.postal_code is null or btrim(c.postal_code) = '') and v_postal_code <> '' then v_postal_code
           else c.postal_code
         end,
         postal_city = case
           when (c.postal_city is null or btrim(c.postal_city) = '') and v_postal_city <> '' then v_postal_city
           else c.postal_city
         end,
         updated_at = now()
     where c.id = v_company_id
     returning status into v_status;
  end if;

  insert into public.outbox (
    event_key,
    payload,
    status,
    attempts,
    last_error,
    locked_at,
    locked_by,
    next_retry_at,
    delivered_at
  )
  values (
    format('company.registered:%s', v_company_id::text),
    jsonb_build_object(
      'event', 'company.registered',
      'companyId', v_company_id,
      'orgnr', v_orgnr,
      'companyName', v_company_name,
      'employeeCount', p_employee_count,
      'contactName', v_contact_name,
      'contactEmail', v_contact_email,
      'contactPhone', v_contact_phone,
      'addressLine', v_address_line,
      'postalCode', v_postal_code,
      'postalCity', v_postal_city,
      'receipt', v_now
    ),
    'PENDING',
    0,
    null,
    null,
    null,
    null,
    null
  )
  on conflict (event_key) do nothing;

  return jsonb_build_object(
    'company_id', v_company_id,
    'status', v_status,
    'receipt', v_now
  );
end
$_$;


ALTER FUNCTION "public"."lp_company_register"("p_orgnr" "text", "p_company_name" "text", "p_employee_count" integer, "p_contact_name" "text", "p_contact_email" "text", "p_contact_phone" "text", "p_address_line" "text", "p_postal_code" "text", "p_postal_city" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lp_order_set"("p_date" "date", "p_action" "text", "p_note" "text" DEFAULT NULL::"text", "p_slot" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_company_id uuid;
  v_location_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  select p.company_id, p.location_id
    into v_company_id, v_location_id
  from public.profiles p
  where p.id = v_uid
  order by p.updated_at desc
  limit 1;

  if v_company_id is null or v_location_id is null then
    raise exception using errcode = 'P0001', message = 'PROFILE_MISSING';
  end if;

  return public.lp_order_set(
    v_uid,
    v_company_id,
    v_location_id,
    p_date,
    p_action,
    p_note,
    p_slot
  );
end
$$;


ALTER FUNCTION "public"."lp_order_set"("p_date" "date", "p_action" "text", "p_note" "text", "p_slot" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lp_order_set"("p_user_id" "uuid", "p_company_id" "uuid", "p_location_id" "uuid", "p_date" "date", "p_action" "text", "p_note" "text" DEFAULT NULL::"text", "p_slot" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_actor_uid uuid := auth.uid();
  v_profile_company_id uuid;
  v_profile_location_id uuid;
  v_agreement public.agreements%rowtype;

  v_action text := upper(trim(coalesce(p_action, '')));
  v_slot text := coalesce(nullif(trim(coalesce(p_slot, '')), ''), 'default');
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_db_status text;

  v_oslo_now timestamptz := timezone('Europe/Oslo', now());
  v_oslo_today date := (timezone('Europe/Oslo', now()))::date;
  v_oslo_time time := (timezone('Europe/Oslo', now()))::time;
  v_cutoff_passed boolean := false;

  v_isodow int;
  v_day_key text;
  v_order_id uuid;
  v_saved_status text;
  v_receipt timestamptz := clock_timestamp();
  v_rid text := format('rid_%s', replace(gen_random_uuid()::text, '-', ''));
  v_changed boolean := false;
begin
  if v_actor_uid is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHENTICATED';
  end if;

  if p_user_id is null or p_company_id is null or p_location_id is null then
    raise exception using errcode = 'P0001', message = 'SCOPE_REQUIRED';
  end if;

  if p_user_id <> v_actor_uid then
    raise exception using errcode = 'P0001', message = 'SCOPE_FORBIDDEN';
  end if;

  if p_date is null then
    raise exception using errcode = 'P0001', message = 'DATE_REQUIRED';
  end if;

  if v_action in ('ORDER', 'SET', 'PLACE') then
    v_action := 'SET';
  elsif v_action = 'CANCEL' then
    v_action := 'CANCEL';
  else
    raise exception using errcode = 'P0001', message = 'ACTION_INVALID';
  end if;

  select p.company_id, p.location_id
    into v_profile_company_id, v_profile_location_id
  from public.profiles p
  where p.id = p_user_id
  order by p.updated_at desc
  limit 1;

  if v_profile_company_id is null or v_profile_location_id is null then
    raise exception using errcode = 'P0001', message = 'PROFILE_MISSING';
  end if;

  if v_profile_company_id <> p_company_id or v_profile_location_id <> p_location_id then
    raise exception using errcode = 'P0001', message = 'SCOPE_FORBIDDEN';
  end if;

  if p_date < v_oslo_today then
    v_cutoff_passed := true;
  elsif p_date = v_oslo_today and v_oslo_time >= time '08:00' then
    v_cutoff_passed := true;
  end if;

  if v_cutoff_passed then
    raise exception using errcode = 'P0001', message = 'CUTOFF_PASSED';
  end if;

  select a.*
    into v_agreement
  from public.agreements a
  where a.company_id = p_company_id
    and a.location_id = p_location_id
    and upper(a.status::text) = 'ACTIVE'
  order by coalesce(a.starts_at, '-infinity'::date) desc, a.updated_at desc
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

  v_db_status := case
    when v_action = 'SET' then 'ACTIVE'
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
    p_user_id,
    p_company_id,
    p_location_id,
    p_date,
    v_slot,
    v_db_status::public.order_status,
    case when v_action = 'SET' then v_note else null end,
    now()
  )
  on conflict (user_id, date, slot)
  do update set
    company_id = excluded.company_id,
    location_id = excluded.location_id,
    status = excluded.status,
    note = excluded.note,
    updated_at = now()
  where
    public.orders.company_id is distinct from excluded.company_id
    or public.orders.location_id is distinct from excluded.location_id
    or public.orders.status is distinct from excluded.status
    or public.orders.note is distinct from excluded.note
  returning id, status::text into v_order_id, v_saved_status;

  if v_order_id is null then
    select o.id, o.status::text
      into v_order_id, v_saved_status
    from public.orders o
    where o.user_id = p_user_id
      and o.company_id = p_company_id
      and o.location_id = p_location_id
      and o.date = p_date
      and o.slot = v_slot
    limit 1;
    v_changed := false;
  else
    v_changed := true;
  end if;

  if v_changed then
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
      format('order.changed:%s', v_order_id::text),
      jsonb_build_object(
        'event', 'order.changed',
        'action', v_action,
        'orderId', v_order_id,
        'companyId', p_company_id,
        'locationId', p_location_id,
        'userId', p_user_id,
        'date', p_date,
        'slot', v_slot,
        'status', upper(v_saved_status),
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
  else
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
      format('order.changed:%s', v_order_id::text),
      jsonb_build_object(
        'event', 'order.changed',
        'action', v_action,
        'orderId', v_order_id,
        'companyId', p_company_id,
        'locationId', p_location_id,
        'userId', p_user_id,
        'date', p_date,
        'slot', v_slot,
        'status', upper(v_saved_status),
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
    on conflict (event_key) do nothing;
  end if;

  return jsonb_build_object(
    'order_id', v_order_id,
    'status', upper(v_saved_status),
    'company_id', p_company_id,
    'location_id', p_location_id,
    'date', p_date,
    'slot', v_slot,
    'receipt', v_receipt,
    'cutoff_passed', false,
    'rid', v_rid
  );
end
$$;


ALTER FUNCTION "public"."lp_order_set"("p_user_id" "uuid", "p_company_id" "uuid", "p_location_id" "uuid", "p_date" "date", "p_action" "text", "p_note" "text", "p_slot" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lp_orders_outbox_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
declare
  v_status text;
  v_kind text;
  v_event_key text;
begin
  -- enum-safe: cast enum to text, do not coalesce enum with empty string
  v_status := upper(trim(new.status::text));

  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status
       and new.note is not distinct from old.note
       and new.slot is not distinct from old.slot
       and new.date is not distinct from old.date then
      return new;
    end if;
  end if;

  -- IMPORTANT: enum is ACTIVE / CANCELED (one L) in this database
  if v_status not in ('ACTIVE', 'CANCELED') then
    return new;
  end if;

  v_kind := case when v_status = 'CANCELED' then 'cancel' else 'set' end;

  v_event_key := format(
    'order:%s:%s:%s:%s',
    v_kind,
    new.user_id::text,
    new.date::text,
    coalesce(new.slot, 'unknown')
  );

  insert into public.outbox (event_key, payload, status, attempts)
  values (
    v_event_key,
    jsonb_build_object(
      'eventType', case when v_kind = 'cancel' then 'ORDER_CANCELLED' else 'ORDER_PLACED' end,
      'eventKey', v_event_key,
      'userId', new.user_id,
      'companyId', new.company_id,
      'locationId', new.location_id,
      'date', new.date,
      'slot', new.slot,
      'status', v_status,
      'orderId', new.id,
      'timestampISO', now()
    ),
    'PENDING',
    0
  )
  on conflict (event_key) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."lp_orders_outbox_trigger"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agreements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "tier" "public"."agreement_tier" DEFAULT 'BASIS'::"public"."agreement_tier" NOT NULL,
    "status" "public"."agreement_status" DEFAULT 'PENDING'::"public"."agreement_status" NOT NULL,
    "delivery_days" "jsonb" DEFAULT '["mon", "tue", "wed", "thu", "fri"]'::"jsonb" NOT NULL,
    "slot_start" time without time zone DEFAULT '11:00:00'::time without time zone NOT NULL,
    "slot_end" time without time zone DEFAULT '13:00:00'::time without time zone NOT NULL,
    "starts_at" "date",
    "ends_at" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "binding_months" integer DEFAULT 12,
    "notice_months" integer DEFAULT 3,
    "price_per_employee" numeric(10,2)
);


ALTER TABLE "public"."agreements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rid" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_user_id" "uuid",
    "actor_email" "text",
    "actor_role" "text",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "text" NOT NULL,
    "company_id" "uuid",
    "location_id" "uuid",
    "summary" "text",
    "detail" "jsonb",
    "scope" "text",
    "performed_by" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."audit_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "orgnr" "text",
    "name" "text" NOT NULL,
    "status" "public"."company_status" DEFAULT 'PENDING'::"public"."company_status" NOT NULL,
    "employee_count" integer,
    "contact_name" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "delete_reason" "text",
    "enterprise_group_id" "uuid",
    "address_line" "text",
    "postal_code" "text",
    "postal_city" "text"
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_deletions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "company_name_snapshot" "text",
    "orgnr_snapshot" "text",
    "deleted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_by" "uuid",
    "reason" "text",
    "counts_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "mode" "text" DEFAULT 'archive+kill-access'::"text" NOT NULL
);


ALTER TABLE "public"."company_deletions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "slot_policy" "text",
    "status" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "company_locations_status_ck" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'PAUSED'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."company_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."enterprise_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "orgnr" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."enterprise_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."idempotency" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scope" "text" NOT NULL,
    "key" "text" NOT NULL,
    "response" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."idempotency" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scope" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "rid" "text",
    "message" "text" NOT NULL,
    "meta" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."incidents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ops_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ts" timestamp with time zone DEFAULT "now"() NOT NULL,
    "level" "text" NOT NULL,
    "event" "text" NOT NULL,
    "scope_company_id" "uuid",
    "scope_user_id" "uuid",
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "rid" "text"
);


ALTER TABLE "public"."ops_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "status" "public"."order_status" DEFAULT 'ACTIVE'::"public"."order_status" NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "slot" "text" DEFAULT 'default'::"text" NOT NULL,
    "integrity_status" "text" DEFAULT 'ok'::"text" NOT NULL,
    "integrity_reason" "text",
    "integrity_rid" "text",
    CONSTRAINT "orders_slot_ck" CHECK (("slot" = 'default'::"text"))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_key" "text" NOT NULL,
    "payload" "jsonb",
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "locked_at" timestamp with time zone,
    "locked_by" "text",
    "next_retry_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "outbox_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'PROCESSING'::"text", 'SENT'::"text", 'FAILED'::"text", 'FAILED_PERMANENT'::"text"])))
);


ALTER TABLE "public"."outbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "role" "public"."user_role" DEFAULT 'employee'::"public"."user_role" NOT NULL,
    "company_id" "uuid",
    "location_id" "uuid",
    "active" boolean DEFAULT true NOT NULL,
    "disabled_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_health_snapshots" (
    "id" bigint NOT NULL,
    "ts" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" NOT NULL,
    "checks" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "rid" "text"
);


ALTER TABLE "public"."system_health_snapshots" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."system_health_snapshots_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."system_health_snapshots_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."system_health_snapshots_id_seq" OWNED BY "public"."system_health_snapshots"."id";



CREATE TABLE IF NOT EXISTS "public"."system_incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "severity" "text" NOT NULL,
    "type" "text" NOT NULL,
    "scope_company_id" "uuid",
    "scope_user_id" "uuid",
    "scope_order_id" "uuid",
    "first_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "count" integer DEFAULT 1 NOT NULL,
    "status" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "rid" "text"
);


ALTER TABLE "public"."system_incidents" OWNER TO "postgres";


ALTER TABLE ONLY "public"."system_health_snapshots" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."system_health_snapshots_id_seq"'::"regclass");



ALTER TABLE "public"."agreements"
    ADD CONSTRAINT "agreements_binding_months_ck" CHECK ((("binding_months" IS NULL) OR ("binding_months" > 0))) NOT VALID;



ALTER TABLE "public"."agreements"
    ADD CONSTRAINT "agreements_notice_months_ck" CHECK ((("notice_months" IS NULL) OR ("notice_months" >= 0))) NOT VALID;



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."agreements"
    ADD CONSTRAINT "agreements_price_per_employee_ck" CHECK ((("price_per_employee" IS NULL) OR ("price_per_employee" > (0)::numeric))) NOT VALID;



ALTER TABLE ONLY "public"."audit_events"
    ADD CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."companies"
    ADD CONSTRAINT "companies_employee_count_min_ck" CHECK ((("employee_count" IS NULL) OR ("employee_count" >= 20))) NOT VALID;



ALTER TABLE "public"."companies"
    ADD CONSTRAINT "companies_pending_registration_fields_ck" CHECK ((("status" <> 'PENDING'::"public"."company_status") OR (("employee_count" IS NOT NULL) AND ("employee_count" >= 20) AND ("contact_name" IS NOT NULL) AND ("btrim"("contact_name") <> ''::"text") AND ("contact_email" IS NOT NULL) AND ("btrim"("contact_email") <> ''::"text") AND ("contact_phone" IS NOT NULL) AND ("btrim"("contact_phone") <> ''::"text") AND ("address_line" IS NOT NULL) AND ("btrim"("address_line") <> ''::"text") AND ("postal_code" IS NOT NULL) AND ("postal_code" ~ '^[0-9]{4}$'::"text") AND ("postal_city" IS NOT NULL) AND ("btrim"("postal_city") <> ''::"text")))) NOT VALID;



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."companies"
    ADD CONSTRAINT "companies_postal_code_format_ck" CHECK ((("postal_code" IS NULL) OR ("postal_code" ~ '^[0-9]{4}$'::"text"))) NOT VALID;



ALTER TABLE ONLY "public"."company_deletions"
    ADD CONSTRAINT "company_deletions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_locations"
    ADD CONSTRAINT "company_locations_company_name_uniq" UNIQUE ("company_id", "name");



ALTER TABLE ONLY "public"."company_locations"
    ADD CONSTRAINT "company_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enterprise_groups"
    ADD CONSTRAINT "enterprise_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."idempotency"
    ADD CONSTRAINT "idempotency_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incidents"
    ADD CONSTRAINT "incidents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ops_events"
    ADD CONSTRAINT "ops_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outbox"
    ADD CONSTRAINT "outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."repair_jobs"
    ADD CONSTRAINT "repair_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_health_snapshots"
    ADD CONSTRAINT "system_health_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_incidents"
    ADD CONSTRAINT "system_incidents_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "agreements_one_active_per_company_uk" ON "public"."agreements" USING "btree" ("company_id") WHERE ("status" = 'ACTIVE'::"public"."agreement_status");



CREATE INDEX "audit_events_action_idx" ON "public"."audit_events" USING "btree" ("action");



CREATE INDEX "audit_events_company_id_idx" ON "public"."audit_events" USING "btree" ("company_id");



CREATE INDEX "audit_events_created_at_idx" ON "public"."audit_events" USING "btree" ("created_at" DESC);



CREATE INDEX "companies_enterprise_group_id_idx" ON "public"."companies" USING "btree" ("enterprise_group_id");



CREATE UNIQUE INDEX "companies_orgnr_unique_not_null" ON "public"."companies" USING "btree" ("orgnr") WHERE ("orgnr" IS NOT NULL);



CREATE UNIQUE INDEX "company_deletions_company_id_uq" ON "public"."company_deletions" USING "btree" ("company_id");



CREATE INDEX "company_deletions_deleted_at_idx" ON "public"."company_deletions" USING "btree" ("deleted_at" DESC);



CREATE INDEX "company_locations_status_idx" ON "public"."company_locations" USING "btree" ("status");



CREATE UNIQUE INDEX "idempotency_scope_key_uq" ON "public"."idempotency" USING "btree" ("scope", "key");



CREATE INDEX "incidents_created_at_idx" ON "public"."incidents" USING "btree" ("created_at" DESC);



CREATE INDEX "incidents_scope_idx" ON "public"."incidents" USING "btree" ("scope");



CREATE INDEX "incidents_severity_idx" ON "public"."incidents" USING "btree" ("severity");



CREATE INDEX "ops_events_ts_idx" ON "public"."ops_events" USING "btree" ("ts" DESC);



CREATE INDEX "orders_company_location_date_idx" ON "public"."orders" USING "btree" ("company_id", "location_id", "date");



CREATE INDEX "orders_integrity_status_date_idx" ON "public"."orders" USING "btree" ("integrity_status", "date");



CREATE UNIQUE INDEX "orders_user_date_slot_uk" ON "public"."orders" USING "btree" ("user_id", "date", "slot");



CREATE UNIQUE INDEX "orders_user_date_slot_uq" ON "public"."orders" USING "btree" ("user_id", "date", "slot");



CREATE UNIQUE INDEX "orders_user_date_uq" ON "public"."orders" USING "btree" ("user_id", "date");



CREATE INDEX "outbox_claim_idx" ON "public"."outbox" USING "btree" ("status", "attempts", "created_at");



CREATE UNIQUE INDEX "outbox_event_key_uniq" ON "public"."outbox" USING "btree" ("event_key");



CREATE INDEX "repair_jobs_state_next_run_idx" ON "public"."repair_jobs" USING "btree" ("state", "next_run_at");



CREATE INDEX "system_health_snapshots_ts_idx" ON "public"."system_health_snapshots" USING "btree" ("ts" DESC);



CREATE INDEX "system_incidents_status_idx" ON "public"."system_incidents" USING "btree" ("status");



CREATE INDEX "system_incidents_type_idx" ON "public"."system_incidents" USING "btree" ("type");



CREATE OR REPLACE TRIGGER "orders_outbox" AFTER INSERT OR UPDATE OF "status", "note", "slot", "date" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."lp_orders_outbox_trigger"();

ALTER TABLE "public"."orders" ENABLE ALWAYS TRIGGER "orders_outbox";



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agreements"
    ADD CONSTRAINT "agreements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."company_locations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_enterprise_group_id_fkey" FOREIGN KEY ("enterprise_group_id") REFERENCES "public"."enterprise_groups"("id");



ALTER TABLE ONLY "public"."company_locations"
    ADD CONSTRAINT "company_locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."company_locations"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."company_locations"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_kitchen_driver_scope_read" ON "public"."orders" FOR SELECT TO "authenticated" USING (((NOT (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['kitchen'::"public"."user_role", 'driver'::"public"."user_role"])))))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = ANY (ARRAY['kitchen'::"public"."user_role", 'driver'::"public"."user_role"])) AND ("p"."active" = true) AND ("p"."company_id" IS NOT NULL) AND ("p"."location_id" IS NOT NULL) AND ("p"."company_id" = "orders"."company_id") AND ("p"."location_id" = "orders"."location_id"))))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TABLE "public"."repair_jobs" TO "anon";
GRANT ALL ON TABLE "public"."repair_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."repair_jobs" TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_repair_jobs"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."claim_repair_jobs"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_repair_jobs"("p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."lp_agreement_approve"("p_agreement_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lp_agreement_approve"("p_agreement_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."lp_agreement_approve_active"("p_agreement_id" "uuid", "p_actor_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lp_agreement_approve_active"("p_agreement_id" "uuid", "p_actor_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."lp_agreement_create_pending"("p_company_id" "uuid", "p_location_id" "uuid", "p_tier" "text", "p_delivery_days" "jsonb", "p_slot_start" time without time zone, "p_slot_end" time without time zone, "p_starts_at" "date", "p_binding_months" integer, "p_notice_months" integer, "p_price_per_employee" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lp_agreement_create_pending"("p_company_id" "uuid", "p_location_id" "uuid", "p_tier" "text", "p_delivery_days" "jsonb", "p_slot_start" time without time zone, "p_slot_end" time without time zone, "p_starts_at" "date", "p_binding_months" integer, "p_notice_months" integer, "p_price_per_employee" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."lp_company_register"("p_orgnr" "text", "p_company_name" "text", "p_employee_count" integer, "p_contact_name" "text", "p_contact_email" "text", "p_contact_phone" "text", "p_address_line" "text", "p_postal_code" "text", "p_postal_city" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lp_company_register"("p_orgnr" "text", "p_company_name" "text", "p_employee_count" integer, "p_contact_name" "text", "p_contact_email" "text", "p_contact_phone" "text", "p_address_line" "text", "p_postal_code" "text", "p_postal_city" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."lp_order_set"("p_date" "date", "p_action" "text", "p_note" "text", "p_slot" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lp_order_set"("p_date" "date", "p_action" "text", "p_note" "text", "p_slot" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lp_order_set"("p_date" "date", "p_action" "text", "p_note" "text", "p_slot" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."lp_order_set"("p_user_id" "uuid", "p_company_id" "uuid", "p_location_id" "uuid", "p_date" "date", "p_action" "text", "p_note" "text", "p_slot" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lp_order_set"("p_user_id" "uuid", "p_company_id" "uuid", "p_location_id" "uuid", "p_date" "date", "p_action" "text", "p_note" "text", "p_slot" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lp_order_set"("p_user_id" "uuid", "p_company_id" "uuid", "p_location_id" "uuid", "p_date" "date", "p_action" "text", "p_note" "text", "p_slot" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lp_orders_outbox_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."lp_orders_outbox_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."lp_orders_outbox_trigger"() TO "service_role";



GRANT ALL ON TABLE "public"."agreements" TO "anon";
GRANT ALL ON TABLE "public"."agreements" TO "authenticated";
GRANT ALL ON TABLE "public"."agreements" TO "service_role";



GRANT ALL ON TABLE "public"."audit_events" TO "anon";
GRANT ALL ON TABLE "public"."audit_events" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_events" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_deletions" TO "anon";
GRANT ALL ON TABLE "public"."company_deletions" TO "authenticated";
GRANT ALL ON TABLE "public"."company_deletions" TO "service_role";



GRANT ALL ON TABLE "public"."company_locations" TO "anon";
GRANT ALL ON TABLE "public"."company_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."company_locations" TO "service_role";



GRANT ALL ON TABLE "public"."enterprise_groups" TO "anon";
GRANT ALL ON TABLE "public"."enterprise_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."enterprise_groups" TO "service_role";



GRANT ALL ON TABLE "public"."idempotency" TO "anon";
GRANT ALL ON TABLE "public"."idempotency" TO "authenticated";
GRANT ALL ON TABLE "public"."idempotency" TO "service_role";



GRANT ALL ON TABLE "public"."incidents" TO "anon";
GRANT ALL ON TABLE "public"."incidents" TO "authenticated";
GRANT ALL ON TABLE "public"."incidents" TO "service_role";



GRANT ALL ON TABLE "public"."ops_events" TO "anon";
GRANT ALL ON TABLE "public"."ops_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ops_events" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."outbox" TO "anon";
GRANT ALL ON TABLE "public"."outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."outbox" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."system_health_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."system_health_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."system_health_snapshots" TO "service_role";



GRANT ALL ON SEQUENCE "public"."system_health_snapshots_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."system_health_snapshots_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."system_health_snapshots_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."system_incidents" TO "anon";
GRANT ALL ON TABLE "public"."system_incidents" TO "authenticated";
GRANT ALL ON TABLE "public"."system_incidents" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







