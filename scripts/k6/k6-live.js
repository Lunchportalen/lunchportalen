import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.4/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/3.0.4/dist/bundle.js';

import { getThresholds } from './lib/thresholds.js';
import { setupAuth } from './lib/auth.js';
import { verifyAllEndpoints, runMixedWorkload } from './lib/checks.js';
import { getConfig, requirePassword } from './lib/data.js';

/**
 * Phase timeline (sequential scenarios via startTime offsets):
 * 0  setup     30s   1 VU pre-warm
 * 1  smoke     1m    1 VU verify
 * 2  baseline  5m    5→20 VU mixed workload
 * 3  soak      30m   20 VU sustained
 * 4  stress    10m   20→100 VU ramp
 * 5  spike     3m    50→150 burst
 * 6  recovery  5m    5 VU stabilization
 *
 * Total ≈ 54m 30s (+ setup overhead)
 */

const PHASE_DEFS = [
  {
    key: 'setup',
    durationSec: 30,
    build: (startTime) => ({
      setup: {
        executor: 'shared-iterations',
        vus: 1,
        iterations: 1,
        maxDuration: '30s',
        startTime: `${startTime}s`,
        exec: 'setupExec',
      },
    }),
  },
  {
    key: 'smoke',
    durationSec: 60,
    build: (startTime) => ({
      smoke: {
        executor: 'constant-vus',
        vus: 1,
        duration: '1m',
        startTime: `${startTime}s`,
        exec: 'smokeExec',
      },
    }),
  },
  {
    key: 'baseline',
    durationSec: 300,
    build: (startTime) => ({
      baseline: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '1m', target: 5 },
          { duration: '4m', target: 20 },
        ],
        startTime: `${startTime}s`,
        exec: 'baselineExec',
      },
    }),
  },
  {
    key: 'soak',
    durationSec: 1800,
    build: (startTime) => ({
      soak: {
        executor: 'constant-vus',
        vus: 20,
        duration: '30m',
        startTime: `${startTime}s`,
        exec: 'soakExec',
      },
    }),
  },
  {
    key: 'stress',
    durationSec: 600,
    build: (startTime) => ({
      stress: {
        executor: 'ramping-vus',
        startVUs: 20,
        stages: [{ duration: '10m', target: 100 }],
        startTime: `${startTime}s`,
        exec: 'stressExec',
      },
    }),
  },
  {
    key: 'spike',
    durationSec: 180,
    build: (startTime) => ({
      spike: {
        executor: 'ramping-vus',
        startVUs: 50,
        stages: [
          { duration: '30s', target: 150 },
          { duration: '2m30s', target: 150 },
        ],
        startTime: `${startTime}s`,
        exec: 'spikeExec',
      },
    }),
  },
  {
    key: 'recovery',
    durationSec: 300,
    build: (startTime) => ({
      recovery: {
        executor: 'constant-vus',
        vus: 5,
        duration: '5m',
        startTime: `${startTime}s`,
        exec: 'recoveryExec',
      },
    }),
  },
];

function buildScenarios(enabledPhases) {
  const scenarios = {};
  let startTime = 0;

  for (const phase of PHASE_DEFS) {
    if (!enabledPhases.includes(phase.key)) {
      continue;
    }
    Object.assign(scenarios, phase.build(startTime));
    startTime += phase.durationSec;
  }

  return { scenarios, totalDurationSec: startTime };
}

const config = getConfig();
const { scenarios, totalDurationSec } = buildScenarios(config.phases);

export function setup() {
  requirePassword(config);
  return setupAuth();
}

export function setupExec() {
  verifyAllEndpoints('setup');
}

export function smokeExec() {
  verifyAllEndpoints('smoke');
}

export function baselineExec() {
  runMixedWorkload('baseline');
}

export function soakExec() {
  runMixedWorkload('soak');
}

export function stressExec() {
  runMixedWorkload('stress');
}

export function spikeExec() {
  runMixedWorkload('spike');
}

export function recoveryExec() {
  runMixedWorkload('recovery');
}

export const options = {
  scenarios,
  thresholds: getThresholds(),
  tags: {
    suite: 'k6-live',
    env: config.tagEnv,
    phases: config.phases.join(','),
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export function handleSummary(data) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = config.outputDir.replace(/\\/g, '/');
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [`${outDir}/${stamp}-summary.json`]: JSON.stringify(data, null, 2),
    [`${outDir}/${stamp}.html`]: htmlReport(data, {
      title: `Lunchportalen k6 live (${config.tagEnv})`,
    }),
  };
}

export default options;
