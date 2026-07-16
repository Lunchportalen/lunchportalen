import "server-only";

import { requireSuperadminApi } from "@/lib/superadmin/auth";
import { rateLimit } from "@/lib/security/rateLimit";
import { jsonErr, makeRid } from "@/lib/http/respond";

export async function gateReviewApi(req: Request) {
  const rid = makeRid();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`review-ops:${ip}`, 60)) {
    return { ok: false as const, rid, response: jsonErr(rid, "Rate limit", 429, "rate_limited") };
  }
  const gate = await requireSuperadminApi();
  if (gate.ok === false) {
    return { ok: false as const, rid, response: jsonErr(rid, gate.message, gate.status, "forbidden") };
  }
  return { ok: true as const, rid, userId: gate.userId };
}
