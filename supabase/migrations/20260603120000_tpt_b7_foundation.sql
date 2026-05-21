-- TPT-B-7-foundation — Onboarding state machine, RPCs, outbox event prefix
-- References: docs/architecture/tripletex-onboarding-strategy.md §3, §7

begin;

-- ---------------------------------------------------------------------------
-- 1) Extend provider_tripletex_credentials (additive)
-- ---------------------------------------------------------------------------
alter table public.provider_tripletex_credentials
  add column if not exists connection_state text not null default 'NOT_CONNECTED'
    check (connection_state in (
      'NOT_CONNECTED', 'CONFIGURING', 'CONNECTED', 'DEGRADED', 'DISCONNECTED'
    ));

alter table public.provider_tripletex_credentials
  add column if not exists state_changed_at timestamptz not null default now();

alter table public.provider_tripletex_credentials
  add column if not exists disconnected_at timestamptz null;

alter table public.provider_tripletex_credentials
  add column if not exists vault_purge_at timestamptz null;

alter table public.provider_tripletex_credentials
  add column if not exists health_check_at timestamptz null;

alter table public.provider_tripletex_credentials
  add column if not exists onboarding_provisioning_complete_at timestamptz null;

alter table public.provider_tripletex_credentials
  add column if not exists cached_tripletex_company_name text null;

-- Backfill: existing Vault-backed rows → CONNECTED
update public.provider_tripletex_credentials
set
  connection_state = 'CONNECTED',
  state_changed_at = coalesce(updated_at, created_at)
where employee_token_secret_id is not null
  and connection_state = 'NOT_CONNECTED';

create index if not exists idx_provider_tripletex_credentials_purge
  on public.provider_tripletex_credentials (vault_purge_at)
  where connection_state = 'DISCONNECTED';

create index if not exists idx_provider_tripletex_credentials_health
  on public.provider_tripletex_credentials (connection_state, health_check_at)
  where connection_state in ('CONNECTED', 'DEGRADED');

-- ---------------------------------------------------------------------------
-- 2) Private helpers
-- ---------------------------------------------------------------------------
create or replace function private.lp_is_elevated_caller()
returns boolean
language sql
stable
as $$
  select
    auth.role() = 'service_role'
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

create or replace function private.lp_assert_provider_member_read(p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if public.is_platform_admin() then
    return;
  end if;

  if public.can_access_provider(p_provider_id) then
    return;
  end if;

  raise exception 'PERMISSION_DENIED' using errcode = '42501';
end;
$$;

create or replace function private.lp_tripletex_allowed_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case
    when p_from = p_to then true
    when p_from = 'NOT_CONNECTED' and p_to = 'CONFIGURING' then true
    when p_from = 'CONFIGURING' and p_to in ('CONNECTED', 'NOT_CONNECTED') then true
    when p_from = 'CONNECTED' and p_to in ('DEGRADED', 'DISCONNECTED') then true
    when p_from = 'DEGRADED' and p_to in ('CONNECTED', 'DISCONNECTED', 'CONFIGURING') then true
    when p_from = 'DISCONNECTED' and p_to in ('CONFIGURING', 'NOT_CONNECTED') then true
    else false
  end;
$$;

create or replace function private.lp_tripletex_onboarding_audit(
  p_action text,
  p_provider_id uuid,
  p_env text,
  p_actor uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  values (
    p_actor,
    p_action,
    'tripletex_connection',
    p_provider_id,
    null,
    jsonb_build_object('env', p_env) || coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function private.lp_tripletex_transition_connection_state(
  p_provider_id uuid,
  p_env text,
  p_new_state text,
  p_actor uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns public.provider_tripletex_credentials
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_row public.provider_tripletex_credentials%rowtype;
  v_prev text;
begin
  if p_new_state not in ('NOT_CONNECTED', 'CONFIGURING', 'CONNECTED', 'DEGRADED', 'DISCONNECTED') then
    raise exception 'INVALID_CONNECTION_STATE' using errcode = '22023';
  end if;

  select * into v_row
  from public.provider_tripletex_credentials c
  where c.provider_id = p_provider_id
  for update;

  if not found then
    if p_new_state = 'NOT_CONNECTED' then
      return null;
    end if;
    raise exception 'PROVIDER_CREDENTIALS_NOT_CONFIGURED' using errcode = 'P0002';
  end if;

  if v_row.env <> lower(btrim(p_env)) then
    raise exception 'PROVIDER_CREDENTIALS_ENV_MISMATCH' using errcode = 'P0001';
  end if;

  v_prev := v_row.connection_state;

  if v_prev = p_new_state then
    return v_row;
  end if;

  if not private.lp_tripletex_allowed_transition(v_prev, p_new_state) then
    raise exception 'INVALID_STATE_TRANSITION: % -> %', v_prev, p_new_state
      using errcode = 'P0001';
  end if;

  update public.provider_tripletex_credentials
  set
    connection_state = p_new_state,
    state_changed_at = now(),
    updated_at = now(),
    disconnected_at = case
      when p_new_state = 'DISCONNECTED' then coalesce(disconnected_at, now())
      when p_new_state in ('CONNECTED', 'CONFIGURING') then null
      else disconnected_at
    end,
    vault_purge_at = case
      when p_new_state = 'DISCONNECTED' and vault_purge_at is null then now() + interval '30 days'
      when p_new_state in ('CONNECTED', 'CONFIGURING') then null
      else vault_purge_at
    end
  where provider_id = p_provider_id
  returning * into v_row;

  perform private.lp_tripletex_onboarding_audit(
    'tripletex_connection_state_change',
    p_provider_id,
    p_env,
    p_actor,
    jsonb_build_object(
      'previous_state', v_prev,
      'new_state', p_new_state
    ) || coalesce(p_metadata, '{}'::jsonb)
  );

  return v_row;
end;
$$;

create or replace function private.lp_tripletex_validate_verification_result(p_result jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_all boolean;
begin
  if p_result is null then
    return false;
  end if;

  v_all := coalesce((p_result ->> 'all_passed')::boolean, false);
  if not v_all then
    return false;
  end if;

  if coalesce((p_result #>> '{auth,ok}')::boolean, false) is not true then
    return false;
  end if;
  if coalesce((p_result #>> '{company_match,ok}')::boolean, false) is not true then
    return false;
  end if;
  if coalesce((p_result #>> '{scope,ok}')::boolean, false) is not true then
    return false;
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) RPC: lp_provider_test_tripletex_token (§7.1)
-- HTTP verification runs in Node; RPC records trusted results (service_role).
-- ---------------------------------------------------------------------------
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
  perform private.lp_assert_provider_admin_or_superadmin(p_provider_id);

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

-- ---------------------------------------------------------------------------
-- 4) RPC: lp_provider_complete_tripletex_connection (§7.2)
-- ---------------------------------------------------------------------------
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
  perform private.lp_assert_provider_admin_or_superadmin(p_provider_id);

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

-- ---------------------------------------------------------------------------
-- 5) RPC: lp_provider_complete_onboarding_provisioning (§7.3, service_role)
-- ---------------------------------------------------------------------------
create or replace function public.lp_provider_complete_onboarding_provisioning(
  p_provider_id uuid,
  p_env text,
  p_summary jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_env text := lower(btrim(coalesce(p_env, '')));
  v_row public.provider_tripletex_credentials%rowtype;
  v_started timestamptz;
  v_duration_ms int;
begin
  if not private.lp_is_elevated_caller() then
    raise exception 'PERMISSION_DENIED: service_role required' using errcode = '42501';
  end if;

  if v_env not in ('test', 'prod') then
    raise exception 'INVALID_ENV' using errcode = '22023';
  end if;

  select * into v_row
  from public.provider_tripletex_credentials c
  where c.provider_id = p_provider_id
  for update;

  if not found or v_row.env <> v_env then
    raise exception 'PROVIDER_CREDENTIALS_NOT_CONFIGURED' using errcode = 'P0002';
  end if;

  if v_row.connection_state <> 'CONFIGURING' then
    raise exception 'INVALID_STATE_FOR_PROVISIONING: %', v_row.connection_state
      using errcode = 'P0001';
  end if;

  v_started := coalesce(
    (p_summary ->> 'started_at')::timestamptz,
    v_row.state_changed_at,
    now()
  );
  v_duration_ms := coalesce(
    (p_summary ->> 'duration_ms')::int,
    greatest(0, (extract(epoch from (now() - v_started)) * 1000)::int)
  );

  if v_row.onboarding_provisioning_complete_at is not null then
    return coalesce(p_summary, '{}'::jsonb) || jsonb_build_object(
      'idempotent', true,
      'onboarding_provisioning_complete_at', v_row.onboarding_provisioning_complete_at
    );
  end if;

  update public.provider_tripletex_credentials
  set
    onboarding_provisioning_complete_at = now(),
    updated_at = now()
  where provider_id = p_provider_id
  returning * into v_row;

  perform private.lp_tripletex_onboarding_audit(
    'tripletex_onboarding_provisioning_completed',
    p_provider_id,
    v_env,
    null,
    coalesce(p_summary, '{}'::jsonb) || jsonb_build_object('duration_ms', v_duration_ms)
  );

  if jsonb_array_length(coalesce(p_summary -> 'skipped_details', '[]'::jsonb)) > 0 then
    perform private.lp_tripletex_onboarding_audit(
      'tripletex_onboarding_customer_skipped',
      p_provider_id,
      v_env,
      null,
      jsonb_build_object('skipped_details', p_summary -> 'skipped_details')
    );
  end if;

  return coalesce(p_summary, '{}'::jsonb) || jsonb_build_object(
    'duration_ms', v_duration_ms,
    'onboarding_provisioning_complete_at', v_row.onboarding_provisioning_complete_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) RPC: lp_provider_finalize_tripletex_connection (§7.4)
-- ---------------------------------------------------------------------------
create or replace function public.lp_provider_finalize_tripletex_connection(
  p_provider_id uuid,
  p_env text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_env text := lower(btrim(coalesce(p_env, '')));
  v_actor uuid := auth.uid();
  v_row public.provider_tripletex_credentials%rowtype;
  v_has_webhook boolean;
begin
  perform private.lp_assert_provider_admin_or_superadmin(p_provider_id);

  if v_env not in ('test', 'prod') then
    raise exception 'INVALID_ENV' using errcode = '22023';
  end if;

  select * into v_row
  from public.provider_tripletex_credentials c
  where c.provider_id = p_provider_id;

  if not found or v_row.env <> v_env then
    raise exception 'PROVIDER_CREDENTIALS_NOT_CONFIGURED' using errcode = 'P0002';
  end if;

  if v_row.onboarding_provisioning_complete_at is null then
    raise exception 'PROVISIONING_NOT_COMPLETE' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.provider_tripletex_webhook_secrets ws
    where ws.provider_id = p_provider_id
      and ws.env = v_env
  ) into v_has_webhook;

  if not v_has_webhook then
    raise exception 'WEBHOOK_SECRET_REQUIRED' using errcode = 'P0001';
  end if;

  if v_row.connection_state = 'CONNECTED' then
    return jsonb_build_object(
      'connection_state', 'CONNECTED',
      'ready_for_billing', true,
      'idempotent', true
    );
  end if;

  perform private.lp_tripletex_transition_connection_state(
    p_provider_id,
    v_env,
    'CONNECTED',
    v_actor,
    '{}'::jsonb
  );

  perform private.lp_tripletex_onboarding_audit(
    'tripletex_onboarding_finalized',
    p_provider_id,
    v_env,
    v_actor,
    jsonb_build_object('new_state', 'CONNECTED')
  );

  return jsonb_build_object(
    'connection_state', 'CONNECTED',
    'ready_for_billing', true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) RPC: lp_provider_disconnect_tripletex (§7.5)
-- ---------------------------------------------------------------------------
create or replace function public.lp_provider_disconnect_tripletex(
  p_provider_id uuid,
  p_env text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_env text := lower(btrim(coalesce(p_env, '')));
  v_actor uuid := auth.uid();
  v_row public.provider_tripletex_credentials%rowtype;
  v_purge_at timestamptz;
begin
  perform private.lp_assert_provider_admin_or_superadmin(p_provider_id);

  if v_env not in ('test', 'prod') then
    raise exception 'INVALID_ENV' using errcode = '22023';
  end if;

  select * into v_row
  from public.provider_tripletex_credentials c
  where c.provider_id = p_provider_id;

  if not found or v_row.env <> v_env then
    raise exception 'PROVIDER_CREDENTIALS_NOT_CONFIGURED' using errcode = 'P0002';
  end if;

  if v_row.connection_state = 'DISCONNECTED' then
    return jsonb_build_object(
      'connection_state', 'DISCONNECTED',
      'vault_purge_at', v_row.vault_purge_at,
      'days_until_purge', greatest(
        0,
        ceil(extract(epoch from (v_row.vault_purge_at - now())) / 86400.0)::int
      ),
      'idempotent', true
    );
  end if;

  if v_row.connection_state not in ('CONNECTED', 'DEGRADED') then
    raise exception 'INVALID_STATE_FOR_DISCONNECT: %', v_row.connection_state
      using errcode = 'P0001';
  end if;

  v_purge_at := now() + interval '30 days';

  perform private.lp_tripletex_onboarding_audit(
    'tripletex_connection_state_change',
    p_provider_id,
    v_env,
    v_actor,
    jsonb_build_object(
      'previous_state', v_row.connection_state,
      'new_state', 'DISCONNECTED'
    )
  );

  update public.provider_tripletex_credentials
  set
    connection_state = 'DISCONNECTED',
    state_changed_at = now(),
    disconnected_at = now(),
    vault_purge_at = v_purge_at,
    updated_at = now()
  where provider_id = p_provider_id
  returning * into v_row;

  perform private.lp_tripletex_onboarding_audit(
    'tripletex_onboarding_disconnected',
    p_provider_id,
    v_env,
    v_actor,
    jsonb_build_object('vault_purge_at', v_purge_at)
  );

  return jsonb_build_object(
    'connection_state', 'DISCONNECTED',
    'vault_purge_at', v_purge_at,
    'days_until_purge', 30
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) RPC: lp_provider_reconnect_tripletex (§7.6)
-- ---------------------------------------------------------------------------
create or replace function public.lp_provider_reconnect_tripletex(
  p_provider_id uuid,
  p_env text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_env text := lower(btrim(coalesce(p_env, '')));
  v_actor uuid := auth.uid();
  v_row public.provider_tripletex_credentials%rowtype;
begin
  perform private.lp_assert_provider_admin_or_superadmin(p_provider_id);

  if v_env not in ('test', 'prod') then
    raise exception 'INVALID_ENV' using errcode = '22023';
  end if;

  select * into v_row
  from public.provider_tripletex_credentials c
  where c.provider_id = p_provider_id;

  if not found or v_row.env <> v_env then
    raise exception 'PROVIDER_CREDENTIALS_NOT_CONFIGURED' using errcode = 'P0002';
  end if;

  if v_row.connection_state <> 'DISCONNECTED' then
    raise exception 'INVALID_STATE_FOR_RECONNECT: %', v_row.connection_state
      using errcode = 'P0001';
  end if;

  if v_row.vault_purge_at is null or v_row.vault_purge_at <= now() then
    raise exception 'GRACE_PERIOD_EXPIRED' using errcode = 'P0001';
  end if;

  update public.provider_tripletex_credentials
  set
    connection_state = 'CONFIGURING',
    state_changed_at = now(),
    disconnected_at = null,
    vault_purge_at = null,
    onboarding_provisioning_complete_at = null,
    updated_at = now()
  where provider_id = p_provider_id
  returning * into v_row;

  perform private.lp_tripletex_onboarding_audit(
    'tripletex_onboarding_reconnect_initiated',
    p_provider_id,
    v_env,
    v_actor,
    jsonb_build_object('new_state', 'CONFIGURING', 'validation_required', true)
  );

  return jsonb_build_object(
    'connection_state', 'CONFIGURING',
    'validation_required', true
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 9) RPC: lp_provider_get_connection_health (§7.7)
-- ---------------------------------------------------------------------------
create or replace function public.lp_provider_get_connection_health(
  p_provider_id uuid,
  p_env text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_env text := lower(btrim(coalesce(p_env, '')));
  v_row public.provider_tripletex_credentials%rowtype;
  v_stats jsonb;
  v_events jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_sent int;
  v_paid int;
  v_failures int;
  v_webhooks int;
begin
  perform private.lp_assert_provider_member_read(p_provider_id);

  if v_env not in ('test', 'prod') then
    raise exception 'INVALID_ENV' using errcode = '22023';
  end if;

  select * into v_row
  from public.provider_tripletex_credentials c
  where c.provider_id = p_provider_id;

  if not found or v_row.env <> v_env then
    return jsonb_build_object(
      'state', 'NOT_CONNECTED',
      'state_since', null,
      'tripletex_company_id', null,
      'tripletex_company_name', null,
      'last_health_check', null,
      'stats_30d', jsonb_build_object(
        'invoices_sent', 0,
        'invoices_paid', 0,
        'worker_failures', 0,
        'webhook_events', 0
      ),
      'recent_events', '[]'::jsonb,
      'warnings', '[]'::jsonb
    );
  end if;

  select
    count(*) filter (where ai.status in ('SENT', 'PAID')),
    count(*) filter (where ai.status = 'PAID'),
    count(*) filter (where ai.status = 'FAILED'),
    0
  into v_sent, v_paid, v_failures, v_webhooks
  from public.agreement_invoices ai
  where ai.provider_id = p_provider_id
    and ai.created_at >= now() - interval '30 days';

  select count(*) into v_webhooks
  from public.tripletex_webhook_events twe
  where twe.provider_id = p_provider_id
    and twe.env = v_env
    and twe.received_at >= now() - interval '30 days';

  v_stats := jsonb_build_object(
    'invoices_sent', coalesce(v_sent, 0),
    'invoices_paid', coalesce(v_paid, 0),
    'worker_failures', coalesce(v_failures, 0),
    'webhook_events', coalesce(v_webhooks, 0)
  );

  if v_row.connection_state = 'DEGRADED' then
    v_warnings := jsonb_build_array(
      jsonb_build_object(
        'code', 'connection_degraded',
        'message', 'Tripletex-tilkoblingen trenger oppmerksomhet'
      )
    );
    if v_row.health_check_at is null or v_row.health_check_at < now() - interval '2 days' then
      v_warnings := v_warnings || jsonb_build_array(
        jsonb_build_object(
          'code', 'stale_health_check',
          'message', 'Siste vellykkede helse-sjekk er eldre enn 2 dager'
        )
      );
    end if;
    if coalesce(v_failures, 0) > 0 then
      v_warnings := v_warnings || jsonb_build_array(
        jsonb_build_object(
          'code', 'worker_failures',
          'message', format('%s faktura-pushes feilet siste 30 dager', v_failures)
        )
      );
    end if;
  end if;

  select coalesce(jsonb_agg(ev order by ev ->> 'created_at' desc), '[]'::jsonb)
  into v_events
  from (
    select jsonb_build_object(
      'action', l.action,
      'created_at', l.created_at,
      'metadata', l.metadata
    ) as ev
    from public.lifecycle_audit_log l
    where l.entity_type = 'tripletex_connection'
      and l.entity_id = p_provider_id
      and (l.metadata ->> 'env' is null or l.metadata ->> 'env' = v_env)
    order by l.created_at desc
    limit 10
  ) sub;

  return jsonb_build_object(
    'state', v_row.connection_state,
    'state_since', v_row.state_changed_at,
    'tripletex_company_id', v_row.company_id_external,
    'tripletex_company_name', v_row.cached_tripletex_company_name,
    'last_health_check', v_row.health_check_at,
    'stats_30d', v_stats,
    'recent_events', coalesce(v_events, '[]'::jsonb),
    'warnings', coalesce(v_warnings, '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 10) RPC: health cron helpers (service_role)
-- ---------------------------------------------------------------------------
create or replace function public.lp_provider_apply_connection_health_check(
  p_provider_id uuid,
  p_env text,
  p_ok boolean,
  p_auth_failed boolean default false,
  p_company_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_env text := lower(btrim(coalesce(p_env, '')));
  v_row public.provider_tripletex_credentials%rowtype;
  v_prev text;
begin
  if not private.lp_is_elevated_caller() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  select * into v_row
  from public.provider_tripletex_credentials c
  where c.provider_id = p_provider_id
  for update;

  if not found or v_row.env <> v_env then
    return jsonb_build_object('skipped', true, 'reason', 'NOT_FOUND');
  end if;

  v_prev := v_row.connection_state;

  if v_prev not in ('CONNECTED', 'DEGRADED') then
    return jsonb_build_object('skipped', true, 'reason', 'WRONG_STATE', 'state', v_prev);
  end if;

  if p_ok then
    update public.provider_tripletex_credentials
    set
      health_check_at = now(),
      cached_tripletex_company_name = coalesce(p_company_name, cached_tripletex_company_name),
      updated_at = now()
    where provider_id = p_provider_id;

    if v_prev = 'DEGRADED' then
      perform private.lp_tripletex_transition_connection_state(
        p_provider_id, v_env, 'CONNECTED', null, '{}'::jsonb
      );
    end if;

    perform private.lp_tripletex_onboarding_audit(
      'tripletex_health_check',
      p_provider_id,
      v_env,
      null,
      jsonb_build_object('ok', true)
    );

    return jsonb_build_object('ok', true, 'transitioned_to', case when v_prev = 'DEGRADED' then 'CONNECTED' else v_prev end);
  end if;

  if p_auth_failed and v_prev = 'CONNECTED' then
    perform private.lp_tripletex_transition_connection_state(
      p_provider_id, v_env, 'DEGRADED', null,
      jsonb_build_object('reason', 'health_check_auth_failed')
    );

    perform private.lp_tripletex_onboarding_audit(
      'tripletex_health_check',
      p_provider_id,
      v_env,
      null,
      jsonb_build_object('ok', false, 'auth_failed', true)
    );

    return jsonb_build_object('ok', false, 'transitioned_to', 'DEGRADED');
  end if;

  return jsonb_build_object('ok', false, 'skipped', true);
end;
$$;

create or replace function public.lp_provider_purge_disconnected_vault(
  p_provider_id uuid,
  p_env text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_env text := lower(btrim(coalesce(p_env, '')));
  v_row public.provider_tripletex_credentials%rowtype;
begin
  if not private.lp_is_elevated_caller() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  select * into v_row
  from public.provider_tripletex_credentials c
  where c.provider_id = p_provider_id
  for update;

  if not found or v_row.env <> v_env then
    return jsonb_build_object('purged', false, 'reason', 'NOT_FOUND');
  end if;

  if v_row.connection_state <> 'DISCONNECTED' then
    return jsonb_build_object('purged', false, 'reason', 'WRONG_STATE');
  end if;

  if v_row.vault_purge_at is null or v_row.vault_purge_at > now() then
    return jsonb_build_object('purged', false, 'reason', 'GRACE_ACTIVE');
  end if;

  delete from public.provider_tripletex_webhook_secrets ws
  where ws.provider_id = p_provider_id and ws.env = v_env;

  perform private.lp_tripletex_onboarding_audit(
    'tripletex_onboarding_vault_purged',
    p_provider_id,
    v_env,
    null,
    jsonb_build_object('previous_state', 'DISCONNECTED', 'new_state', 'NOT_CONNECTED')
  );

  delete from public.provider_tripletex_credentials
  where provider_id = p_provider_id;

  return jsonb_build_object('purged', true, 'new_state', 'NOT_CONNECTED');
end;
$$;

-- ---------------------------------------------------------------------------
-- 11) Grants
-- ---------------------------------------------------------------------------
grant execute on function public.lp_provider_test_tripletex_token(
  uuid, text, bigint, text, jsonb
) to authenticated, service_role;

grant execute on function public.lp_provider_complete_tripletex_connection(
  uuid, text, bigint, text, text, jsonb
) to authenticated, service_role;

grant execute on function public.lp_provider_complete_onboarding_provisioning(
  uuid, text, jsonb
) to service_role;

grant execute on function public.lp_provider_finalize_tripletex_connection(uuid, text)
  to authenticated;

grant execute on function public.lp_provider_disconnect_tripletex(uuid, text)
  to authenticated;

grant execute on function public.lp_provider_reconnect_tripletex(uuid, text)
  to authenticated;

grant execute on function public.lp_provider_get_connection_health(uuid, text)
  to authenticated;

grant execute on function public.lp_provider_apply_connection_health_check(
  uuid, text, boolean, boolean, text
) to service_role;

grant execute on function public.lp_provider_purge_disconnected_vault(uuid, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
