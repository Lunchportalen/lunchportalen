/**
 * Env helpers, date generators, idempotency keys, weighted workload picker.
 */

const WORKLOAD_WEIGHTS = [
  { name: 'week_browse', weight: 60 },
  { name: 'order_place', weight: 20 },
  { name: 'day_view', weight: 10 },
  { name: 'kitchen_view', weight: 5 },
  { name: 'health', weight: 5 },
];

const WEIGHT_TOTAL = WORKLOAD_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);

export function getConfig() {
  const baseUrl = (__ENV.K6_BASE_URL || 'https://app.lunchportalen.no').replace(/\/$/, '');
  const email = __ENV.K6_SMOKE_EMAIL || 'smoke-test@lunchportalen.no';
  const password = __ENV.K6_SMOKE_PASSWORD || '';
  const tagEnv = __ENV.K6_TAG_ENV || 'prod';
  const outputDir = __ENV.K6_OUTPUT_DIR || 'scripts/k6/results';
  const phasesRaw = __ENV.K6_FASES || 'setup,smoke,baseline,soak,stress,spike,recovery';
  const phases = phasesRaw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return { baseUrl, email, password, tagEnv, outputDir, phases };
}

export function requirePassword(config) {
  if (!config.password) {
    throw new Error(
      'K6_SMOKE_PASSWORD is required. Set via -e or scripts/k6/run.mjs (reads PLAYWRIGHT_TEST_PASSWORD from .env.local).',
    );
  }
}

function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

/** k6 goja lacks reliable IANA timezone — Oslo offset for CEST (Mar–Oct). */
function osloOffsetHours() {
  const month = new Date().getUTCMonth() + 1;
  return month >= 3 && month <= 10 ? 2 : 1;
}

export function osloTodayISO() {
  const osloMs = Date.now() + osloOffsetHours() * 3600000;
  const dt = new Date(osloMs);
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

export function addDaysISO(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** Spread order writes across future weekdays to reduce duplicate-order noise. */
export function orderTargetDate(vu, iter) {
  const baseOffset = 1 + ((vu * 7 + iter) % 14);
  let date = addDaysISO(osloTodayISO(), baseOffset);
  for (let guard = 0; guard < 7; guard += 1) {
    const [y, m, d] = date.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (wd >= 1 && wd <= 5) return date;
    date = addDaysISO(date, 1);
  }
  return date;
}

/** Stable idempotency key per VU + iteration + date (retries stay safe). */
export function idempotencyKey(config, vu, iter, date) {
  return `k6-${config.tagEnv}-vu${vu}-i${iter}-${date}`.slice(0, 120);
}

export function randomIdempotencyKey(config, vu, iter) {
  const stamp = Date.now().toString(36);
  return `k6-${config.tagEnv}-vu${vu}-i${iter}-${stamp}`.slice(0, 120);
}

export function pickWorkloadEndpoint(seed) {
  const roll = seed % WEIGHT_TOTAL;
  let cursor = 0;
  for (const item of WORKLOAD_WEIGHTS) {
    cursor += item.weight;
    if (roll < cursor) {
      return item.name;
    }
  }
  return 'week_browse';
}

export function requestTags(scenario, endpoint, extra = {}) {
  return {
    scenario,
    endpoint,
    env: __ENV.K6_TAG_ENV || 'prod',
    expected: 'true',
    ...extra,
  };
}
