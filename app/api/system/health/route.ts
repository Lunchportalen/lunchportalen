// app/api/system/health/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { runHealthChecks } from "@/lib/system/health";

const allowedRoles = ["superadmin"] as const;

function pickResponse(x: any): Response {
  const r = x?.res ?? x?.response;
  if (r) return r as Response;

  // ✅ Use error code + detail (detail only visible in RC/dev)
  return jsonErr(
    "no_rid",
    "RouteGuard returnerte ingen Response.",
    500,
    "guard_contract_mismatch",
    { keys: x ? Object.keys(x) : null }
  ) as unknown as Response;
}

function hasCtx(x: any): x is { ctx: any } {
  return !!x && typeof x === "object" && "ctx" in x && x.ctx;
}

export async function GET(req: NextRequest) {
  // 🔐 scope gate (Dag-3)
  const s = await scopeOr401(req);

  // TS snevrer ikke alltid på ok-literal → bruk ctx som discriminator
  if (!hasCtx(s)) {
    return pickResponse(s);
  }

  // 🔐 role gate (Dag-3)
  // ✅ SIGNATUR HOS DERE: ctx først, action som nr. 2
  const denied = requireRoleOr403(s.ctx, "system.health", allowedRoles);

  // Guard kan returnere:
  // - union { ok:false, res/response } (deny)
  // - Response direkte (deny)
  // - null/undefined/falsey (allow)
  if (denied) {
    if (typeof denied === "object" && ("res" in (denied as any) || "response" in (denied as any))) {
      return pickResponse(denied);
    }
    if (typeof denied === "object" && "status" in (denied as any) && "headers" in (denied as any)) {
      return denied as Response;
    }
    return jsonErr(
      s.ctx.rid,
      "Role-guard returnerte ukjent type.",
      500,
      "guard_contract_mismatch",
      { typeofDenied: typeof denied }
    ) as unknown as Response;
  }

  try {
    const report = await runHealthChecks();
    return jsonOk(s.ctx.rid, report, 200);
  } catch (e: any) {
    return jsonErr(
      s.ctx.rid,
      "Health check feilet.",
      500,
      "health_failed",
      { message: String(e?.message ?? e) }
    );
  }
}
