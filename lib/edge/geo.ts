/**
 * Region-hint (Edge/Node). Ingen Node-only imports — trygg i edge-runtime.
 */
export function getClosestRegion(): string {
  const r = String(process.env.VERCEL_REGION ?? "").trim();
  return r.length > 0 ? r : "global";
}
