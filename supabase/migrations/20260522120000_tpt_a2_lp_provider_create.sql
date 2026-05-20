-- TPT-A-2 — lp_provider_create + outbox enqueue (Flow A onboarding)
--
-- Scope (TRIPLETEX-PLAN-V1 v3.1 §4 Sekvens A1 + §5 TPT-A-2):
--   - Superadmin-only RPC: INSERT providers + lifecycle audit + outbox event
--   - tripletex_customers: nullable provider_id + scope CHECK (company XOR provider)
--   - Worker handler for tripletex.provider_customer_create_lp → TPT-A-3 (not this patch)
--
-- References: Q6-discovery, TPT-0 R9 repair (tripletex_customer_id), commit add5cb64

begin;

-- ---------------------------------------------------------------------------
-- 1) tripletex_customers — provider scope (Flow A mapping hook for TPT-A-3)
-- ---------------------------------------------------------------------------
alter table public.tripletex_customers
  add column if not exists provider_id uuid references public.providers (id) on delete cascade;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tripletex_customers'
      and column_name = 'company_id'
      and is_nullable = 'NO'
  ) then
    alter table public.tripletex_customers
      alter column company_id drop not null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tripletex_customers_scope_check'
      and conrelid = 'public.tripletex_customers'::regclass
  ) then
    alter table public.tripletex_customers
      add constraint tripletex_customers_scope_check
      check (
        (company_id is not null and provider_id is null)
        or (company_id is null and provider_id is not null)
      );
  end if;
end
$$;

create unique index if not exists tripletex_customers_provider_id_key
  on public.tripletex_customers (provider_id)
  where provider_id is not null;

-- ---------------------------------------------------------------------------
-- 2) lp_provider_create — runtime provider INSERT (superadmin only)
-- ---------------------------------------------------------------------------
create or replace function public.lp_provider_create(
  p_slug text,
  p_name text,
  p_contact_email text,
  p_org_number text default null,
  p_contact_phone text default null,
  p_billing_org_no text default null,
  p_billing_email text default null,
  p_billing_address text default null,
  p_default_tier_pricing text default null,
  p_billing_model text default 'SAAS_FIXED',
  p_request_rid text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_name text := btrim(coalesce(p_name, ''));
  v_email_override text := nullif(btrim(coalesce(p_billing_email, '')), '');
  v_email text := lower(btrim(coalesce(v_email_override, p_contact_email)));
  v_org_override text := nullif(btrim(coalesce(p_billing_org_no, '')), '');
  v_org text := nullif(btrim(coalesce(v_org_override, p_org_number)), '');
  v_phone text := nullif(btrim(coalesce(p_contact_phone, '')), '');
  v_billing_model text := upper(btrim(coalesce(p_billing_model, 'SAAS_FIXED')));
  v_provider_id uuid := gen_random_uuid();
  v_request_rid text;
  v_event_key text;
begin
  if not public.is_platform_admin() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if v_slug = '' or v_slug !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$' then
    raise exception 'INVALID_SLUG' using errcode = '22023';
  end if;

  if v_name = '' then
    raise exception 'NAME_REQUIRED' using errcode = '22023';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'INVALID_CONTACT_EMAIL' using errcode = '22023';
  end if;

  if v_billing_model not in ('SAAS_FIXED', 'SAAS_PER_COMPANY', 'CUSTOM') then
    raise exception 'INVALID_BILLING_MODEL' using errcode = '22023';
  end if;

  if exists (select 1 from public.providers where slug = v_slug) then
    raise exception 'SLUG_ALREADY_EXISTS' using errcode = '23505';
  end if;

  if exists (select 1 from public.providers where name = v_name) then
    raise exception 'NAME_ALREADY_EXISTS' using errcode = '23505';
  end if;

  if v_org is not null and exists (select 1 from public.providers where org_number = v_org) then
    raise exception 'ORG_NUMBER_ALREADY_EXISTS' using errcode = '23505';
  end if;

  if to_regclass('public.outbox') is null then
    raise exception 'OUTBOX_MISSING' using errcode = 'P0001';
  end if;

  insert into public.providers (
    id,
    name,
    slug,
    org_number,
    contact_email,
    contact_phone,
    billing_model,
    status
  )
  values (
    v_provider_id,
    v_name,
    v_slug,
    v_org,
    v_email,
    v_phone,
    v_billing_model,
    'ACTIVE'::public.provider_status
  );

  perform private.lp_lifecycle_audit(
    'provider_created',
    'provider',
    v_provider_id,
    null,
    jsonb_build_object(
      'slug', v_slug,
      'name', v_name,
      'contact_email', v_email,
      'org_number', v_org,
      'billing_model', v_billing_model,
      'billing_address', nullif(btrim(coalesce(p_billing_address, '')), ''),
      'default_tier_pricing', nullif(btrim(coalesce(p_default_tier_pricing, '')), '')
    )
  );

  v_request_rid := coalesce(
    nullif(btrim(coalesce(p_request_rid, '')), ''),
    replace(gen_random_uuid()::text, '-', '')
  );
  v_event_key := format('tripletex.provider_customer_create_lp:%s', v_provider_id::text);

  insert into public.outbox (event_key, payload, status, attempts, last_error, locked_at, locked_by)
  values (
    v_event_key,
    jsonb_build_object(
      'provider_id', v_provider_id,
      'target', 'lp',
      'request_rid', v_request_rid
    ),
    'PENDING',
    0,
    null,
    null,
    null
  )
  on conflict (event_key) do nothing;

  return jsonb_build_object(
    'ok', true,
    'provider_id', v_provider_id,
    'event_key', v_event_key,
    'request_rid', v_request_rid
  );
end;
$$;

grant execute on function public.lp_provider_create(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'lp_provider_create'
      and p.prosecdef
  ) then
    raise exception 'TPT-A-2: lp_provider_create missing or not SECURITY DEFINER';
  end if;
end
$$;

commit;
