import "server-only";

/**
 * Deployment region hint (env override). Deterministic default for local/single-region.
 */
export function getRegion(): string {
  const r = String(process.env.REGION ?? "").trim();
  return r.length > 0 ? r : "eu-west";
}
