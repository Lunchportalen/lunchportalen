import { getThresholds } from '../lib/thresholds.js';
import { setupAuth } from '../lib/auth.js';
import { runMixedWorkload } from '../lib/checks.js';
import { getConfig, requirePassword } from '../lib/data.js';

export function setup() {
  const config = getConfig();
  requirePassword(config);
  return setupAuth();
}

export function recoveryExec() {
  runMixedWorkload('recovery');
}

export const recoveryScenario = {
  recovery: {
    executor: 'constant-vus',
    vus: 5,
    duration: '5m',
    exec: 'recoveryExec',
  },
};

export const options = {
  scenarios: recoveryScenario,
  thresholds: getThresholds(__ENV.K6_TAG_ENV || 'staging'),
  tags: { suite: 'k6-live', phase: 'recovery' },
};

export default options;
