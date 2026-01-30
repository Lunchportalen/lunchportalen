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

  return jsonErr(
    500,
    "no_rid",
    "guard_contract_mismatch",
    "RouteGuard returnerte ingen Response.",
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
  // ✅ SIGNATUR HOS DERE (vist av TS-feilen): ctx først, action som nr. 2
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
    return jsonErr(500, s.ctx.rid, "guard_contract_mismatch", "Role-guard returnerte ukjent type.", {
      typeofDenied: typeof denied,
    }) as unknown as Response;
  }

  try {
    const report = await runHealthChecks();
    return jsonOk({ ok: true, rid: s.ctx.rid, report }, 200);
  } catch (e: any) {
    return jsonErr(500, s.ctx.rid, "health_failed", "Health check feilet.", {
      message: String(e?.message ?? e),
    });
  }
}
