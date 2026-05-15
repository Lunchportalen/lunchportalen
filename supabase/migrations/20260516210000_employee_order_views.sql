-- FASE 13-IMPL-3F (review only — do not apply to prod without sign-off)
-- Defense-in-depth: column-pruned views on orders / order_items.
-- App-side projection remains primary; these views document the employee-safe contract.
--
-- Notes:
-- - With security_invoker = true (PG15+), privileges and RLS are evaluated as the querying role
--   against the underlying tables.
-- - Complement with grants/policies consistent with public.orders / public.order_items.

create or replace view public.employee_orders as
select
  o.id,
  o.user_id,
  o.service_date,
  o.status,
  o.slot,
  o.note,
  o.cutoff_at,
  o.created_at,
  o.updated_at
from public.orders o;

comment on view public.employee_orders is
  'Non-price projection of orders for employee-safe reads (complement to app-side pickOrderColumns).';

create or replace view public.employee_order_items as
select
  oi.order_id,
  oi.product_name_snapshot,
  oi.unit_name_snapshot,
  oi.quantity
from public.order_items oi;

comment on view public.employee_order_items is
  'Non-price projection of order_lines for employee-safe reads.';

do $m$
begin
  execute 'alter view public.employee_orders set (security_invoker = true)';
exception
  when undefined_object then null;
  when others then
    raise notice 'employee_orders security_invoker: %', sqlerrm;
end;
$m$;

do $m$
begin
  execute 'alter view public.employee_order_items set (security_invoker = true)';
exception
  when undefined_object then null;
  when others then
    raise notice 'employee_order_items security_invoker: %', sqlerrm;
end;
$m$;

grant select on public.employee_orders to authenticated;
grant select on public.employee_order_items to authenticated;
