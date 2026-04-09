// app/api/saas/onboarding/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { denyResponse, readJson, scopeOr401 } from "@/lib/http/routeGuard";
import { runOnboarding } from "@/lib/saas/onboarding";

export async function POST(req: NextRequest) {
  const s = await scopeOr401(req);
  if (!s.ok) return denyResponse(s);
  const { ctx } = s;
  const body = await readJson(req);
  const name = String(body?.name ?? body?.companyName ?? "").trim();
  if (name.length < 2) {
    return jsonErr(ctx.rid, "Ugyldig firmanavn.", 422, "INVALID_NAME");
  }

  const res = await runOnboarding({
    userId: ctx.scope.userId!,
    email: ctx.scope.email,
    companyName: name,
  });

  if (res.ok === false) {
    const status =
      res.code === "ALREADY_ONBOARDED"
        ? 409
        : res.code === "ROLE_NOT_ALLOWED"
          ? 403
          : res.code === "INVALID_NAME"
            ? 422
            : 400;
    return jsonErr(ctx.rid, res.message, status, res.code);
  }

  return jsonOk(ctx.rid, {
    companyId: res.companyId,
    redirectTo: res.redirectTo,
    stripeCustomerCreated: res.stripeCustomerCreated,
  });
}
