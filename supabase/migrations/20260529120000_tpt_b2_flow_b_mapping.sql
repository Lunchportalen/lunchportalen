-- TPT-B-2 — Flow B mapping (company as customer in provider's Tripletex) + provider_tripletex_products

begin;

-- ---------------------------------------------------------------------------
-- 1) tripletex_customers: allow Flow B (company_id + provider_id both set)
-- ---------------------------------------------------------------------------
alter table public.tripletex_customers
  drop constraint if exists tripletex_customers_scope_check;

alter table public.tripletex_customers
  add constraint tripletex_customers_scope_check
  check (company_id is not null or provider_id is not null);

alter table public.tripletex_customers
  drop constraint if exists tripletex_customers_company_id_key;

alter table public.tripletex_customers
  drop constraint if exists tripletex_customers_provider_id_key;

drop index if exists public.tripletex_customers_company_id_key;
drop index if exists public.tripletex_customers_provider_id_key;

create unique index if not exists tripletex_customers_company_lp_only
  on public.tripletex_customers (company_id)
  where provider_id is null and company_id is not null;

create unique index if not exists tripletex_customers_provider_lp_only
  on public.tripletex_customers (provider_id)
  where company_id is null and provider_id is not null;

create unique index if not exists tripletex_customers_provider_company
  on public.tripletex_customers (provider_id, company_id)
  where company_id is not null and provider_id is not null;

comment on constraint tripletex_customers_scope_check on public.tripletex_customers is
  'Flow A Lp: company_id XOR provider_id. Flow B: both set (company customer in provider Tripletex).';

-- ---------------------------------------------------------------------------
-- 2) provider_tripletex_products (per-provider product + VAT mapping)
-- ---------------------------------------------------------------------------
create table if not exists public.provider_tripletex_products (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  tier text not null check (tier in ('BASIS', 'LUXUS', 'ENTERPRISE')),
  tripletex_product_id text not null,
  tripletex_vat_code text not null,
  env text not null default 'prod' check (env in ('test', 'prod')),
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, tier, env)
);

create index if not exists idx_provider_tripletex_products_provider
  on public.provider_tripletex_products (provider_id);

comment on table public.provider_tripletex_products is
  'Per-provider Tripletex product + VAT mapping for meal tiers (Flow B). TPT-B-2.';

alter table public.provider_tripletex_products enable row level security;

revoke all on public.provider_tripletex_products from public;
revoke all on public.provider_tripletex_products from anon;

grant select on public.provider_tripletex_products to authenticated;
grant all on public.provider_tripletex_products to service_role;

drop policy if exists provider_tripletex_products_superadmin_all
  on public.provider_tripletex_products;
create policy provider_tripletex_products_superadmin_all
  on public.provider_tripletex_products
  as permissive for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists provider_tripletex_products_provider_select
  on public.provider_tripletex_products;
create policy provider_tripletex_products_provider_select
  on public.provider_tripletex_products
  as permissive for select to authenticated
  using (public.can_access_provider(provider_id));

-- ---------------------------------------------------------------------------
-- 3) RPC: lp_company_provider_customer_create
-- ---------------------------------------------------------------------------
create or replace function public.lp_company_provider_customer_create(
  p_company_id uuid,
  p_provider_id uuid,
  p_env text default 'prod',
  p_request_rid text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_env text := lower(btrim(coalesce(p_env, 'prod')));
  v_actor uuid := auth.uid();
  v_company public.companies%rowtype;
  v_event_key text;
  v_request_rid text;
  v_outbox_id bigint;
begin
  perform private.lp_assert_provider_admin_or_superadmin(p_provider_id);

  if v_env not in ('test', 'prod') then
    raise exception 'INVALID_ENV' using errcode = '22023';
  end if;

  select * into v_company
  from public.companies c
  where c.id = p_company_id;

  if not found then
    raise exception 'COMPANY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_company.provider_id is distinct from p_provider_id then
    raise exception 'COMPANY_PROVIDER_MISMATCH' using errcode = 'P0001';
  end if;

  v_request_rid := coalesce(
    nullif(btrim(coalesce(p_request_rid, '')), ''),
    replace(gen_random_uuid()::text, '-', '')
  );
  v_event_key := format(
    'tripletex.company_customer_create_provider:%s:%s',
    p_company_id::text,
    p_provider_id::text
  );

  insert into public.outbox (event_key, payload, status, attempts, last_error, locked_at, locked_by)
  values (
    v_event_key,
    jsonb_build_object(
      'company_id', p_company_id,
      'provider_id', p_provider_id,
      'env', v_env,
      'request_rid', v_request_rid
    ),
    'PENDING',
    0,
    null,
    null,
    null
  )
  on conflict (event_key) do nothing
  returning id into v_outbox_id;

  if v_outbox_id is null then
    select o.id into v_outbox_id
    from public.outbox o
    where o.event_key = v_event_key;
  end if;

  insert into public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  values (
    v_actor,
    'company_provider_customer_enqueue',
    'tripletex_sync',
    p_company_id,
    null,
    jsonb_build_object(
      'company_id', p_company_id,
      'provider_id', p_provider_id,
      'env', v_env,
      'event_key', v_event_key,
      'request_rid', v_request_rid,
      'outbox_id', v_outbox_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'company_id', p_company_id,
    'provider_id', p_provider_id,
    'env', v_env,
    'event_key', v_event_key,
    'outbox_id', v_outbox_id,
    'request_rid', v_request_rid
  );
end;
$$;

grant execute on function public.lp_company_provider_customer_create(uuid, uuid, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Post-checks
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'tripletex_customers_scope_check'
      and conrelid = 'public.tripletex_customers'::regclass
  ) then
    raise exception 'TPT-B-2: tripletex_customers_scope_check missing';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'provider_tripletex_products'
  ) then
    raise exception 'TPT-B-2: provider_tripletex_products table missing';
  end if;

  if not exists (
    select 1 from pg_proc where proname = 'lp_company_provider_customer_create' and prosecdef
  ) then
    raise exception 'TPT-B-2: lp_company_provider_customer_create missing or not SECURITY DEFINER';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
