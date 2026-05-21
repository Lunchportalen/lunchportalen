-- TPT-B-7b-hotfix: reorder guards so service_role bypasses auth.uid()-based assert
-- Pattern: elevated/platform_admin FIRST, then lp_assert_provider_admin_or_superadmin
begin;

create or replace function public.lp_provider_test_tripletex_token(
  p_provider_id uuid,
  p_env text,
  p_tripletex_company_id bigint,
  p_employee_token text default null,
  p_verification_result jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_env text := lower(btrim(coalesce(p_env, '')));
  v_actor uuid := auth.uid();
  v_result jsonb;
  v_all_passed boolean;
begin
  if not private.lp_is_elevated_caller() and not public.is_platform_admin() then
    perform private.lp_assert_provider_admin_or_superadmin(p_provider_id);
  end if;

  if v_env not in ('test', 'prod') then
    raise exception 'INVALID_ENV' using errcode = '22023';
  end if;

  if p_tripletex_company_id is null or p_tripletex_company_id <= 0 then
    raise exception 'INVALID_COMPANY_ID' using errcode = '22023';
  end if;

  if p_verification_result is null then
    raise exception 'VERIFICATION_REQUIRES_APP_LAYER'
      using errcode = 'P0001',
            hint = 'Tripletex HTTP verification must run in Node; pass p_verification_result via service_role after verify.';
  end if;

  if not private.lp_is_elevated_caller() and not public.is_platform_admin() then
    raise exception 'PERMISSION_DENIED: verification result must be applied by trusted app layer'
      using errcode = '42501';
  end if;

  v_result := p_verification_result;
  v_all_passed := coalesce((v_result ->> 'all_passed')::boolean, false);

  perform private.lp_tripletex_onboarding_audit(
    'tripletex_onboarding_test_token',
    p_provider_id,
    v_env,
    v_actor,
    jsonb_build_object(
      'all_passed', v_all_passed,
      'tripletex_company_id', p_tripletex_company_id,
      'auth_ok', coalesce((v_result #>> '{auth,ok}')::boolean, false),
      'company_match_ok', coalesce((v_result #>> '{company_match,ok}')::boolean, false),
      'scope_ok', coalesce((v_result #>> '{scope,ok}')::boolean, false)
    )
  );

  return v_result;
end;
$$;

create or replace function public.lp_provider_complete_tripletex_connection(
  p_provider_id uuid,
  p_env text,
  p_tripletex_company_id bigint,
  p_employee_token text,
  p_consumer_token text,
  p_verification_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, pg_catalog
as $$
declare
  v_env text := lower(btrim(coalesce(p_env, '')));
  v_employee text := btrim(coalesce(p_employee_token, ''));
  v_consumer text := btrim(coalesce(p_consumer_token, ''));
  v_actor uuid := auth.uid();
  v_row public.provider_tripletex_credentials%rowtype;
  v_prev text;
  v_event_key text;
  v_consumer_name text;
  v_employee_name text;
  v_consumer_secret_id uuid;
  v_employee_secret_id uuid;
  v_company_name text;
begin
  if not private.lp_is_elevated_caller() and not public.is_platform_admin() then
    perform private.lp_assert_provider_admin_or_superadmin(p_provider_id);
  end if;

  if v_env not in ('test', 'prod') then
    raise exception 'INVALID_ENV' using errcode = '22023';
  end if;

  if v_employee = '' or v_consumer = '' then
    raise exception 'INVALID_CREDENTIALS' using errcode = '22023';
  end if;

  if not private.lp_tripletex_validate_verification_result(p_verification_result) then
    raise exception 'VERIFICATION_FAILED' using errcode = 'P0001';
  end if;

  if not private.lp_is_elevated_caller() and not public.is_platform_admin() then
    raise exception 'PERMISSION_DENIED: complete requires trusted app-layer verification'
      using errcode = '42501';
  end if;

  v_company_name := coalesce(
    p_verification_result #>> '{auth,company_name}',
    p_verification_result #>> '{company_match,company_name}'
  );

  select * into v_row
  from public.provider_tripletex_credentials c
  where c.provider_id = p_provider_id
  for update;

  v_prev := coalesce(v_row.connection_state, 'NOT_CONNECTED');

  if v_row.provider_id is not null then
    if v_prev not in ('NOT_CONNECTED', 'DEGRADED', 'CONFIGURING') then
      raise exception 'INVALID_STATE_FOR_COMPLETE: %', v_prev using errcode = 'P0001';
    end if;

    if v_prev = 'CONFIGURING' then
      return jsonb_build_object(
        'connection_state', 'CONFIGURING',
        'provisioning_started', false,
        'idempotent', true
      );
    end if;

    v_consumer_name := private.lp_tripletex_vault_secret_name(p_provider_id, v_env, 'consumer');
    v_employee_name := private.lp_tripletex_vault_secret_name(p_provider_id, v_env, 'employee');

    perform vault.update_secret(v_row.consumer_token_secret_id, v_consumer, v_consumer_name);
    perform vault.update_secret(v_row.employee_token_secret_id, v_employee, v_employee_name);

    update public.provider_tripletex_credentials
    set
      env = v_env,
      company_id_external = p_tripletex_company_id,
      cached_tripletex_company_name = v_company_name,
      sync_status = 'READY',
      connection_state = 'CONFIGURING',
      state_changed_at = now(),
      onboarding_provisioning_complete_at = null,
      disconnected_at = null,
      vault_purge_at = null,
      updated_at = now()
    where provider_id = p_provider_id
    returning * into v_row;
  else
    v_consumer_name := private.lp_tripletex_vault_secret_name(p_provider_id, v_env, 'consumer');
    v_employee_name := private.lp_tripletex_vault_secret_name(p_provider_id, v_env, 'employee');

    v_consumer_secret_id := vault.create_secret(
      v_consumer,
      v_consumer_name,
      'Tripletex consumer token (TPT-B-7)'
    );
    v_employee_secret_id := vault.create_secret(
      v_employee,
      v_employee_name,
      'Tripletex employee token (TPT-B-7)'
    );

    insert into public.provider_tripletex_credentials (
      provider_id,
      env,
      consumer_token_secret_id,
      employee_token_secret_id,
      company_id_external,
      sync_status,
      connection_state,
      state_changed_at,
      cached_tripletex_company_name
    )
    values (
      p_provider_id,
      v_env,
      v_consumer_secret_id,
      v_employee_secret_id,
      p_tripletex_company_id,
      'READY',
      'CONFIGURING',
      now(),
      v_company_name
    )
    returning * into v_row;
  end if;

  v_event_key := 'tripletex.onboarding_provisioning_start:' || p_provider_id::text || ':' || v_env;

  insert into public.outbox (event_key, payload, status)
  values (
    v_event_key,
    jsonb_build_object(
      'provider_id', p_provider_id,
      'env', v_env,
      'request_rid', coalesce(p_verification_result ->> 'request_rid', gen_random_uuid()::text)
    ),
    'PENDING'
  )
  on conflict (event_key) do nothing;

  perform private.lp_tripletex_onboarding_audit(
    'tripletex_onboarding_connection_started',
    p_provider_id,
    v_env,
    v_actor,
    jsonb_build_object(
      'tripletex_company_id', p_tripletex_company_id,
      'previous_state', v_prev,
      'new_state', 'CONFIGURING'
    )
  );

  return jsonb_build_object(
    'connection_state', 'CONFIGURING',
    'provisioning_started', true
  );
end;
$$;

notify pgrst, 'reload schema';

commit;
