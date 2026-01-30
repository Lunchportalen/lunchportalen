// app/api/admin/auth/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

/**
 * GET /api/admin/auth
 * - Brukes av admin UI for å sjekke om bruker er innlogget + har riktig rolle
 * - Returnerer scope (rid, role, companyId, locationId, email, userId)
 */
export async function GET(req: NextRequest) {
  // 1) Scope gate (NY SIGNATUR: Response | { ok:true, ctx })
  const s = await scopeOr401(req);
  if (s instanceof Response) return s;
  const ctx = s.ctx;

  // 2) Role gate: company_admin eller superadmin
  const denyRole = requireRoleOr403(ctx, "admin.auth.read", ["company_admin", "superadmin"]);
  if (denyRole) return denyRole;

  // 3) Company scope (for company_admin)
  if (ctx.scope.role !== "superadmin") {
    const denyScope = requireCompanyScopeOr403(ctx);
    if (denyScope) return denyScope;
  }

  return jsonOk(ctx, {
    ok: true,
    scope: {
      userId: ctx.scope.userId ?? null,
      role: ctx.scope.role ?? null,
      email: ctx.scope.email ?? null,
      companyId: ctx.scope.companyId ?? null,
      locationId: ctx.scope.locationId ?? null,
    },
  });
}
