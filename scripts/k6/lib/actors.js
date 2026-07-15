/**
 * Staging k6 actors — separate credentials per role (never shared).
 */

export const STAGING_ACTOR_KEYS = ['employee', 'provider_admin', 'kitchen', 'superadmin'];

export const STAGING_SMOKE_ORDER_DATE = '2026-06-04';

export function getActorConfig(key) {
  const map = {
    employee: {
      email: __ENV.K6_EMPLOYEE_EMAIL || __ENV.E2E_EMPLOYEE_EMAIL || __ENV.K6_SMOKE_EMAIL || '',
      password: __ENV.K6_EMPLOYEE_PASSWORD || __ENV.E2E_EMPLOYEE_PASSWORD || __ENV.K6_SMOKE_PASSWORD || '',
    },
    provider_admin: {
      email:
        __ENV.K6_PROVIDER_ADMIN_EMAIL ||
        __ENV.E2E_PROVIDER_ADMIN_EMAIL ||
        __ENV.MELHUS_PROVIDER_ADMIN_EMAIL ||
        '',
      password:
        __ENV.K6_PROVIDER_ADMIN_PASSWORD ||
        __ENV.E2E_PROVIDER_ADMIN_PASSWORD ||
        __ENV.MELHUS_PROVIDER_ADMIN_PASSWORD ||
        '',
    },
    kitchen: {
      email:
        __ENV.K6_KITCHEN_EMAIL ||
        __ENV.E2E_PROVIDER_KITCHEN_EMAIL ||
        __ENV.E2E_KITCHEN_EMAIL ||
        __ENV.E2E_TEST_USER_EMAIL ||
        '',
      password:
        __ENV.K6_KITCHEN_PASSWORD ||
        __ENV.E2E_PROVIDER_KITCHEN_PASSWORD ||
        __ENV.E2E_KITCHEN_PASSWORD ||
        __ENV.E2E_TEST_USER_PASSWORD ||
        '',
    },
    superadmin: {
      email: __ENV.K6_SUPERADMIN_EMAIL || __ENV.E2E_SUPERADMIN_EMAIL || '',
      password: __ENV.K6_SUPERADMIN_PASSWORD || __ENV.E2E_SUPERADMIN_PASSWORD || '',
    },
  };
  return { key, ...map[key] };
}

export function requireActor(key) {
  const actor = getActorConfig(key);
  if (!actor.email || !actor.password) {
    throw new Error(`Missing credentials for k6 actor "${key}"`);
  }
  return actor;
}

export function stagingOrderDate() {
  return __ENV.K6_STAGING_ORDER_DATE || STAGING_SMOKE_ORDER_DATE;
}

/** Foreign location for negative kitchen scope checks. */
export const FOREIGN_KITCHEN_LOCATION_ID = '00000000-0000-0000-0000-000000000099';
