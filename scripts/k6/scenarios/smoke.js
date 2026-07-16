import { getThresholds, getSmokeThresholds } from '../lib/thresholds.js';
import { setupReadiness, ensureActorLogin } from '../lib/auth.js';
import { verifyAllEndpoints } from '../lib/checks.js';
import { getConfig, requirePassword } from '../lib/data.js';

export function setup() {
  const config = getConfig();
  requirePassword(config);
  return setupReadiness();
}

export function smokeExec() {
  const config = getConfig();
  ensureActorLogin('employee', config.email, config.password);
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
  thresholds:
    (__ENV.K6_TAG_ENV || 'staging') === 'staging'
      ? getSmokeThresholds(__ENV.K6_TAG_ENV || 'staging')
      : getThresholds(__ENV.K6_TAG_ENV || 'staging'),
  tags: { suite: 'k6-live', phase: 'smoke' },
};

export default options;
