/**
 * Deterministic staging smoke menu fixture (uigxsboqeruxflgzqztl).
 * Used by seed-smoke-menu-fixture.mjs and dc-011 A6 idempotency test.
 */
export const SMOKE_EMAIL = "smoke-test@lunchportalen.no";
export const SMOKE_USER_ID = "b0e90b33-8c05-47f9-8f5f-96777575442d";
export const SMOKE_COMPANY_ID = "8b0b8fa4-8d89-4795-b92b-e09129dd635f";
export const SMOKE_LOCATION_ID = "f319b299-8914-4c52-9984-569ce07c914d";

/** Fixed Wednesday in agreement window; matches seeded menu_service_day. */
export const SMOKE_ORDER_DATE = "2026-06-04";

export const SMOKE_PRODUCT_CATEGORY_ID = "b1111111-1111-4111-8111-000000000002";
export const SMOKE_PRODUCT_ID = "b1111111-1111-4111-8111-000000000003";
export const SMOKE_MENU_SERVICE_DAY_ID = "b1111111-1111-4111-8111-000000000001";
export const SMOKE_MENU_ITEM_ID = "b1111111-1111-4111-8111-000000000004";

/** Must normalize (æ→e, strip non-alnum) to `varmmat` for choice_key match in lp_order_set. */
export const SMOKE_CATEGORY_NAME = "Varmmat";
export const SMOKE_PRODUCT_SKU = "lp-smoke-varmmat-default";
export const SMOKE_CHOICE_KEY = "varmmat";
export const SMOKE_BASIS_PRICE_CENTS = 9000;
