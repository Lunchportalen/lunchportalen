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

/**
 * Service-role / supabaseAdmin reads der enhetsøkonomi ikke trengs (kitchen operative, driver, cron sanity).
 * App-side projection — samme kontrollflate som employee-kolonner.
 */
export const KITCHEN_OPERATIVE_ORDER_COLUMNS =
  "id, user_id, company_id, location_id, note, status, slot";

/** Service-role driver-liste når operativ dato-path ikke brukes. */
export const DRIVER_FALLBACK_ORDER_COLUMNS = "id, date, slot, status, company_id, location_id";

/** Fallback fra `orders` når `daily_employee_orders` mangler (kjøkken-feed). */
export const KITCHEN_FEED_ORDER_COLUMNS = "company_id, location_id, slot, user_id, note, status";

/** Batch summary / kjøkken-print — grouping på slot og lokasjon. */
export const KITCHEN_BATCH_SUMMARY_ORDER_COLUMNS = "slot, location_id, company_id, user_id, date";

/** GET /api/kitchen/company — per ordre-rad uten pris. */
export const KITCHEN_COMPANY_ORDERS_COLUMNS = "id, user_id, location_id, note, created_at";

/** fetchKitchenDayData — hvem har bestilt (sanning for produksjon). */
export const KITCHEN_DAY_DATA_ORDER_COLUMNS =
  "id, user_id, company_id, location_id, date, note, created_at, status, slot";

/** Ukesrapport (kitchen) — metadata for gruppering, ikke pris. */
export const KITCHEN_REPORT_ORDER_COLUMNS =
  "id, user_id, date, status, note, company_id, location_id, slot";

/** Cron: daglig ordre-e-postsammendrag (provider_id for provider-routet utsendelse). */
export const CRON_DAILY_ORDER_SUMMARY_COLUMNS = "id, company_id, location_id, user_id, slot, provider_id";

/** Cron: meal-learning felt for aggregat. */
export const CRON_MEAL_LEARNING_ORDER_COLUMNS = "id, date, status, company_id, location_id";

/** Cron daily-sanity: status histogram (ingen økonomi). */
export const CRON_SANITY_ORDER_STATUS_COLUMNS = "status";

/** Cron daily-sanity: felt-sjekk og nylige rader (ingen økonomi). */
export const CRON_SANITY_ORDER_MISSING_FIELDS_COLUMNS = "id, date, slot, company_id, location_id";
export const CRON_SANITY_ORDER_RECENT_COLUMNS = "id, created_at, updated_at, date";

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
