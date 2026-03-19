-- Tenant RLS fix: canonical schema has profiles.id = auth.users(id); user_id column was dropped in bootstrap.
-- Policies that referenced p.user_id fail at runtime when the column does not exist (fail-closed but broken).
-- This migration recreates tenant policies to use p.id = auth.uid() so SELECT is correctly bounded.
-- Does not weaken RLS: same tenant logic, correct column for canonical schema.

begin;

-- 1) profiles – self-only read (canonical: id is the user id)
do $$
begin
  if to_regclass('public.profiles') is null then
    return;
  end if;
  drop policy if exists profiles_self_select on public.profiles;
  create policy profiles_self_select
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());
end
$$;

-- 2) companies – tenant-bounded read
do $$
begin
  if to_regclass('public.companies') is null or to_regclass('public.profiles') is null then
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
      where p.id = auth.uid()
        and p.company_id = companies.id
    )
  );
end
$$;

-- 3) company_locations – tenant-bounded read
do $$
begin
  if to_regclass('public.company_locations') is null or to_regclass('public.profiles') is null then
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
      where p.id = auth.uid()
        and p.company_id = company_locations.company_id
    )
  );
end
$$;

-- 4) agreements – tenant-bounded read
do $$
begin
  if to_regclass('public.agreements') is null or to_regclass('public.profiles') is null then
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
      where p.id = auth.uid()
        and p.company_id = agreements.company_id
    )
  );
end
$$;

-- 5) orders – kitchen/driver scope
do $$
begin
  if to_regclass('public.orders') is null or to_regclass('public.profiles') is null then
    return;
  end if;
  drop policy if exists orders_kitchen_driver_scope_read on public.orders;
  create policy orders_kitchen_driver_scope_read
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role in ('kitchen', 'driver')
        and coalesce(p.active, true) = true
        and p.company_id is not null
        and p.location_id is not null
        and p.company_id = orders.company_id
        and p.location_id = orders.location_id
    )
  );
end
$$;

-- 6) orders – employee self read
do $$
begin
  if to_regclass('public.orders') is null or to_regclass('public.profiles') is null then
    return;
  end if;
  drop policy if exists orders_employee_self_read on public.orders;
  create policy orders_employee_self_read
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'employee'
        and p.company_id = orders.company_id
        and p.location_id = orders.location_id
        and orders.user_id = auth.uid()
    )
  );
end
$$;

-- 7) orders – company_admin tenant read
do $$
begin
  if to_regclass('public.orders') is null or to_regclass('public.profiles') is null then
    return;
  end if;
  drop policy if exists orders_company_admin_tenant_read on public.orders;
  create policy orders_company_admin_tenant_read
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'company_admin'
        and p.company_id = orders.company_id
    )
  );
end
$$;

commit;
