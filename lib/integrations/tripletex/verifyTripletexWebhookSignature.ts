import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/** Header Tripletex subscription should send (authHeaderName / authHeaderValue). */
export const TRIPLETEX_WEBHOOK_AUTH_HEADER = "X-Lunchportalen-Tripletex-Webhook";

/** Optional HMAC header for defense-in-depth (tests + manual replay). */
export const TRIPLETEX_WEBHOOK_HMAC_HEADER = "X-Lunchportalen-Tripletex-Signature";

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function expectedHmacSha256Hex(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/**
 * Tripletex recommends custom auth headers on subscription (not body HMAC).
 * We accept:
 * 1) TRIPLETEX_WEBHOOK_AUTH_HEADER (default X-Lunchportalen-Tripletex-Webhook) exact match
 * 2) Authorization: Bearer <secret>
 * 3) Optional X-Lunchportalen-Tripletex-Signature HMAC-SHA256(hex) over raw body
 */
export function verifyTripletexWebhookSignature(opts: {
  rawBody: string;
  secret: string;
  authHeader: string | null;
  authorizationHeader: string | null;
  hmacHeader: string | null;
}): boolean {
  const secret = safeTrim(opts.secret);
  if (!secret) return false;

  const hmacSig = safeTrim(opts.hmacHeader);
  if (hmacSig) {
    const expected = expectedHmacSha256Hex(opts.rawBody, secret);
    const prefixed = hmacSig.startsWith("sha256=") ? hmacSig.slice(7) : hmacSig;
    return constantTimeEqual(prefixed, expected);
  }

  const auth = safeTrim(opts.authHeader);
  if (auth && constantTimeEqual(auth, secret)) return true;

  const authz = safeTrim(opts.authorizationHeader);
  if (authz) {
    const bearer = authz.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    if (bearer && constantTimeEqual(bearer, secret)) return true;
  }

  return false;
}
