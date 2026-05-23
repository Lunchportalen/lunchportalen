import { getThresholds } from '../lib/thresholds.js';
import { setupAuth } from '../lib/auth.js';
import { verifyAllEndpoints } from '../lib/checks.js';
import { getConfig, requirePassword } from '../lib/data.js';

export function setup() {
  const config = getConfig();
  requirePassword(config);
  return setupAuth();
}

export function smokeExec() {
  verifyAllEndpoints('smoke');
}

export const smokeScenario = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '1m',
    exec: 'smokeExec',
  },
};

export const options = {
  scenarios: smokeScenario,
  thresholds: getThresholds(),
  tags: { suite: 'k6-live', phase: 'smoke' },
};

export default options;
