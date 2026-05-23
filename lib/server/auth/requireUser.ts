import "server-only";

import type { NextRequest } from "next/server";

import {
  denyResponse,
  requireRoleOr403,
  scopeOr401,
  type AllowedRole,
  type AuthedCtx,
} from "@/lib/http/routeGuard";
import { jsonErr, makeRid } from "@/lib/http/respond";

export class HttpAuthError extends Error {
  readonly status: number;
  readonly code: string;
  readonly response?: Response;

  constructor(status: number, code: string, message: string, response?: Response) {
    super(message);
    this.name = "HttpAuthError";
    this.status = status;
    this.code = code;
    this.response = response;
  }
}

function asNextRequest(req: NextRequest | Request): NextRequest {
  return req as NextRequest;
}

/**
 * Fail-closed session gate. Throws HttpAuthError (401) when unauthenticated.
 */
export async function requireUser(req: NextRequest | Request): Promise<AuthedCtx> {
  const gate = await scopeOr401(asNextRequest(req));
  if (!gate.ok) {
    const response = denyResponse(gate);
    throw new HttpAuthError(401, "UNAUTHORIZED", "Ikke innlogget.", response);
  }
  if (!gate.ctx.scope.userId) {
    const rid = gate.ctx.rid || makeRid();
    throw new HttpAuthError(
      401,
      "UNAUTHORIZED",
      "Ikke innlogget.",
      jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED"),
    );
  }
  return gate.ctx;
}

/**
 * Fail-closed role gate after session. Throws HttpAuthError (403) when role denied.
 */
export async function requireRoles(req: NextRequest | Request, roles: AllowedRole[], action = "requireRoles"): Promise<AuthedCtx> {
  const ctx = await requireUser(req);
  const deny = requireRoleOr403(ctx, action, roles);
  if (deny) {
    throw new HttpAuthError(403, "FORBIDDEN", "Ingen tilgang.", deny);
  }
  return ctx;
}

/** Superadmin-only API gate (fail-closed). */
export async function requireSuperadmin(req: NextRequest | Request): Promise<AuthedCtx> {
  return requireRoles(req, ["superadmin"], "requireSuperadmin");
}

/** Returns 401 Response or null when session OK — for prepending before route handlers. */
export async function denyUnlessSession(req: NextRequest | Request): Promise<Response | null> {
  try {
    await requireUser(req);
    return null;
  } catch (err) {
    return authErrorToResponse(err);
  }
}

/** Returns 403 Response or null when superadmin — for prepending before route handlers. */
export async function denyUnlessSuperadmin(req: NextRequest | Request): Promise<Response | null> {
  try {
    await requireSuperadmin(req);
    return null;
  } catch (err) {
    return authErrorToResponse(err);
  }
}

export function authErrorToResponse(err: unknown): Response {
  if (err instanceof HttpAuthError && err.response instanceof Response) {
    return err.response;
  }
  const rid = makeRid();
  if (err instanceof HttpAuthError) {
    return jsonErr(rid, err.message, err.status, err.code);
  }
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}
