import { getThresholds } from '../lib/thresholds.js';
import { setupAuth } from '../lib/auth.js';
import { runMixedWorkload } from '../lib/checks.js';
import { getConfig, requirePassword } from '../lib/data.js';

export function setup() {
  const config = getConfig();
  requirePassword(config);
  return setupAuth();
}

export function stressExec() {
  runMixedWorkload('stress');
}

export const stressScenario = {
  stress: {
    executor: 'ramping-vus',
    startVUs: 20,
    stages: [{ duration: '10m', target: 100 }],
    exec: 'stressExec',
  },
};

export const options = {
  scenarios: stressScenario,
  thresholds: getThresholds(),
  tags: { suite: 'k6-live', phase: 'stress' },
};

export default options;
