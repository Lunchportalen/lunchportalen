/**
 * Standard region-liste (kan overstyres med MULTI_REGION_ROUTING).
 */
export const REGIONS = ["eu-west", "us-east", "asia"] as const;

export function regionListForRouting(): string[] {
  const raw = String(process.env.MULTI_REGION_ROUTING ?? "").trim();
  if (raw.length > 0) {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts;
  }
  return [...REGIONS];
}
