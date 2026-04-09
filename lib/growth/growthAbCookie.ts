import { LP_GROWTH_AB_COOKIE } from "@/lib/growth/constants";

export type GrowthAbCookiePayload = {
  v: 1;
  experimentId: string;
  variantId: string;
  variantSocialPostId: string;
  entryPostId: string;
};

export function serializeGrowthAbCookiePayload(p: GrowthAbCookiePayload): string {
  return encodeURIComponent(JSON.stringify(p));
}

export function parseGrowthAbCookie(raw: string | null | undefined): GrowthAbCookiePayload | null {
  if (!raw || !raw.trim()) return null;
  try {
    const decoded = decodeURIComponent(raw.trim());
    const o = JSON.parse(decoded) as Record<string, unknown>;
    if (o.v !== 1) return null;
    const experimentId = typeof o.experimentId === "string" ? o.experimentId : "";
    const variantId = typeof o.variantId === "string" ? o.variantId : "";
    const variantSocialPostId = typeof o.variantSocialPostId === "string" ? o.variantSocialPostId : "";
    const entryPostId = typeof o.entryPostId === "string" ? o.entryPostId : "";
    if (!experimentId || !variantId || !variantSocialPostId || !entryPostId) return null;
    return { v: 1, experimentId, variantId, variantSocialPostId, entryPostId };
  } catch {
    return null;
  }
}

export function buildGrowthAbSetCookieHeader(payload: GrowthAbCookiePayload): string {
  const maxAge = 60 * 60 * 24 * 7;
  const body = serializeGrowthAbCookiePayload(payload);
  return `${LP_GROWTH_AB_COOKIE}=${body}; Path=/; Max-Age=${maxAge}; SameSite=Lax; HttpOnly`;
}

/** Les fra Cookie-header (API routes). */
export function parseGrowthAbFromCookieHeader(header: string | null | undefined): GrowthAbCookiePayload | null {
  if (!header) return null;
  const parts = header.split(";").map((s) => s.trim());
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq <= 0) continue;
    const name = p.slice(0, eq).trim();
    const val = p.slice(eq + 1).trim();
    if (name === LP_GROWTH_AB_COOKIE) return parseGrowthAbCookie(val);
  }
  return null;
}
