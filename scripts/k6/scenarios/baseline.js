import { getThresholds } from '../lib/thresholds.js';
import { setupAuth } from '../lib/auth.js';
import { runMixedWorkload } from '../lib/checks.js';
import { getConfig, requirePassword } from '../lib/data.js';

export function setup() {
  const config = getConfig();
  requirePassword(config);
  return setupAuth();
}

export function baselineExec() {
  runMixedWorkload('baseline');
}

export const baselineScenario = {
  baseline: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 5 },
      { duration: '4m', target: 20 },
    ],
    exec: 'baselineExec',
  },
};

export const options = {
  scenarios: baselineScenario,
  thresholds: getThresholds(__ENV.K6_TAG_ENV || 'staging'),
  tags: { suite: 'k6-live', phase: 'baseline' },
};

export default options;
