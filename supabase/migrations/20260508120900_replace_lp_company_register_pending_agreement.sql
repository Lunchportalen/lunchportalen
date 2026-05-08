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
set search_path to 'public'
as $function$
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
$function$;
