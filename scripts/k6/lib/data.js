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
  const email =
    __ENV.K6_EMPLOYEE_EMAIL ||
    __ENV.K6_SMOKE_EMAIL ||
    'smoke-test@lunchportalen.no';
  const password =
    __ENV.K6_EMPLOYEE_PASSWORD ||
    __ENV.K6_SMOKE_PASSWORD ||
    '';
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

export function osloTodayISO() {
  // k6/goja lacks reliable IANA timezone support — derive Europe/Oslo calendar date via fixed offset.
  const now = Date.now();
  const osloOffsetMinutes = Number(__ENV.K6_OSLO_UTC_OFFSET_MINUTES || '120');
  const oslo = new Date(now + osloOffsetMinutes * 60 * 1000);
  const y = oslo.getUTCFullYear();
  const m = String(oslo.getUTCMonth() + 1).padStart(2, '0');
  const d = String(oslo.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(isoDate, days) {
  const parts = String(isoDate ?? '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`addDaysISO: invalid isoDate ${isoDate}`);
  }
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  if (Number.isNaN(dt.getTime())) {
    throw new Error(`addDaysISO: invalid result for ${isoDate} + ${days}`);
  }
  return dt.toISOString().slice(0, 10);
}

/** Spread order writes across future weekdays to reduce duplicate-order noise. */
export function orderTargetDate(vu, iter) {
  const base = osloTodayISO();
  let offset = 1 + ((vu * 7 + iter) % 14);
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const candidate = addDaysISO(base, offset + attempt);
    const [y, m, d] = candidate.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow >= 1 && dow <= 5) return candidate;
  }
  return addDaysISO(base, 3);
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
