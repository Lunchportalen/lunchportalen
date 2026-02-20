import type { NextRequest } from "next/server";

export type CronAuthMode = "authorization" | "x-cron-secret";

export type RequireCronAuthOptions = {
  secretEnvVar?: string;
  missingCode?: string;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * FASIT:
 * - Prod/staging: Vercel sends Authorization: Bearer <CRON_SECRET>
 * - We also support x-cron-secret (local/manual), never query secrets
 *
 * Throws Error with .code:
 * - cron_secret_missing
 * - forbidden
 */
export function requireCronAuth(
  req: Request | NextRequest,
  options: RequireCronAuthOptions = {}
): { mode: CronAuthMode } {
  const envName = safeStr(options.secretEnvVar) || "CRON_SECRET";
  const missingCode = safeStr(options.missingCode) || "cron_secret_missing";
  const expected = safeStr(process.env[envName]);

  if (!expected) {
    const err = new Error(missingCode);
    (err as any).code = missingCode;
    throw err;
  }

  // 1) Primary: Authorization: Bearer <secret>
  const auth = safeStr(req.headers.get("authorization"));
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (bearer) {
    if (bearer === expected) return { mode: "authorization" };
    const err = new Error("forbidden");
    (err as any).code = "forbidden";
    throw err;
  }

  // 2) Secondary: x-cron-secret
  const hdr = safeStr(req.headers.get("x-cron-secret"));
  if (hdr) {
    if (hdr === expected) return { mode: "x-cron-secret" };
    const err = new Error("forbidden");
    (err as any).code = "forbidden";
    throw err;
  }

  // 3) No query key support
  const err = new Error("forbidden");
  (err as any).code = "forbidden";
  throw err;
}

