import { z } from "zod";

const rateMap = new Map<string, number>();

function minuteBucket(): number {
  return Math.floor(Date.now() / 60_000);
}

export function clientIpFromAnonRequest(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown").slice(0, 64);
}

/** In-memory per-IP rate limit for anon public routes (best-effort). Returns false when exceeded. */
export function anonRateLimitOk(prefix: string, ip: string, maxPerMinute: number): boolean {
  const rk = `${prefix}:${ip}:${minuteBucket()}`;
  const n = (rateMap.get(rk) ?? 0) + 1;
  rateMap.set(rk, n);
  return n <= maxPerMinute;
}

export const publicSearchQuerySchema = z.object({
  q: z.string().max(200).optional().default(""),
  locale: z.enum(["nb", "en"]).optional().default("nb"),
});

export const publicDemoInterestBodySchema = z.object({
  email: z.string().trim().email().max(254),
  postId: z.string().trim().max(128).optional(),
  post_id: z.string().trim().max(128).optional(),
});

export const publicDemoCtaAssignBodySchema = z.object({
  utmSource: z.string().max(128).optional(),
  utmMedium: z.string().max(128).optional(),
  utmCampaign: z.string().max(128).optional(),
  referrer: z.string().max(512).optional(),
});

export const publicFormSchemaParamsSchema = z.object({
  formId: z.string().trim().min(1).max(128),
  env: z.enum(["prod", "staging"]).optional().default("prod"),
  locale: z.enum(["nb", "en"]).optional().default("nb"),
});
