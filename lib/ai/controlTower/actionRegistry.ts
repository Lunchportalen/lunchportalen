export const CONTROL_ACTIONS = {
  RUN_GROWTH: "run_growth",
  RUN_STRATEGY: "run_strategy",
  RUN_ORG: "run_org",
  RUN_MARKET: "run_market",
  RUN_MONOPOLY: "run_monopoly",
  RUN_REALITY: "run_reality",
  RUN_PROFIT: "run_profit",
  RUN_CAPITAL: "run_capital",
  RUN_BUDGET: "run_budget",
  RUN_RESOURCES: "run_resources",
  RUN_CREDIT_CHECK: "run_credit_check",
  RUN_INVOICING: "run_invoicing",
  KILL_SWITCH_ON: "kill_on",
  KILL_SWITCH_OFF: "kill_off",
} as const;

export type ControlActionValue = (typeof CONTROL_ACTIONS)[keyof typeof CONTROL_ACTIONS];

const REGISTERED = new Set<string>(Object.values(CONTROL_ACTIONS));

export function isRegisteredControlAction(action: string): action is ControlActionValue {
  return REGISTERED.has(action);
}
