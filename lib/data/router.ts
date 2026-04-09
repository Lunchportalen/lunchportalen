import "server-only";

/**
 * Data-region hint for routing / logging (ingen DB-endring — konvensjon).
 */
export function getDataRegion(): string {
  const r = String(process.env.DATA_REGION ?? "").trim();
  return r.length > 0 ? r : "eu";
}
