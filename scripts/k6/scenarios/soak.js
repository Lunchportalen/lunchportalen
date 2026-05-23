import { getThresholds } from '../lib/thresholds.js';
import { setupAuth } from '../lib/auth.js';
import { runMixedWorkload } from '../lib/checks.js';
import { getConfig, requirePassword } from '../lib/data.js';

export function setup() {
  const config = getConfig();
  requirePassword(config);
  return setupAuth();
}

export function soakExec() {
  runMixedWorkload('soak');
}

export const soakScenario = {
  soak: {
    executor: 'constant-vus',
    vus: 20,
    duration: '30m',
    exec: 'soakExec',
  },
};

export const options = {
  scenarios: soakScenario,
  thresholds: getThresholds(),
  tags: { suite: 'k6-live', phase: 'soak' },
};

export default options;
