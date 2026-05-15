/**
 * Column lists for Supabase `.select(...)` — app-side projection (primary control plane).
 *
 * @see docs/architecture/employee-vs-admin-price-visibility.md
 */

const EMPLOYEE_ORDER_COLUMNS =
  "id, user_id, date, service_date, status, slot, note, cutoff_at, " + "created_at, updated_at";

const ADMIN_ORDER_COLUMNS =
  EMPLOYEE_ORDER_COLUMNS +
  ", company_id, location_id, unit_price_nok, " +
  "subtotal_cents_ex_vat, vat_cents, gross_cents_inc_vat";

const EMPLOYEE_ITEM_COLUMNS = "order_id, product_name_snapshot, unit_name_snapshot, quantity";

const ADMIN_ITEM_COLUMNS =
  EMPLOYEE_ITEM_COLUMNS +
  ", product_id, unit_price_cents_ex_vat, vat_rate_snapshot, " +
  "line_subtotal_cents_ex_vat, line_vat_cents, line_total_cents_inc_vat, " +
  "menu_service_day_item_id, allergens_snapshot, dietary_tags_snapshot";

const EMPLOYEE_MSDI_COLUMNS = "product_name_snapshot, unit_name_snapshot";

const ADMIN_MSDI_COLUMNS = EMPLOYEE_MSDI_COLUMNS + ", offered_price_cents_ex_vat, vat_rate_snapshot";

export const EMPLOYEE_ORDER_COLUMNS_WITH_LOCATION = EMPLOYEE_ORDER_COLUMNS + ", location_id";

export const ORDER_PRICE_FIELDS_ONLY =
  "unit_price_nok, subtotal_cents_ex_vat, vat_cents, gross_cents_inc_vat";

export function pickOrderColumns(showPrices: boolean): string {
  return showPrices ? ADMIN_ORDER_COLUMNS : EMPLOYEE_ORDER_COLUMNS;
}

export function pickItemColumns(showPrices: boolean): string {
  return showPrices ? ADMIN_ITEM_COLUMNS : EMPLOYEE_ITEM_COLUMNS;
}

export function pickMenuItemColumns(showPrices: boolean): string {
  return showPrices ? ADMIN_MSDI_COLUMNS : EMPLOYEE_MSDI_COLUMNS;
}
