import { check, sleep } from 'k6';

import { authParams } from './auth.js';
import { lpGet, lpPost } from './httpClient.js';
import {
  getConfig,
  idempotencyKey,
  orderTargetDate,
  osloTodayISO,
  pickWorkloadEndpoint,
  requestTags,
} from './data.js';
import { recordEndpointMetric } from './metrics.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function isJsonOk(res) {
  if (res.status < 200 || res.status >= 300) {
    return false;
  }
  try {
    const body = res.json();
    return body && body.ok === true;
  } catch {
    return false;
  }
}

function isAcceptableOrderStatus(status) {
  // 200 success, 409 duplicate, 422 business validation — not infra failure
  return status === 200 || status === 409 || status === 422;
}

export function checkWeekBrowse(baseUrl, scenario) {
  const tags = requestTags(scenario, 'week_browse');
  const res = lpGet(baseUrl, '/api/week', authParams(scenario, 'week_browse'));
  recordEndpointMetric('week_browse', res.timings.duration);
  check(res, {
    'week status 2xx': (r) => r.status >= 200 && r.status < 300,
    'week ok body': (r) => isJsonOk(r),
  });
  return res;
}

export function checkDayView(baseUrl, scenario) {
  const date = osloTodayISO();
  const tags = requestTags(scenario, 'day_view');
  const res = lpGet(
    baseUrl,
    `/api/orders?date=${date}`,
    authParams(scenario, 'day_view'),
  );
  recordEndpointMetric('day_view', res.timings.duration);
  check(res, {
    'day_view status 2xx': (r) => r.status >= 200 && r.status < 300,
    'day_view ok body': (r) => isJsonOk(r),
  });
  return res;
}

export function checkKitchenView(baseUrl, scenario) {
  const tags = requestTags(scenario, 'kitchen_view');
  const res = lpGet(
    baseUrl,
    '/api/kitchen/today',
    { ...authParams(scenario, 'kitchen_view'), redirects: 0 },
  );
  recordEndpointMetric('kitchen_view', res.timings.duration);
  check(res, {
    'kitchen redirect or ok': (r) =>
      (r.status >= 200 && r.status < 300) || r.status === 307 || r.status === 308,
  });
  return res;
}

export function checkHealth(baseUrl, scenario) {
  const tags = requestTags(scenario, 'health');
  const res = lpGet(baseUrl, '/api/health', authParams(scenario, 'health'));
  recordEndpointMetric('health', res.timings.duration);
  check(res, {
    'health status 2xx': (r) => r.status >= 200 && r.status < 300,
    'health ok body': (r) => isJsonOk(r),
  });
  return res;
}

export function checkOrderPlace(baseUrl, scenario, config, vu, iter) {
  const date = orderTargetDate(vu, iter);
  const idem = idempotencyKey(config, vu, iter, date);
  const tags = requestTags(scenario, 'order_place', { write: 'true' });
  const res = lpPost(
    baseUrl,
    '/api/orders',
    JSON.stringify({
      date,
      action: 'SET',
      note: '',
      slot: 'default',
    }),
    {
      headers: {
        ...JSON_HEADERS,
        'Idempotency-Key': idem,
      },
      tags,
    },
  );
  recordEndpointMetric('order_place', res.timings.duration);
  check(res, {
    'order_place acceptable': (r) => isAcceptableOrderStatus(r.status),
    'order_place not 5xx': (r) => r.status < 500,
  });
  return res;
}

const ENDPOINT_RUNNERS = {
  week_browse: (baseUrl, scenario) => checkWeekBrowse(baseUrl, scenario),
  day_view: (baseUrl, scenario) => checkDayView(baseUrl, scenario),
  kitchen_view: (baseUrl, scenario) => checkKitchenView(baseUrl, scenario),
  health: (baseUrl, scenario) => checkHealth(baseUrl, scenario),
};

/** Weighted mixed workload (baseline / soak / stress / spike / recovery). */
export function runMixedWorkload(scenario) {
  const config = getConfig();
  const vu = __VU;
  const iter = __ITER;
  const endpoint = pickWorkloadEndpoint(vu + iter + Date.now());

  if (endpoint === 'order_place') {
    checkOrderPlace(config.baseUrl, scenario, config, vu, iter);
    return;
  }

  const runner = ENDPOINT_RUNNERS[endpoint];
  if (runner) {
    runner(config.baseUrl, scenario);
  }
}

/** Sequential pre-warm / smoke verification of all endpoints. */
export function verifyAllEndpoints(scenario) {
  const config = getConfig();
  const vu = __VU;
  const iter = __ITER;

  checkWeekBrowse(config.baseUrl, scenario);
  sleep(0.2);
  checkDayView(config.baseUrl, scenario);
  sleep(0.2);
  checkKitchenView(config.baseUrl, scenario);
  sleep(0.2);
  checkHealth(config.baseUrl, scenario);
  sleep(0.2);
  checkOrderPlace(config.baseUrl, scenario, config, vu, iter);
}
