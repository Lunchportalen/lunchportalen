// app/api/superadmin/gate/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

function denyResponse(s: any): Response {
  // Støtt både:
  // - { ok:false, response }
  // - { ok:false, res } (hvis noen steder fortsatt bruker det)
  if (s && typeof s === "object") {
    if ("response" in s && s.response instanceof Response) return s.response as Response;
    if ("res" in s && s.res instanceof Response) return s.res as Response;
  }
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;

  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  return jsonOk(ctx.rid, {
      ok: true,
      rid: ctx.rid,
      role: ctx.scope?.role ?? null,
      userId: ctx.scope?.userId ?? null,
      email: ctx.scope?.email ?? null,
    }, 200);
}

