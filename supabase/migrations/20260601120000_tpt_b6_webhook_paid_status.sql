-- TPT-B-6 — Provider-scoped Tripletex webhook (paid-status sync, Flow B reverse)
-- Per-provider webhook secret (Vault) + idempotency + SENT → PAID transition

begin;

-- ---------------------------------------------------------------------------
-- 1) agreement_invoices: lookup index + last_status_change
-- ---------------------------------------------------------------------------
alter table public.agreement_invoices
  add column if not exists last_status_change timestamptz;

create index if not exists idx_agreement_invoices_provider_tripletex
  on public.agreement_invoices (provider_id, tripletex_invoice_id)
  where tripletex_invoice_id is not null;

-- ---------------------------------------------------------------------------
-- 2) provider_tripletex_webhook_secrets (Vault-backed)
-- ---------------------------------------------------------------------------
create table if not exists public.provider_tripletex_webhook_secrets (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  env text not null check (env in ('test', 'prod')),
  webhook_secret_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_rotated_at timestamptz,
  unique (provider_id, env)
);

comment on table public.provider_tripletex_webhook_secrets is
  'Per-provider Tripletex webhook auth secret (Vault). TPT-B-6.';

create index if not exists idx_provider_tripletex_webhook_secrets_provider
  on public.provider_tripletex_webhook_secrets (provider_id);

alter table public.provider_tripletex_webhook_secrets enable row level security;
revoke all on public.provider_tripletex_webhook_secrets from public, anon;
grant select on public.provider_tripletex_webhook_secrets to authenticated;
grant all on public.provider_tripletex_webhook_secrets to service_role;

drop policy if exists provider_tripletex_webhook_secrets_superadmin_all
  on public.provider_tripletex_webhook_secrets;
create policy provider_tripletex_webhook_secrets_superadmin_all
  on public.provider_tripletex_webhook_secrets
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists provider_tripletex_webhook_secrets_provider_admin_select
  on public.provider_tripletex_webhook_secrets;
create policy provider_tripletex_webhook_secrets_provider_admin_select
  on public.provider_tripletex_webhook_secrets
  for select
  using (public.can_access_provider(provider_id));

create or replace function private.lp_provider_webhook_secret_vault_cleanup()
returns trigger
language plpgsql
security definer
set search_path = vault, pg_catalog
as $$
begin
  delete from vault.secrets where id = old.webhook_secret_id;
  return old;
end;
$$;

drop trigger if exists trg_provider_tripletex_webhook_secrets_vault_cleanup
  on public.provider_tripletex_webhook_secrets;

create trigger trg_provider_tripletex_webhook_secrets_vault_cleanup
  before delete on public.provider_tripletex_webhook_secrets
  for each row
  execute function private.lp_provider_webhook_secret_vault_cleanup();

create or replace function private.lp_tripletex_webhook_vault_name(
  p_provider_id uuid,
  p_env text
)
returns text
language sql
immutable
as $$
  select 'tpt_provider_' || p_provider_id::text || '_' || lower(btrim(p_env)) || '_webhook';
$$;

-- ---------------------------------------------------------------------------
-- 3) tripletex_webhook_events (provider-scoped idempotency)
-- ---------------------------------------------------------------------------
create table if not exists public.tripletex_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  env text not null check (env in ('test', 'prod')),
  tripletex_event_id text not null,
  event_type text,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSED', 'IGNORED', 'FAILED')),
  error_detail text,
  unique (provider_id, env, tripletex_event_id)
);

create index if not exists idx_tripletex_webhook_events_provider_received
  on public.tripletex_webhook_events (provider_id, received_at desc);

comment on table public.tripletex_webhook_events is
  'Inbound Tripletex webhooks per provider (Flow B). TPT-B-6.';

alter table public.tripletex_webhook_events enable row level security;
revoke all on public.tripletex_webhook_events from public, anon, authenticated;
grant select, insert, update on public.tripletex_webhook_events to service_role;

-- ---------------------------------------------------------------------------
-- 4) RPC: lp_provider_rotate_webhook_secret
-- ---------------------------------------------------------------------------
create or replace function public.lp_provider_rotate_webhook_secret(
  p_provider_id uuid,
  p_env text default 'prod'
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, extensions, pg_catalog
as $$
declare
  v_env text := lower(btrim(coalesce(p_env, 'prod')));
  v_secret text;
  v_secret_id uuid;
  v_name text;
  v_existing public.provider_tripletex_webhook_secrets%rowtype;
  v_actor uuid := auth.uid();
begin
  if v_env not in ('test', 'prod') then
    raise exception 'INVALID_ENV' using errcode = '22023';
  end if;

  perform private.lp_assert_provider_admin_or_superadmin(p_provider_id);

  if not exists (
    select 1 from public.providers p
    where p.id = p_provider_id and p.deleted_at is null
  ) then
    raise exception 'PROVIDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_secret := encode(extensions.gen_random_bytes(32), 'hex');
  v_name := private.lp_tripletex_webhook_vault_name(p_provider_id, v_env);

  select * into v_existing
  from public.provider_tripletex_webhook_secrets s
  where s.provider_id = p_provider_id and s.env = v_env;

  if found then
    delete from vault.secrets where id = v_existing.webhook_secret_id;
  end if;

  v_secret_id := vault.create_secret(v_secret, v_name, 'Tripletex webhook secret for provider ' || p_provider_id::text);

  insert into public.provider_tripletex_webhook_secrets (
    provider_id, env, webhook_secret_id, last_rotated_at, updated_at
  )
  values (p_provider_id, v_env, v_secret_id, now(), now())
  on conflict (provider_id, env) do update
    set webhook_secret_id = excluded.webhook_secret_id,
        last_rotated_at = excluded.last_rotated_at,
        updated_at = excluded.updated_at;

  insert into public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor,
    'tripletex_webhook_secret_rotated',
    'tripletex_webhook_secret',
    p_provider_id,
    'Webhook secret rotated (shown once in RPC response)',
    jsonb_build_object('env', v_env, 'provider_id', p_provider_id)
  );

  return jsonb_build_object(
    'ok', true,
    'provider_id', p_provider_id,
    'env', v_env,
    'webhook_secret', v_secret,
    'rotated_at', now()
  );
end;
$$;

revoke all on function public.lp_provider_rotate_webhook_secret(uuid, text) from public;
revoke all on function public.lp_provider_rotate_webhook_secret(uuid, text) from anon;
grant execute on function public.lp_provider_rotate_webhook_secret(uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) RPC: lp_provider_load_webhook_secret (service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.lp_provider_load_webhook_secret(
  p_provider_id uuid,
  p_env text default 'prod'
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, pg_catalog
as $$
declare
  v_env text := lower(btrim(coalesce(p_env, 'prod')));
  v_row public.provider_tripletex_webhook_secrets%rowtype;
  v_secret text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if v_env not in ('test', 'prod') then
    raise exception 'INVALID_ENV' using errcode = '22023';
  end if;

  select * into v_row
  from public.provider_tripletex_webhook_secrets s
  where s.provider_id = p_provider_id and s.env = v_env;

  if not found then
    raise exception 'WEBHOOK_SECRET_NOT_CONFIGURED' using errcode = 'P0002';
  end if;

  select ds.decrypted_secret into v_secret
  from vault.decrypted_secrets ds
  where ds.id = v_row.webhook_secret_id;

  if coalesce(v_secret, '') = '' then
    raise exception 'WEBHOOK_SECRET_NOT_CONFIGURED' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'ok', true,
    'provider_id', p_provider_id,
    'env', v_env,
    'webhook_secret', v_secret
  );
end;
$$;

revoke all on function public.lp_provider_load_webhook_secret(uuid, text) from public;
revoke all on function public.lp_provider_load_webhook_secret(uuid, text) from anon;
revoke all on function public.lp_provider_load_webhook_secret(uuid, text) from authenticated;
grant execute on function public.lp_provider_load_webhook_secret(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 6) RPC: lp_apply_tripletex_paid_status
-- ---------------------------------------------------------------------------
create or replace function public.lp_apply_tripletex_paid_status(
  p_provider_id uuid,
  p_tripletex_invoice_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_tt_id text := btrim(coalesce(p_tripletex_invoice_id, ''));
  v_row public.agreement_invoices%rowtype;
  v_prev text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if v_tt_id = '' then
    raise exception 'TRIPLETEX_INVOICE_ID_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_row
  from public.agreement_invoices ai
  where ai.provider_id = p_provider_id
    and ai.tripletex_invoice_id = v_tt_id
  limit 1;

  if not found then
    return jsonb_build_object(
      'ok', true,
      'updated', false,
      'reason', 'NOT_FOUND',
      'provider_id', p_provider_id,
      'tripletex_invoice_id', v_tt_id
    );
  end if;

  v_prev := v_row.status;

  if v_prev = 'PAID' then
    return jsonb_build_object(
      'ok', true,
      'updated', false,
      'previous_status', v_prev,
      'invoice_id', v_row.id,
      'reason', 'ALREADY_PAID'
    );
  end if;

  if v_prev <> 'SENT' then
    insert into public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
    values (
      null,
      'agreement_invoice_paid_transition_rejected',
      'agreement_invoice',
      v_row.id,
      format('Invalid transition %s → PAID', v_prev),
      jsonb_build_object(
        'provider_id', p_provider_id,
        'tripletex_invoice_id', v_tt_id,
        'previous_status', v_prev,
        'target_status', 'PAID'
      )
    );

    return jsonb_build_object(
      'ok', true,
      'updated', false,
      'previous_status', v_prev,
      'invoice_id', v_row.id,
      'reason', 'INVALID_TRANSITION'
    );
  end if;

  insert into public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  values (
    null,
    'agreement_invoice_paid',
    'agreement_invoice',
    v_row.id,
    format('Tripletex invoice %s marked PAID', v_tt_id),
    jsonb_build_object(
      'provider_id', p_provider_id,
      'tripletex_invoice_id', v_tt_id,
      'previous_status', v_prev,
      'agreement_id', v_row.agreement_id,
      'company_id', v_row.company_id
    )
  );

  update public.agreement_invoices
     set status = 'PAID',
         paid_at = now(),
         last_status_change = now(),
         updated_at = now()
   where id = v_row.id
     and status = 'SENT';

  return jsonb_build_object(
    'ok', true,
    'updated', true,
    'previous_status', v_prev,
    'invoice_id', v_row.id,
    'tripletex_invoice_id', v_tt_id
  );
end;
$$;

revoke all on function public.lp_apply_tripletex_paid_status(uuid, text) from public;
revoke all on function public.lp_apply_tripletex_paid_status(uuid, text) from anon;
revoke all on function public.lp_apply_tripletex_paid_status(uuid, text) from authenticated;
grant execute on function public.lp_apply_tripletex_paid_status(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 7) Post-checks
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'tripletex_webhook_events'
  ) then
    raise exception 'TPT-B-6: tripletex_webhook_events missing';
  end if;

  if not exists (
    select 1 from pg_proc where proname = 'lp_apply_tripletex_paid_status' and prosecdef
  ) then
    raise exception 'TPT-B-6: lp_apply_tripletex_paid_status missing';
  end if;
end;
$$;

commit;
