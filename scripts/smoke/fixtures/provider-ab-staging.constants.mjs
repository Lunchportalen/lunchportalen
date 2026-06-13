/**
 * Deterministic Provider A/B staging fixture (uigxsboqeruxflgzqztl only).
 * Used by seed-provider-ab-fixture.mjs and seed-provider-ab-sanity.mjs.
 *
 * No passwords. No secrets. No prod URLs.
 */
import {
  SMOKE_BASIS_PRICE_CENTS,
  SMOKE_CATEGORY_NAME,
  SMOKE_CHOICE_KEY,
  SMOKE_COMPANY_ID,
  SMOKE_LOCATION_ID,
  SMOKE_MENU_ITEM_ID,
  SMOKE_MENU_SERVICE_DAY_ID,
  SMOKE_ORDER_DATE,
  SMOKE_PRODUCT_CATEGORY_ID,
  SMOKE_PRODUCT_ID,
} from "./smoke-menu-fixture.constants.mjs";

export const STAGING_PROJECT_REF = "uigxsboqeruxflgzqztl";
export const PROD_PROJECT_REF = "hkpokyapzarefrgqzkos";

/** Shared fixture window — Wednesday in agreement range. */
export const FIXTURE_DATE = SMOKE_ORDER_DATE;
export const FIXTURE_TIER = "BASIS";
/** Sanity menuDay category (Norwegian slug). DB choice_key remains `varmmat`. */
export const FIXTURE_MENU_CATEGORY_SANITY = "varmrett";
export const FIXTURE_MENU_CATEGORY_DB = SMOKE_CATEGORY_NAME;
export const FIXTURE_CHOICE_KEY = SMOKE_CHOICE_KEY;
export const FIXTURE_BASIS_PRICE_CENTS = SMOKE_BASIS_PRICE_CENTS;

export const ALLOWED_TEST_EMAIL_DOMAINS = ["test.lunchportalen.no", "smoke.lunchportalen.no"];

/** Provider A — Melhus / existing Company A (agreements-test). */
export const PROVIDER_A = {
  providerId: "11111111-1111-1111-1111-111111111111",
  slug: "melhus-catering",
  name: "Melhus Catering AS",
  companyId: SMOKE_COMPANY_ID,
  locationId: SMOKE_LOCATION_ID,
  agreementId: "2356f773-3d59-407e-9fba-536dbb44b2e2",
  serviceAreaId: "a1111111-1111-4111-8111-111111111111",
  testPostalCode: "7010",
  coverageFrom: "7000",
  coverageTo: "7099",
  coverageCity: "Trondheim",
  opsEmail: "provider-a-ops@test.lunchportalen.no",
  kitchenEmail: "provider-a-kitchen@test.lunchportalen.no",
  deliveryEmail: "provider-a-delivery@test.lunchportalen.no",
  menuLabel: "A: Fiskesuppe fixture",
  productId: SMOKE_PRODUCT_ID,
  menuServiceDayId: SMOKE_MENU_SERVICE_DAY_ID,
  menuItemId: SMOKE_MENU_ITEM_ID,
  productCategoryId: SMOKE_PRODUCT_CATEGORY_ID,
  productSku: "lp-smoke-varmmat-provider-a",
  sanityMenuDayDocId: `menuDay-${SMOKE_ORDER_DATE}-${FIXTURE_TIER}-${FIXTURE_MENU_CATEGORY_SANITY}`,
};

/** Provider B — staging-only second provider (disjoint coverage). */
export const PROVIDER_B = {
  providerId: "22222222-2222-2222-2222-222222222222",
  slug: "staging-provider-b",
  name: "Staging Provider B AS",
  companyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  locationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  agreementId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  serviceAreaId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  orgnr: "988888888",
  testPostalCode: "0150",
  coverageFrom: "0150",
  coverageTo: "0199",
  coverageCity: "Oslo",
  contactEmail: "provider-b-contact@test.lunchportalen.no",
  opsEmail: "provider-b-ops@test.lunchportalen.no",
  kitchenEmail: "provider-b-kitchen@test.lunchportalen.no",
  deliveryEmail: "provider-b-delivery@test.lunchportalen.no",
  menuLabel: "B: Kyllingwok fixture",
  productId: "b1111111-1111-4111-8111-000000000010",
  menuServiceDayId: "b1111111-1111-4111-8111-000000000011",
  menuItemId: "b1111111-1111-4111-8111-000000000012",
  productSku: "lp-smoke-varmmat-provider-b",
  sanityMenuDayDocId: `menuDay-${"22222222-2222-2222-2222-222222222222"}-${SMOKE_ORDER_DATE}-${FIXTURE_TIER}-${FIXTURE_MENU_CATEGORY_SANITY}`,
  sanityProviderDocId: "22222222-2222-2222-2222-222222222222",
};

/** Auth e-mails for a follow-up provision script (credentials via env only). */
export const PROVIDER_B_PROVISION_EMAILS = {
  providerAdmin: "e2e.provider-b-portal@test.lunchportalen.no",
  providerKitchen: "kitchen-b@smoke.lunchportalen.no",
  companyAdmin: "e2e.provider-b-admin@test.lunchportalen.no",
  employee: "e2e.provider-b-employee@test.lunchportalen.no",
};

/** All deterministic fixture entity IDs (for scope-limited UPDATE/UPSERT). */
export const FIXTURE_SCOPED_IDS = {
  providerIds: [PROVIDER_A.providerId, PROVIDER_B.providerId],
  companyIds: [PROVIDER_A.companyId, PROVIDER_B.companyId],
  locationIds: [PROVIDER_A.locationId, PROVIDER_B.locationId],
  agreementIds: [PROVIDER_A.agreementId, PROVIDER_B.agreementId],
  serviceAreaIds: [PROVIDER_A.serviceAreaId, PROVIDER_B.serviceAreaId],
  menuServiceDayIds: [PROVIDER_A.menuServiceDayId, PROVIDER_B.menuServiceDayId],
};
