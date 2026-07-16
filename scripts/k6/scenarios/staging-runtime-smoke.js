import { setupReadiness } from '../lib/auth.js';
import { getConfig, requirePassword } from '../lib/data.js';
import {
  getStagingRuntimeThresholds,
  runEmployeeScenario,
  runHealthScenario,
  runKitchenScenario,
  runProviderAdminScenario,
  runSuperadminScenario,
} from '../lib/staging-checks.js';

export function setup() {
  return setupReadiness();
}

export function employeeExec() {
  runHealthScenario();
  runEmployeeScenario();
}

export function providerExec() {
  runProviderAdminScenario();
}

export function kitchenExec() {
  runKitchenScenario();
}

export function superadminExec() {
  runSuperadminScenario();
}

export const options = {
  scenarios: {
    employee: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      exec: 'employeeExec',
      tags: { role: 'employee' },
    },
    provider_admin: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      exec: 'providerExec',
      startTime: '5s',
      tags: { role: 'provider_admin' },
    },
    kitchen: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      exec: 'kitchenExec',
      startTime: '10s',
      tags: { role: 'kitchen' },
    },
    superadmin: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      exec: 'superadminExec',
      startTime: '15s',
      tags: { role: 'superadmin' },
    },
  },
  thresholds: getStagingRuntimeThresholds(),
  tags: { suite: 'k6-staging-runtime', phase: '14c4' },
};

export default options;
