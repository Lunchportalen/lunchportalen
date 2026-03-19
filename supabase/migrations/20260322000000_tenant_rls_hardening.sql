-- 20260322000000_tenant_rls_hardening.sql
-- Purpose:
-- - Close verified tenant-isolation gaps on core domain tables.
-- - Tighten overly-permissive RLS on public.orders.
-- - Add tenant-safe SELECT policies for companies, company_locations, agreements, profiles, orders.
--
-- Scope:
-- - SELECT-only policies for authenticated users.
-- - No change to INSERT/UPDATE/DELETE behavior (writes are already gated via RPC and service-role).

begin;

-- =========================================================
-- 0) Helpers
-- =========================================================

do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'user_role') then
    -- Enum already handled in earlier migrations; no-op here.
    null;
  end if;
end
$$;

-- =========================================================
-- 1) Enable RLS on tenant-sensitive core tables (idempotent)
-- =========================================================

do $$
begin
  if to_regclass('public.companies') is not null then
    execute 'alter table public.companies enable row level security';
  end if;

  if to_regclass('public.company_locations') is not null then
    execute 'alter table public.company_locations enable row level security';
  end if;

  if to_regclass('public.agreements') is not null then
    execute 'alter table public.agreements enable row level security';
  end if;

  if to_regclass('public.profiles') is not null then
    execute 'alter table public.profiles enable row level security';
  end if;

  if to_regclass('public.orders') is not null then
    execute 'alter table public.orders enable row level security';
  end if;
end
$$;

-- =========================================================
-- 2) public.profiles – self-only read for authenticated users
-- =========================================================

do $$
begin
  if to_regclass('public.profiles') is null then
    raise notice 'table public.profiles missing, skipping profiles RLS';
    return;
  end if;

  -- Narrow SELECT policy: authenticated users may read only their own profile row.
  -- Supports both schemas where auth.users.id is stored in profiles.id or profiles.user_id.
  drop policy if exists profiles_self_select on public.profiles;

  create policy profiles_self_select
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or (coalesce(user_id, id) = auth.uid())
  );
end
$$;

-- =========================================================
-- 3) public.companies – tenant-bounded read
-- =========================================================

do $$
begin
  if to_regclass('public.companies') is null or to_regclass('public.profiles') is null then
    raise notice 'companies/profiles missing, skipping companies RLS';
    return;
  end if;

  drop policy if exists companies_tenant_select on public.companies;

  create policy companies_tenant_select
  on public.companies
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = companies.id
    )
  );
end
$$;

-- =========================================================
-- 4) public.company_locations – tenant-bounded read
-- =========================================================

do $$
begin
  if to_regclass('public.company_locations') is null or to_regclass('public.profiles') is null then
    raise notice 'company_locations/profiles missing, skipping company_locations RLS';
    return;
  end if;

  drop policy if exists company_locations_tenant_select on public.company_locations;

  create policy company_locations_tenant_select
  on public.company_locations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = company_locations.company_id
    )
  );
end
$$;

-- =========================================================
-- 5) public.agreements – tenant-bounded read
-- =========================================================

do $$
begin
  if to_regclass('public.agreements') is null or to_regclass('public.profiles') is null then
    raise notice 'agreements/profiles missing, skipping agreements RLS';
    return;
  end if;

  drop policy if exists agreements_tenant_select on public.agreements;

  create policy agreements_tenant_select
  on public.agreements
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.company_id = agreements.company_id
    )
  );
end
$$;

-- =========================================================
-- 6) public.orders – tighten kitchen/driver policy + add tenant policies
-- =========================================================

do $$
begin
  if to_regclass('public.orders') is null or to_regclass('public.profiles') is null then
    raise notice 'orders/profiles missing, skipping orders RLS adjustments';
    return;
  end if;

  -- 6.1) Tighten existing kitchen/driver scope policy:
  --      Previously allowed all non-kitchen/driver users to read every order.
  --      Now only kitchen/driver with matching company/location can read.
  drop policy if exists orders_kitchen_driver_scope_read on public.orders;

  create policy orders_kitchen_driver_scope_read
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('kitchen', 'driver')
        and coalesce(p.active, true) = true
        and p.company_id is not null
        and p.location_id is not null
        and p.company_id = orders.company_id
        and p.location_id = orders.location_id
    )
  );

  -- 6.2) Employee: may only read own orders within their company/location.
  drop policy if exists orders_employee_self_read on public.orders;

  create policy orders_employee_self_read
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'employee'
        and p.company_id = orders.company_id
        and p.location_id = orders.location_id
        and orders.user_id = auth.uid()
    )
  );

  -- 6.3) Company admin: may read all orders for their own company (any location).
  drop policy if exists orders_company_admin_tenant_read on public.orders;

  create policy orders_company_admin_tenant_read
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'company_admin'
        and p.company_id = orders.company_id
    )
  );
end
$$;

commit;

