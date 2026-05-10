begin;

-- Registration is the pending source of truth. These additive guards make the
-- function safe on databases where an older create table if not exists won.
alter table if exists public.company_registrations
  add column if not exists agreement_id uuid null references public.agreements(id) on delete set null,
  add column if not exists status text not null default 'PENDING',
  add column if not exists orgnr text,
  add column if not exists company_name text,
  add column if not exists submitted_by_email text,
  add column if not exists submitted_by_name text,
  add column if not exists submitted_payload jsonb,
  add column if not exists raw_payload jsonb,
  add column if not exists reviewed_by uuid null references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists decision_note_internal text,
  add column if not exists approval_email_sent_at timestamptz,
  add column if not exists rejection_message_sent_at timestamptz;

create or replace function public.lp_company_register(
  p_company_name text,
  p_orgnr text,
  p_employee_count integer,
  p_contact_name text,
  p_contact_email text,
  p_contact_phone text,
  p_address_line text,
  p_postal_code text,
  p_postal_city text
)
returns json
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_company_id uuid;
  v_company_status public.company_status;
  v_location_id uuid;
  v_registration_entity_id text;

  v_orgnr text := regexp_replace(coalesce(p_orgnr, ''), '\D', '', 'g');
  v_company_name text := nullif(btrim(coalesce(p_company_name, '')), '');
  v_contact_name text := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_contact_email text := lower(nullif(btrim(coalesce(p_contact_email, '')), ''));
  v_contact_phone text := regexp_replace(coalesce(p_contact_phone, ''), '\D', '', 'g');
  v_address_line text := nullif(btrim(coalesce(p_address_line, '')), '');
  v_postal_code text := regexp_replace(coalesce(p_postal_code, ''), '\D', '', 'g');
  v_postal_city text := nullif(btrim(coalesce(p_postal_city, '')), '');
  v_full_address text;
  v_submitted_payload jsonb;
  v_raw_payload jsonb;

  v_loc_has_address boolean;
  v_loc_has_status boolean;
  v_reg_exists boolean;
  v_reg_has_id boolean;
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

  v_full_address := trim(both ' ' from (
    v_address_line || ', ' || v_postal_code || ' ' || v_postal_city
  ));

  v_submitted_payload := jsonb_build_object(
    'orgnr', v_orgnr,
    'company_name', v_company_name,
    'employee_count', p_employee_count,
    'contact_name', v_contact_name,
    'contact_email', v_contact_email,
    'contact_phone', v_contact_phone,
    'address_line', v_address_line,
    'postal_code', v_postal_code,
    'postal_city', v_postal_city
  );

  v_raw_payload := jsonb_build_object(
    'p_orgnr', p_orgnr,
    'p_company_name', p_company_name,
    'p_employee_count', p_employee_count,
    'p_contact_name', p_contact_name,
    'p_contact_email', p_contact_email,
    'p_contact_phone', p_contact_phone,
    'p_address_line', p_address_line,
    'p_postal_code', p_postal_code,
    'p_postal_city', p_postal_city
  );

  select c.id, c.status
    into v_company_id, v_company_status
  from public.companies c
  where c.deleted_at is null
    and (
      btrim(coalesce(c.orgnr, '')) = v_orgnr
      or btrim(coalesce(c.organization_number, '')) = v_orgnr
    )
  order by c.created_at desc
  limit 1
  for update;

  if v_company_id is not null and v_company_status <> 'PENDING'::public.company_status then
    raise exception 'ORGNR_ALREADY_REGISTERED';
  end if;

  if v_company_id is null then
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
    returning id, status into v_company_id, v_company_status;
  else
    update public.companies
       set name = v_company_name,
           orgnr = v_orgnr,
           organization_number = v_orgnr,
           employee_count = p_employee_count,
           contact_name = v_contact_name,
           contact_email = v_contact_email,
           contact_phone = v_contact_phone,
           address = v_full_address,
           updated_at = now()
     where id = v_company_id
     returning status into v_company_status;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'company_locations'
      and column_name = 'address'
  ) into v_loc_has_address;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'company_locations'
      and column_name = 'status'
  ) into v_loc_has_status;

  select cl.id
    into v_location_id
  from public.company_locations cl
  where cl.company_id = v_company_id
  order by cl.created_at asc, cl.id asc
  limit 1
  for update;

  if v_location_id is null then
    if v_loc_has_address and v_loc_has_status then
      execute 'insert into public.company_locations (company_id, name, address, status) values ($1, $2, $3, $4) returning id'
        into v_location_id
        using v_company_id, 'Hovedlokasjon', v_full_address, 'ACTIVE';
    elsif v_loc_has_address then
      execute 'insert into public.company_locations (company_id, name, address) values ($1, $2, $3) returning id'
        into v_location_id
        using v_company_id, 'Hovedlokasjon', v_full_address;
    elsif v_loc_has_status then
      execute 'insert into public.company_locations (company_id, name, status) values ($1, $2, $3) returning id'
        into v_location_id
        using v_company_id, 'Hovedlokasjon', 'ACTIVE';
    else
      execute 'insert into public.company_locations (company_id, name) values ($1, $2) returning id'
        into v_location_id
        using v_company_id, 'Hovedlokasjon';
    end if;
  end if;

  update public.companies
     set default_location_id = coalesce(default_location_id, v_location_id),
         updated_at = now()
   where id = v_company_id;

  select exists (
    select 1
    from public.company_registrations cr
    where cr.company_id = v_company_id
    for update
  ) into v_reg_exists;

  if v_reg_exists then
    update public.company_registrations
       set status = 'PENDING',
           orgnr = v_orgnr,
           company_name = v_company_name,
           submitted_by_email = v_contact_email,
           submitted_by_name = v_contact_name,
           contact_name = v_contact_name,
           contact_email = v_contact_email,
           contact_phone = v_contact_phone,
           address_line = v_address_line,
           postal_code = v_postal_code,
           city = v_postal_city,
           employee_count = p_employee_count,
           submitted_payload = v_submitted_payload,
           raw_payload = v_raw_payload,
           reviewed_by = null,
           reviewed_at = null,
           decision_note_internal = null,
           approval_email_sent_at = null,
           rejection_message_sent_at = null,
           updated_at = now()
     where company_id = v_company_id;
  else
    insert into public.company_registrations (
      company_id,
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
      v_submitted_payload,
      v_raw_payload
    );
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'company_registrations'
      and column_name = 'id'
  ) into v_reg_has_id;

  if v_reg_has_id then
    execute 'select id::text from public.company_registrations where company_id = $1 order by created_at desc, id desc limit 1'
      into v_registration_entity_id
      using v_company_id;
  end if;

  v_registration_entity_id := coalesce(v_registration_entity_id, v_company_id::text);

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
    v_registration_entity_id,
    v_company_id,
    v_location_id,
    v_contact_email,
    'public',
    'Firma registrerte avtaleforespørsel.',
    jsonb_build_object(
      'company_id', v_company_id,
      'registration_id', v_registration_entity_id,
      'orgnr', v_orgnr
    ),
    'superadmin',
    jsonb_build_object(
      'company_id', v_company_id,
      'registration_id', v_registration_entity_id,
      'orgnr', v_orgnr,
      'source', 'public_register_company',
      'agreement_created', false
    )
  );

  return json_build_object(
    'company_id', v_company_id,
    'status', 'PENDING'
  );
end;
$function$;

commit;
