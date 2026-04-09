import "server-only";

/**
 * Explicit live production flag (ops-controlled). Not the same as NODE_ENV.
 */
export function isProductionMode(): boolean {
  return process.env.PRODUCTION_MODE === "true";
}
