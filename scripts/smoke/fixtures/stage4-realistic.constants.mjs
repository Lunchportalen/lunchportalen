/**
 * Stage 4-B realistic uigx fixture (Company A + second location, multi-employee).
 * Operative slot on prod/uigx baseline: `default` (orders_slot_check).
 */
import {
  SMOKE_COMPANY_ID,
  SMOKE_LOCATION_ID,
  SMOKE_ORDER_DATE,
} from "./smoke-menu-fixture.constants.mjs";

export { SMOKE_COMPANY_ID, SMOKE_LOCATION_ID, SMOKE_ORDER_DATE };

/** Second location (same company) — leakage tests. */
export const SMOKE_LOCATION_B_ID = "a2222222-2222-4222-8222-222222222222";

/** Canonical operative slot (matches orders + kitchen_batches on baseline). */
export const SMOKE_OPERATIVE_SLOT = "default";

/** Employees */
export const SMOKE_EMPLOYEE_A1 = "9daa921f-44a0-43bf-9630-da14a46c820f";
export const SMOKE_EMPLOYEE_A2 = "e2222222-2222-4222-8222-222222222222";
export const SMOKE_EMPLOYEE_B1 = "e3333333-3333-4333-8333-333333333333";

/** Kitchen operators (profiles.id = auth id when provisioned). */
export const SMOKE_KITCHEN_USER_A = "d1111111-1111-4111-8111-111111111111";
export const SMOKE_KITCHEN_USER_B = "d2222222-2222-4222-8222-222222222222";

/** Driver at location A only */
export const SMOKE_DRIVER_USER_A = "f1111111-1111-4111-8111-111111111111";

export const REALISTIC_ORDER_IDS = {
  a1: "c1111111-1111-4111-8111-000000000001",
  a2: "c1111111-1111-4111-8111-000000000002",
  b1: "c1111111-1111-4111-8111-000000000003",
};
