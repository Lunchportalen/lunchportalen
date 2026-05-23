import "server-only";

/**
 * Tripletex Flow 1 (Lp→supplier SaaS-invoicing).
 * Currently deferred until prod consumer token is purchased.
 * Default: disabled (fail-closed).
 */
export function isTripletexFlow1Enabled(): boolean {
  return process.env.TRIPLETEX_FLOW_1_ENABLED === "true";
}

export class Flow1DisabledError extends Error {
  readonly code = "FLOW1_DISABLED";

  constructor(message = "Tripletex Flow 1 is not enabled in this environment") {
    super(message);
    this.name = "Flow1DisabledError";
  }
}
