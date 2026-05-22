-- TPT-B-7b-hotfix-5: merge per-step verify diagnostics into audit metadata
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
    ) || coalesce(v_result -> 'audit_diag', '{}'::jsonb)
  );

  return v_result;
end;
$$;

notify pgrst, 'reload schema';

commit;
