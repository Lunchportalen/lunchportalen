import { getThresholds } from '../lib/thresholds.js';
import { setupAuth } from '../lib/auth.js';
import { runMixedWorkload } from '../lib/checks.js';
import { getConfig, requirePassword } from '../lib/data.js';

export function setup() {
  const config = getConfig();
  requirePassword(config);
  return setupAuth();
}

export function spikeExec() {
  runMixedWorkload('spike');
}

export const spikeScenario = {
  spike: {
    executor: 'ramping-vus',
    startVUs: 50,
    stages: [{ duration: '30s', target: 150 }, { duration: '2m30s', target: 150 }],
    exec: 'spikeExec',
  },
};

export const options = {
  scenarios: spikeScenario,
  thresholds: getThresholds(__ENV.K6_TAG_ENV || 'staging'),
  tags: { suite: 'k6-live', phase: 'spike' },
};

export default options;
