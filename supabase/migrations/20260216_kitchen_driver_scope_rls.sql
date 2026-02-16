-- 20260216_kitchen_driver_scope_rls.sql
-- LOCKED DECISION: kitchen/driver are TENANT-BOUND (company_id + location_id).
-- Fail-closed read scope on public.orders for kitchen/driver.

alter table if exists public.orders enable row level security;

drop policy if exists orders_kitchen_driver_scope_read on public.orders;

create policy orders_kitchen_driver_scope_read
on public.orders
for select
to authenticated
using (
  not exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('kitchen', 'driver')
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('kitchen', 'driver')
      and p.is_active = true
      and p.company_id is not null
      and p.location_id is not null
      and p.company_id = orders.company_id
      and p.location_id = orders.location_id
  )
);
