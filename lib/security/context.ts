// lib/security/context.ts
import "server-only";

import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import type { AuthedCtx } from "@/lib/http/routeGuard";
import { getScope } from "@/lib/auth/scope";
import { getCurrentTenant } from "@/lib/saas/tenant";

export type SecurityContext = {
  userId: string | null;
  companyId: string | null;
  role: string | null;
  ip: string | null;
};

function clientIpFromHeaders(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return null;
}

export function clientIpFromRequest(req: Request | NextRequest): string | null {
  try {
    return clientIpFromHeaders(req.headers);
  } catch {
    return null;
  }
}

/**
 * Request-scoped security context from Next headers + profile (server components / actions).
 */
export async function getSecurityContext(): Promise<SecurityContext> {
  const h = await headers();
  const tenant = await getCurrentTenant();
  return {
    userId: tenant?.userId ?? null,
    companyId: tenant?.companyId ?? null,
    role: tenant?.role != null ? String(tenant.role) : null,
    ip: clientIpFromHeaders(h),
  };
}

/**
 * API routes that already ran scopeOr401: zero extra profile round-trip.
 */
export function securityContextFromAuthedCtx(ctx: AuthedCtx, req: NextRequest): SecurityContext {
  return {
    userId: ctx.scope.userId ?? null,
    companyId: ctx.scope.companyId ?? null,
    role: ctx.scope.role != null ? String(ctx.scope.role) : null,
    ip: clientIpFromRequest(req),
  };
}

/**
 * Best-effort scope for unauthenticated or optional-auth routes (never throws).
 */
export async function trySecurityContextFromRequest(req: NextRequest): Promise<SecurityContext> {
  const ip = clientIpFromRequest(req);
  try {
    const scope = await getScope(req);
    return {
      userId: scope.user_id ?? null,
      companyId: scope.company_id ?? null,
      role: scope.role != null ? String(scope.role) : null,
      ip,
    };
  } catch {
    return { userId: null, companyId: null, role: null, ip };
  }
}
