/**
 * SLO thresholds for Lunchportalen k6 live suite.
 * Prod = strict SLO. Staging = loose (+ Vercel bypass 307→200 overhead).
 */

const GLOBAL = {
  http_req_failed: [
    'rate<0.01',
    { threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' },
  ],
  'http_req_duration{expected:true}': ['p(95)<800'],
  http_req_duration: [{ threshold: 'p(99)<5000', abortOnFail: true, delayAbortEval: '30s' }],
};

const PROD = {
  health_duration: ['p(95)<200'],
  week_browse_duration: ['p(95)<800'],
  order_place_duration: ['p(95)<1500'],
  day_view_duration: ['p(95)<600'],
  kitchen_view_duration: ['p(95)<800'],
};

const STAGING = {
  health_duration: ['p(95)<1000'],
  week_browse_duration: ['p(95)<1500'],
  order_place_duration: ['p(95)<2500'],
  day_view_duration: ['p(95)<1200'],
  kitchen_view_duration: ['p(95)<1500'],
};

/**
 * @param {string} [env] K6_TAG_ENV — 'prod' | 'staging'
 */
export function getThresholds(env) {
  const tagEnv = env || (typeof __ENV !== 'undefined' ? __ENV.K6_TAG_ENV : '') || 'staging';
  if (tagEnv === 'prod') {
    return { ...GLOBAL, ...PROD };
  }
  if (tagEnv === 'staging') {
    return {
      ...GLOBAL,
      ...STAGING,
      'http_req_duration{expected:true}': ['p(95)<1500'],
    };
  }
  throw new Error(`Unknown K6_TAG_ENV: ${tagEnv}`);
}
