-- K6 load-test user pool (20 employees on Company A).
-- Staging guard: skips when Company A test tenant is absent (prod-safe).
-- Password: placeholder in migration; reset via scripts/k6/provision-k6-pool.mjs → K6_POOL_PASSWORD.
--
-- Refs: docs/audit/dc-032-staging-paritet-K6.md (Del 4.5.3)

begin;

create extension if not exists pgcrypto;

do $$
declare
  v_company_id constant uuid := '8b0b8fa4-8d89-4795-b92b-e09129dd635f';
  v_location_id constant uuid := 'f319b299-8914-4c52-9984-569ce07c914d';
  v_instance_id constant uuid := '00000000-0000-0000-0000-000000000000';
  v_placeholder_pw constant text := 'k6-pool-placeholder-reset-via-provision-script';
  i int;
  v_email text;
  v_user_id uuid;
  v_membership_id uuid;
begin
  if not exists (select 1 from public.companies c where c.id = v_company_id) then
    raise notice 'k6_test_users: Company A (%) not found — skip (not staging K6 env)', v_company_id;
    return;
  end if;

  for i in 1..20 loop
    v_email := format('k6-vu-%s@lunchportalen.no', lpad(i::text, 2, '0'));
    v_user_id := ('c0000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    v_membership_id := ('c1000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;

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
      '{"provider":"email","providers":["email"]}'::jsonb,
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

  raise notice 'k6_test_users: ensured 20 pool users for Company A';
end
$$;

commit;
