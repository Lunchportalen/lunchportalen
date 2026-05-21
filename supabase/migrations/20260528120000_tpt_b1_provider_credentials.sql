-- TPT-B-1 — Provider Tripletex credentials (Vault-backed, encrypted at rest)
-- Flow B foundation: store consumer/employee tokens in Supabase Vault;
-- metadata in provider_tripletex_credentials; decrypt only via audited RPC.

begin;

-- ---------------------------------------------------------------------------
-- 1) Table: provider_tripletex_credentials (metadata + vault secret refs)
-- ---------------------------------------------------------------------------
create table if not exists public.provider_tripletex_credentials (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null unique references public.providers(id) on delete cascade,
  env text not null check (env in ('test', 'prod')),
  consumer_token_secret_id uuid not null,
  employee_token_secret_id uuid not null,
  company_id_external bigint,
  sync_status text not null default 'READY' check (
    sync_status in ('PENDING', 'READY', 'DISABLED', 'FAILED')
  ),
  encryption_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  rotation_due timestamptz
);

comment on table public.provider_tripletex_credentials is
  'Per-provider Tripletex API credentials. Tokens live in vault.secrets; never plaintext in this table. TPT-B-1.';

create index if not exists idx_provider_tripletex_credentials_env
  on public.provider_tripletex_credentials (env);

create index if not exists idx_provider_tripletex_credentials_rotation_due
  on public.provider_tripletex_credentials (rotation_due)
  where rotation_due is not null;

-- ---------------------------------------------------------------------------
-- 2) Private helpers
-- ---------------------------------------------------------------------------
create or replace function private.lp_assert_provider_admin_or_superadmin(p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if public.is_platform_admin() then
    return;
  end if;

  if exists (
    select 1
    from public.provider_memberships pm
    where pm.user_id = auth.uid()
      and pm.provider_id = p_provider_id
      and pm.role = 'provider_admin'::public.provider_role
  ) then
    return;
  end if;

  raise exception 'PERMISSION_DENIED' using errcode = '42501';
end;
$$;

create or replace function private.lp_tripletex_vault_secret_name(
  p_provider_id uuid,
  p_env text,
  p_kind text
)
returns text
language sql
immutable
as $$
  select 'tpt_provider_' || p_provider_id::text || '_' || lower(btrim(p_env)) || '_' || lower(btrim(p_kind));
$$;

create or replace function private.lp_provider_tripletex_credentials_vault_cleanup()
returns trigger
language plpgsql
security definer
set search_path = vault, pg_catalog
as $$
begin
  delete from vault.secrets
  where id in (old.consumer_token_secret_id, old.employee_token_secret_id);
  return old;
end;
$$;

drop trigger if exists trg_provider_tripletex_credentials_vault_cleanup
  on public.provider_tripletex_credentials;

create trigger trg_provider_tripletex_credentials_vault_cleanup
  before delete on public.provider_tripletex_credentials
  for each row
  execute function private.lp_provider_tripletex_credentials_vault_cleanup();

-- ---------------------------------------------------------------------------
-- 3) RPC: lp_provider_set_tripletex_credentials
-- ---------------------------------------------------------------------------
create or replace function public.lp_provider_set_tripletex_credentials(
  p_provider_id uuid,
  p_env text,
  p_consumer_token text,
  p_employee_token text,
  p_company_id_external bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, pg_catalog
as $$
declare
  v_env text := lower(btrim(coalesce(p_env, '')));
  v_consumer text := btrim(coalesce(p_consumer_token, ''));
  v_employee text := btrim(coalesce(p_employee_token, ''));
  v_actor uuid := auth.uid();
  v_row public.provider_tripletex_credentials%rowtype;
  v_consumer_name text;
  v_employee_name text;
  v_consumer_secret_id uuid;
  v_employee_secret_id uuid;
begin
  perform private.lp_assert_provider_admin_or_superadmin(p_provider_id);

  if v_env not in ('test', 'prod') then
    raise exception 'INVALID_ENV' using errcode = '22023';
  end if;

  if v_consumer = '' or v_employee = '' then
    raise exception 'INVALID_CREDENTIALS' using errcode = '22023';
  end if;

  if not exists (select 1 from public.providers p where p.id = p_provider_id) then
    raise exception 'PROVIDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_consumer_name := private.lp_tripletex_vault_secret_name(p_provider_id, v_env, 'consumer');
  v_employee_name := private.lp_tripletex_vault_secret_name(p_provider_id, v_env, 'employee');

  select * into v_row
  from public.provider_tripletex_credentials c
  where c.provider_id = p_provider_id;

  if found then
    perform vault.update_secret(v_row.consumer_token_secret_id, v_consumer, v_consumer_name);
    perform vault.update_secret(v_row.employee_token_secret_id, v_employee, v_employee_name);

    update public.provider_tripletex_credentials
    set
      env = v_env,
      company_id_external = p_company_id_external,
      sync_status = 'READY',
      updated_at = now()
    where provider_id = p_provider_id
    returning * into v_row;
  else
    v_consumer_secret_id := vault.create_secret(
      v_consumer,
      v_consumer_name,
      'Tripletex consumer token (TPT-B-1)'
    );
    v_employee_secret_id := vault.create_secret(
      v_employee,
      v_employee_name,
      'Tripletex employee token (TPT-B-1)'
    );

    insert into public.provider_tripletex_credentials (
      provider_id,
      env,
      consumer_token_secret_id,
      employee_token_secret_id,
      company_id_external,
      sync_status
    )
    values (
      p_provider_id,
      v_env,
      v_consumer_secret_id,
      v_employee_secret_id,
      p_company_id_external,
      'READY'
    )
    returning * into v_row;
  end if;

  insert into public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor,
    'tripletex_credentials_set',
    'tripletex_credentials',
    p_provider_id,
    null,
    jsonb_build_object(
      'env', v_env,
      'company_id_external', p_company_id_external,
      'sync_status', v_row.sync_status
    )
  );

  return jsonb_build_object(
    'ok', true,
    'provider_id', p_provider_id,
    'env', v_row.env,
    'is_configured', true,
    'company_id_external', v_row.company_id_external,
    'sync_status', v_row.sync_status
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) RPC: lp_provider_get_tripletex_credentials_status (no token leak)
-- ---------------------------------------------------------------------------
create or replace function public.lp_provider_get_tripletex_credentials_status(p_provider_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_row public.provider_tripletex_credentials%rowtype;
begin
  perform private.lp_assert_provider_admin_or_superadmin(p_provider_id);

  select * into v_row
  from public.provider_tripletex_credentials c
  where c.provider_id = p_provider_id;

  if not found then
    return jsonb_build_object(
      'is_configured', false,
      'env', null,
      'last_used_at', null,
      'company_id_external', null,
      'sync_status', null
    );
  end if;

  return jsonb_build_object(
    'is_configured', true,
    'env', v_row.env,
    'last_used_at', v_row.last_used_at,
    'company_id_external', v_row.company_id_external,
    'sync_status', v_row.sync_status,
    'rotation_due', v_row.rotation_due
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) RPC: lp_provider_load_tripletex_credentials (service_role only, audited)
-- ---------------------------------------------------------------------------
create or replace function public.lp_provider_load_tripletex_credentials(
  p_provider_id uuid,
  p_env text
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, pg_catalog
as $$
declare
  v_env text := lower(btrim(coalesce(p_env, '')));
  v_row public.provider_tripletex_credentials%rowtype;
  v_consumer text;
  v_employee text;
begin
  if v_env not in ('test', 'prod') then
    raise exception 'INVALID_ENV' using errcode = '22023';
  end if;

  select * into v_row
  from public.provider_tripletex_credentials c
  where c.provider_id = p_provider_id;

  if not found then
    raise exception 'PROVIDER_CREDENTIALS_NOT_CONFIGURED' using errcode = 'P0002';
  end if;

  if v_row.env <> v_env then
    raise exception 'PROVIDER_CREDENTIALS_ENV_MISMATCH: stored=%, requested=%', v_row.env, v_env
      using errcode = 'P0001';
  end if;

  if v_row.sync_status = 'DISABLED' then
    raise exception 'PROVIDER_CREDENTIALS_DISABLED' using errcode = 'P0001';
  end if;

  select ds.decrypted_secret into v_consumer
  from vault.decrypted_secrets ds
  where ds.id = v_row.consumer_token_secret_id;

  select ds.decrypted_secret into v_employee
  from vault.decrypted_secrets ds
  where ds.id = v_row.employee_token_secret_id;

  if coalesce(v_consumer, '') = '' or coalesce(v_employee, '') = '' then
    raise exception 'PROVIDER_CREDENTIALS_NOT_CONFIGURED' using errcode = 'P0002';
  end if;

  update public.provider_tripletex_credentials
  set last_used_at = now(), updated_at = now()
  where provider_id = p_provider_id;

  insert into public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  values (
    null,
    'tripletex_credentials_loaded',
    'tripletex_credentials',
    p_provider_id,
    'Server-side credential load for Tripletex API',
    jsonb_build_object(
      'env', v_env,
      'request_source', 'lp_provider_load_tripletex_credentials'
    )
  );

  return jsonb_build_object(
    'provider_id', p_provider_id,
    'env', v_env,
    'company_id_external', v_row.company_id_external,
    'consumer_token', v_consumer,
    'employee_token', v_employee
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) RLS
-- ---------------------------------------------------------------------------
alter table public.provider_tripletex_credentials enable row level security;

revoke all on public.provider_tripletex_credentials from public;
revoke all on public.provider_tripletex_credentials from anon;
revoke all on public.provider_tripletex_credentials from authenticated;

grant select on public.provider_tripletex_credentials to authenticated;
grant all on public.provider_tripletex_credentials to service_role;

drop policy if exists provider_tripletex_credentials_superadmin_all
  on public.provider_tripletex_credentials;
create policy provider_tripletex_credentials_superadmin_all
  on public.provider_tripletex_credentials
  as permissive for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- provider_admin: no direct SELECT (status via RPC only)

-- ---------------------------------------------------------------------------
-- 7) Grants
-- ---------------------------------------------------------------------------
grant execute on function public.lp_provider_set_tripletex_credentials(
  uuid, text, text, text, bigint
) to authenticated;

grant execute on function public.lp_provider_get_tripletex_credentials_status(uuid)
  to authenticated;

revoke all on function public.lp_provider_load_tripletex_credentials(uuid, text) from public;
revoke all on function public.lp_provider_load_tripletex_credentials(uuid, text) from anon;
revoke all on function public.lp_provider_load_tripletex_credentials(uuid, text) from authenticated;
grant execute on function public.lp_provider_load_tripletex_credentials(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 8) Post-checks
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'provider_tripletex_credentials'
  ) then
    raise exception 'TPT-B-1: provider_tripletex_credentials table missing';
  end if;

  if not exists (
    select 1 from pg_proc p
    where p.proname = 'lp_provider_set_tripletex_credentials'
      and p.prosecdef
  ) then
    raise exception 'TPT-B-1: lp_provider_set_tripletex_credentials missing or not SECURITY DEFINER';
  end if;

  if not exists (
    select 1 from pg_proc p
    where p.proname = 'lp_provider_load_tripletex_credentials'
      and p.prosecdef
  ) then
    raise exception 'TPT-B-1: lp_provider_load_tripletex_credentials missing or not SECURITY DEFINER';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
