-- supabase/migrations/20260220_registration_step1.sql
-- TRINN 1: Registrering fasitdata + schema-safe lp_company_register

begin;

create extension if not exists pgcrypto;

create table if not exists public.company_registrations (
  company_id uuid primary key references public.companies (id) on update cascade on delete cascade,
  employee_count integer not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  address_line text not null,
  postal_code text not null,
  city text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_registrations_employee_count_ck check (employee_count >= 20),
  constraint company_registrations_contact_name_ck check (btrim(contact_name) <> ''),
  constraint company_registrations_contact_email_ck check (contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint company_registrations_contact_phone_ck check (btrim(contact_phone) <> ''),
  constraint company_registrations_address_line_ck check (btrim(address_line) <> ''),
  constraint company_registrations_postal_code_ck check (postal_code ~ '^[0-9]{4}$'),
  constraint company_registrations_city_ck check (btrim(city) <> '')
);
create unique index if not exists company_registrations_company_email_uniq
  on public.company_registrations (company_id, lower(contact_email));


create or replace function public.lp_touch_company_registrations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists company_registrations_set_updated_at on public.company_registrations;
create trigger company_registrations_set_updated_at
before update on public.company_registrations
for each row execute function public.lp_touch_company_registrations_updated_at();

drop function if exists public.lp_company_register(
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
);

create or replace function public.lp_company_register(
  p_orgnr text,
  p_company_name text,
  p_employee_count integer,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_address_line text,
  p_postal_code text,
  p_postal_city text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_company_id uuid;
  v_company_status public.company_status;
  v_location_id uuid;
  v_now timestamptz := clock_timestamp();

  v_orgnr text := regexp_replace(btrim(coalesce(p_orgnr, '')), '\D', '', 'g');
  v_company_name text := btrim(coalesce(p_company_name, ''));
  v_contact_name text := btrim(coalesce(p_contact_name, ''));
  v_contact_email text := lower(btrim(coalesce(p_contact_email, '')));
  v_contact_phone text := btrim(coalesce(p_contact_phone, ''));
  v_address_line text := btrim(coalesce(p_address_line, ''));
  v_postal_code text := regexp_replace(btrim(coalesce(p_postal_code, '')), '\D', '', 'g');
  v_city text := btrim(coalesce(p_postal_city, ''));

  v_has_locations boolean;
  v_loc_has_company_id boolean;
  v_loc_has_name boolean;
  v_loc_has_address boolean;
  v_loc_has_status boolean;

  v_outbox_has_event_key boolean;
  v_outbox_has_payload boolean;
  v_outbox_has_status boolean;
  v_outbox_has_attempts boolean;
  v_outbox_has_last_error boolean;
  v_outbox_has_locked_at boolean;
  v_outbox_has_locked_by boolean;
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

  if v_city = '' then
    raise exception using errcode = 'P0001', message = 'POSTAL_CITY_REQUIRED';
  end if;

  select c.id, c.status
    into v_company_id, v_company_status
  from public.companies c
  where c.orgnr = v_orgnr
  limit 1
  for update;

  if v_company_id is null then
    insert into public.companies (
      orgnr,
      name,
      status
    )
    values (
      v_orgnr,
      v_company_name,
      'PENDING'::public.company_status
    )
    returning id, status into v_company_id, v_company_status;
  else
    if v_company_status <> 'PENDING'::public.company_status then
      raise exception using errcode = 'P0001', message = 'COMPANY_NOT_PENDING';
    end if;

    update public.companies c
       set name = v_company_name,
           updated_at = now()
     where c.id = v_company_id
     returning status into v_company_status;
  end if;

  insert into public.company_registrations (
    company_id,
    employee_count,
    contact_name,
    contact_email,
    contact_phone,
    address_line,
    postal_code,
    city
  )
  values (
    v_company_id,
    p_employee_count,
    v_contact_name,
    v_contact_email,
    v_contact_phone,
    v_address_line,
    v_postal_code,
    v_city
  )
  on conflict (company_id) do update
    set employee_count = excluded.employee_count,
        contact_name = excluded.contact_name,
        contact_email = excluded.contact_email,
        contact_phone = excluded.contact_phone,
        address_line = excluded.address_line,
        postal_code = excluded.postal_code,
        city = excluded.city,
        updated_at = now();

  v_has_locations := to_regclass('public.company_locations') is not null;
  if not v_has_locations then
    raise exception using errcode = 'P0001', message = 'COMPANY_LOCATIONS_MISSING';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'company_locations' and column_name = 'company_id'
  ) into v_loc_has_company_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'company_locations' and column_name = 'name'
  ) into v_loc_has_name;

  if not v_loc_has_company_id or not v_loc_has_name then
    raise exception using errcode = 'P0001', message = 'COMPANY_LOCATIONS_SCHEMA_MISMATCH';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'company_locations' and column_name = 'address'
  ) into v_loc_has_address;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'company_locations' and column_name = 'status'
  ) into v_loc_has_status;

  select cl.id
    into v_location_id
  from public.company_locations cl
  where cl.company_id = v_company_id
  order by cl.id asc
  limit 1
  for update;

  if v_location_id is null then
    begin
      if v_loc_has_address and v_loc_has_status then
        begin
          execute 'insert into public.company_locations (company_id, name, address, status) values ($1, $2, $3, $4) returning id'
            into v_location_id
            using v_company_id, 'Hovedlokasjon', v_address_line, 'ACTIVE';
        exception
          when others then
            execute 'insert into public.company_locations (company_id, name, address) values ($1, $2, $3) returning id'
              into v_location_id
              using v_company_id, 'Hovedlokasjon', v_address_line;
        end;
      elsif v_loc_has_address then
        execute 'insert into public.company_locations (company_id, name, address) values ($1, $2, $3) returning id'
          into v_location_id
          using v_company_id, 'Hovedlokasjon', v_address_line;
      elsif v_loc_has_status then
        begin
          execute 'insert into public.company_locations (company_id, name, status) values ($1, $2, $3) returning id'
            into v_location_id
            using v_company_id, 'Hovedlokasjon', 'ACTIVE';
        exception
          when others then
            execute 'insert into public.company_locations (company_id, name) values ($1, $2) returning id'
              into v_location_id
              using v_company_id, 'Hovedlokasjon';
        end;
      else
        execute 'insert into public.company_locations (company_id, name) values ($1, $2) returning id'
          into v_location_id
          using v_company_id, 'Hovedlokasjon';
      end if;
    exception
      when others then
        raise exception using errcode = 'P0001', message = 'LOCATION_CREATE_FAILED';
    end;
  end if;

  if to_regclass('public.outbox') is null then
    raise exception using errcode = 'P0001', message = 'OUTBOX_MISSING';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'outbox' and column_name = 'event_key'
  ) into v_outbox_has_event_key;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'outbox' and column_name = 'payload'
  ) into v_outbox_has_payload;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'outbox' and column_name = 'status'
  ) into v_outbox_has_status;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'outbox' and column_name = 'attempts'
  ) into v_outbox_has_attempts;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'outbox' and column_name = 'last_error'
  ) into v_outbox_has_last_error;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'outbox' and column_name = 'locked_at'
  ) into v_outbox_has_locked_at;
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'outbox' and column_name = 'locked_by'
  ) into v_outbox_has_locked_by;

  if not (
    v_outbox_has_event_key
    and v_outbox_has_payload
    and v_outbox_has_status
    and v_outbox_has_attempts
    and v_outbox_has_last_error
    and v_outbox_has_locked_at
    and v_outbox_has_locked_by
  ) then
    raise exception using errcode = 'P0001', message = 'OUTBOX_SCHEMA_MISMATCH';
  end if;

  insert into public.outbox (
    event_key,
    payload,
    status,
    attempts,
    last_error,
    locked_at,
    locked_by
  )
  values (
    format('company.registered:%s', v_company_id::text),
    jsonb_build_object(
      'event', 'company.registered',
      'companyId', v_company_id,
      'locationId', v_location_id,
      'orgnr', v_orgnr,
      'companyName', v_company_name,
      'employeeCount', p_employee_count,
      'contactName', v_contact_name,
      'contactEmail', v_contact_email,
      'contactPhone', v_contact_phone,
      'addressLine', v_address_line,
      'postalCode', v_postal_code,
      'city', v_city,
      'receipt', v_now
    ),
    'PENDING',
    0,
    null,
    null,
    null
  )
  on conflict (event_key) do nothing;

  return jsonb_build_object(
    'company_id', v_company_id,
    'status', 'PENDING',
    'location_id', v_location_id,
    'receipt', v_now
  );
end
$$;

revoke all on function public.lp_company_register(
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
) from public;
revoke all on function public.lp_company_register(
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
) from anon;
revoke all on function public.lp_company_register(
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
) from authenticated;
grant execute on function public.lp_company_register(
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;
grant execute on function public.lp_company_register(
  text,
  text,
  integer,
  text,
  text,
  text,
  text,
  text,
  text
) to postgres;

commit;
