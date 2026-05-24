-- K6 LIVE prod test-tenant: Lunchportalen QA + 20 pool users.
-- Idempotent: skips when company name already exists.
-- No tripletex_customers row (DC-026 global Flow 1 flag OFF).
-- Internal flag: DC-034 (column absent — name + orgnr 888888888 only).
--
-- Refs: docs/audit/sp-4-k6-prod-prep.md, dc-034, dc-035

begin;

create extension if not exists pgcrypto;

do $$
declare
  v_provider_id constant uuid := '11111111-1111-1111-1111-111111111111';
  v_company_id constant uuid := 'e0a00000-0000-4000-8000-000000000001';
  v_location_id constant uuid := 'e0a00000-0000-4000-8000-000000000002';
  v_agreement_id constant uuid := 'e0a00000-0000-4000-8000-000000000003';
  v_instance_id constant uuid := '00000000-0000-0000-0000-000000000000';
  v_placeholder_pw constant text := 'k6-prod-placeholder-reset-via-provision-script';
  v_start date := current_date - 30;
  v_end date := current_date + 90;
  i int;
  v_email text;
  v_user_id uuid;
  v_membership_id uuid;
  v_day text;
begin
  if exists (select 1 from public.companies c where c.name = 'Lunchportalen QA') then
    raise notice 'k6_prod_tenant: Lunchportalen QA already exists — skip';
    return;
  end if;

  insert into public.companies (
    id,
    name,
    orgnr,
    organization_number,
    status,
    employee_count,
    contact_name,
    contact_email,
    contact_phone,
    address,
    provider_id
  ) values (
    v_company_id,
    'Lunchportalen QA',
    '888888888',
    '888888888',
    'ACTIVE'::public.company_status,
    20,
    'K6 Pool',
    'k6-ops@lunchportalen.no',
    '99999999',
    'Intern QA — K6 load test (DC-034 pending)',
    v_provider_id
  );

  insert into public.company_locations (
    id,
    company_id,
    name,
    address,
    status
  ) values (
    v_location_id,
    v_company_id,
    'QA Hovedlokasjon',
    'Intern QA',
    'ACTIVE'
  );

  update public.companies
     set default_location_id = v_location_id,
         updated_at = timezone('utc', now())
   where id = v_company_id;

  insert into public.agreements (
    id,
    company_id,
    location_id,
    tier,
    status,
    delivery_days,
    slot_start,
    slot_end,
    starts_at,
    start_date,
    ends_at,
    activated_at,
    provider_id,
    comment_from_superadmin
  ) values (
    v_agreement_id,
    v_company_id,
    v_location_id,
    'BASIS'::public.agreement_tier,
    'ACTIVE'::public.agreement_status,
    '["mon","tue","wed","thu","fri"]'::jsonb,
    '11:00:00'::time,
    '13:00:00'::time,
    v_start,
    v_start,
    v_end,
    timezone('utc', now()),
    v_provider_id,
    'K6 LIVE prod pool — intern QA tenant'
  );

  foreach v_day in array array['mon','tue','wed','thu','fri'] loop
    insert into public.agreement_delivery_days (agreement_id, weekday, tier)
    values (v_agreement_id, v_day, 'BASIS'::public.agreement_tier)
    on conflict (agreement_id, weekday) do nothing;
  end loop;

  for i in 1..20 loop
    v_email := format('k6-vu-%s@lunchportalen.no', lpad(i::text, 2, '0'));
    v_user_id := ('e0b00000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    v_membership_id := ('e0c00000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) values (
      v_instance_id,
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      extensions.crypt(v_placeholder_pw, extensions.gen_salt('bf')),
      timezone('utc', now()),
      '{"provider":"email","providers":["email"],"k6_pool":true}'::jsonb,
      jsonb_build_object('full_name', format('K6 VU %s', lpad(i::text, 2, '0'))),
      timezone('utc', now()),
      timezone('utc', now()),
      '',
      '',
      '',
      ''
    )
    on conflict (id) do update set
      email = excluded.email,
      email_confirmed_at = coalesce(auth.users.email_confirmed_at, excluded.email_confirmed_at),
      updated_at = timezone('utc', now());

    insert into auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      v_user_id,
      v_user_id::text,
      v_user_id,
      jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now())
    )
    on conflict (provider, provider_id) do update set
      identity_data = excluded.identity_data,
      updated_at = timezone('utc', now());

    insert into public.profiles (
      id,
      email,
      full_name,
      role,
      company_id,
      location_id,
      active,
      is_active
    ) values (
      v_user_id,
      v_email,
      format('K6 VU %s', lpad(i::text, 2, '0')),
      'employee',
      v_company_id,
      v_location_id,
      true,
      true
    )
    on conflict (id) do update set
      email = excluded.email,
      full_name = excluded.full_name,
      role = excluded.role,
      company_id = excluded.company_id,
      location_id = excluded.location_id,
      active = true,
      is_active = true,
      disabled_at = null,
      updated_at = timezone('utc', now());

    insert into public.company_memberships (
      id,
      user_id,
      company_id,
      location_id,
      role,
      active,
      status,
      source,
      activated_at
    ) values (
      v_membership_id,
      v_user_id,
      v_company_id,
      v_location_id,
      'employee',
      true,
      'active',
      'manual',
      timezone('utc', now())
    )
    on conflict (user_id, company_id) do update set
      location_id = excluded.location_id,
      role = excluded.role,
      active = true,
      status = 'active',
      updated_at = timezone('utc', now());
  end loop;

  raise notice 'k6_prod_tenant: created Lunchportalen QA + 20 pool users';
end
$$;

commit;
