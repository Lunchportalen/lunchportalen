import { createHash, timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

export type CronAuthMode = "authorization" | "x-cron-secret" | "vercel-cron";

export type RequireCronAuthOptions = {
  secretEnvVar?: string;
  missingCode?: string;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Timing-safe string comparison (constant-time, length-independent via SHA-256).
 */
function secretMatches(candidate: string, expected: string): boolean {
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

/**
 * FASIT (CRON-001, fail-closed):
 * - The shared secret (`CRON_SECRET` by default) is ALWAYS required. Missing secret → throw
 *   `cron_secret_missing` — no open fallback, in any environment.
 * - `x-vercel-cron: 1` is NEVER sufficient on its own. It only tags the auth mode as
 *   "vercel-cron" for observability when the secret ALSO matches. (Vercel sends
 *   `Authorization: Bearer <CRON_SECRET>` on scheduled invocations when the env var is set.)
 * - Secrets are compared timing-safe (SHA-256 + timingSafeEqual).
 * - Accepted proofs: `Authorization: Bearer <secret>` (primary) or `x-cron-secret: <secret>`
 *   (external schedulers). Never query params.
 *
 * Throws Error with .code:
 * - cron_secret_missing (or custom missingCode)
 * - forbidden
 */
export function requireCronAuth(
  req: Request | NextRequest,
  options: RequireCronAuthOptions = {}
): { mode: CronAuthMode } {
  const envName = safeStr(options.secretEnvVar) || "CRON_SECRET";
  const missingCode = safeStr(options.missingCode) || "cron_secret_missing";
  const expected = safeStr(process.env[envName]);

  // Fail closed: no configured secret means no cron execution — ever.
  if (!expected) {
    const err = new Error(missingCode);
    (err as any).code = missingCode;
    throw err;
  }

  const isVercelCronTagged = safeStr(req.headers.get("x-vercel-cron")) === "1";

  // 1) Primary: Authorization: Bearer <secret>
  const auth = safeStr(req.headers.get("authorization"));
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (bearer) {
    if (secretMatches(bearer, expected)) {
      return { mode: isVercelCronTagged ? "vercel-cron" : "authorization" };
    }
    const err = new Error("forbidden");
    (err as any).code = "forbidden";
    throw err;
  }

  // 2) Secondary: x-cron-secret
  const hdr = safeStr(req.headers.get("x-cron-secret"));
  if (hdr) {
    if (secretMatches(hdr, expected)) return { mode: "x-cron-secret" };
    const err = new Error("forbidden");
    (err as any).code = "forbidden";
    throw err;
  }

  // 3) No proof presented (x-vercel-cron alone is not proof). No query key support.
  const err = new Error("forbidden");
  (err as any).code = "forbidden";
  throw err;
}
