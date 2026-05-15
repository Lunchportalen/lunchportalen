/**
 * Role-scoped order/menu projections (FASE 13-IMPL-3F).
 * Employees must never receive economic fields in JSON contracts.
 *
 * @see docs/architecture/employee-vs-admin-price-visibility.md
 */

/** Raw status from public.orders (order_status / text). */
export type OrdersTableStatus = string;

/** @alias OrdersTableStatus — DB `orders.status` */
export type OrderStatus = OrdersTableStatus;

export type EmployeeOrderView = {
  id: string;
  user_id: string;
  service_date: string;
  status: OrderStatus;
  slot: string | null;
  note: string | null;
  cutoff_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeOrderItemView = {
  order_id: string;
  product_name_snapshot: string;
  unit_name_snapshot: string | null;
  quantity: number;
};

export type AdminOrderView = EmployeeOrderView & {
  unit_price_nok: number | null;
  subtotal_cents_ex_vat: number | null;
  vat_cents: number | null;
  gross_cents_inc_vat: number | null;
  company_id: string;
  location_id: string;
};

export type AdminOrderItemView = EmployeeOrderItemView & {
  product_id: string;
  unit_price_cents_ex_vat: number;
  vat_rate_snapshot: number;
  line_subtotal_cents_ex_vat: number;
  line_vat_cents: number;
  line_total_cents_inc_vat: number;
  menu_service_day_item_id: string;
  allergens_snapshot: unknown;
  dietary_tags_snapshot: unknown;
};

export type EmployeeMenuItemView = {
  product_name_snapshot: string;
  unit_name_snapshot: string | null;
  category: string;
};

export type AdminMenuItemView = EmployeeMenuItemView & {
  offered_price_cents_ex_vat: number;
  vat_rate_snapshot: number;
};
