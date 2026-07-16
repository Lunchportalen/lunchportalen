import { check, sleep } from 'k6';

import { authParams, ensureActorLogin, logout, primeVercelBypass } from './auth.js';
import { getActorConfig, stagingOrderDate, FOREIGN_KITCHEN_LOCATION_ID, STAGING_KITCHEN_COMPANY_ID, STAGING_KITCHEN_LOCATION_ID } from './actors.js';
import { lpGet } from './httpClient.js';
import { getConfig } from './data.js';
import { getSmokeThresholds } from './thresholds.js';

function isJsonOk(res) {
  if (res.status < 200 || res.status >= 300) return false;
  try {
    const body = res.json();
    return body && body.ok === true;
  } catch {
    return false;
  }
}

function authedGet(baseUrl, path, scenario, endpoint) {
  return lpGet(`${baseUrl}${path}`, authParams(scenario, endpoint));
}

export function runEmployeeScenario() {
  const config = getConfig();
  const actor = getActorConfig('employee');
  check(null, {
    'employee credentials configured': () => Boolean(actor.email && actor.password),
  });
  if (!actor.email || !actor.password) return;
  ensureActorLogin('employee', actor.email, actor.password);

  const week = authedGet(config.baseUrl, '/api/week', 'employee', 'week_browse');
  check(week, {
    'employee week 2xx': (r) => r.status >= 200 && r.status < 300,
    'employee week ok': (r) => isJsonOk(r),
    'employee daily context': (r) => {
      try {
        const body = r.json();
        const days = body?.data?.days ?? body?.data?.week?.days ?? [];
        return Array.isArray(days) && days.length > 0;
      } catch {
        return false;
      }
    },
  });

  logout(config.baseUrl, 'employee');
  sleep(0.1);
}

export function runProviderAdminScenario() {
  const config = getConfig();
  const actor = getActorConfig('provider_admin');
  check(null, {
    'provider_admin credentials configured': () => Boolean(actor.email && actor.password),
  });
  if (!actor.email || !actor.password) return;
  ensureActorLogin('provider_admin', actor.email, actor.password);

  const invoices = authedGet(config.baseUrl, '/api/provider/invoices', 'provider_admin', 'provider_invoices');
  check(invoices, {
    'provider invoices 2xx': (r) => r.status >= 200 && r.status < 300,
    'provider invoices ok': (r) => isJsonOk(r),
  });

  logout(config.baseUrl, 'provider_admin');
  sleep(0.1);
}

export function runKitchenScenario() {
  const config = getConfig();
  const actor = getActorConfig('kitchen');
  check(null, {
    'kitchen credentials configured': () => Boolean(actor.email && actor.password),
  });
  if (!actor.email || !actor.password) return;
  ensureActorLogin('kitchen', actor.email, actor.password);
  const date = stagingOrderDate();

  const own = authedGet(config.baseUrl, `/api/kitchen/orders?date=${date}`, 'kitchen', 'kitchen_own');
  check(own, {
    'kitchen own 2xx': (r) => r.status >= 200 && r.status < 300,
    'kitchen own ok': (r) => isJsonOk(r),
  });

  const foreign = authedGet(
    config.baseUrl,
    `/api/kitchen/orders?date=${date}&location_id=${FOREIGN_KITCHEN_LOCATION_ID}`,
    'kitchen',
    'kitchen_foreign',
  );
  check(foreign, {
    'kitchen foreign denied or scoped': (r) => {
      if (r.status === 403 || r.status === 404) return true;
      if (r.status !== 200 || !isJsonOk(r)) return false;
      try {
        const body = r.json();
        const slots = body?.data?.slots ?? [];
        for (const slot of slots) {
          for (const company of slot.companies ?? []) {
            if (company.companyId && company.companyId !== STAGING_KITCHEN_COMPANY_ID) return false;
            for (const loc of company.locations ?? []) {
              if (loc.locationId === FOREIGN_KITCHEN_LOCATION_ID) return false;
              if (loc.locationId && loc.locationId !== STAGING_KITCHEN_LOCATION_ID) return false;
            }
          }
        }
        return true;
      } catch {
        return false;
      }
    },
  });

  logout(config.baseUrl, 'kitchen');
  sleep(0.1);
}

export function runSuperadminScenario() {
  const config = getConfig();
  const actor = getActorConfig('superadmin');
  check(null, {
    'superadmin credentials configured': () => Boolean(actor.email && actor.password),
  });
  if (!actor.email || !actor.password) return;
  ensureActorLogin('superadmin', actor.email, actor.password);

  const health = authedGet(config.baseUrl, '/api/superadmin/system/health', 'superadmin', 'superadmin_health');
  check(health, {
    'superadmin health 2xx': (r) => r.status >= 200 && r.status < 300,
    'superadmin health ok': (r) => isJsonOk(r),
  });

  logout(config.baseUrl, 'superadmin');
  sleep(0.1);
}

export function runHealthScenario() {
  const config = getConfig();
  primeVercelBypass(config.baseUrl);
  const health = lpGet(`${config.baseUrl}/api/health`, authParams('health', 'health'));
  check(health, {
    'health 2xx': (r) => r.status >= 200 && r.status < 300,
    'health ok': (r) => isJsonOk(r),
  });
}

export function getStagingRuntimeThresholds() {
  return getSmokeThresholds(__ENV.K6_TAG_ENV || 'staging');
}
