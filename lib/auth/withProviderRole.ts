// lib/auth/withProviderRole.ts
/**
 * Provider-scoped API guards (mirror `withRole` + `scopeOr401` / `requireRoleOr403`).
 *
 * @example
 * export const POST = withProviderRole("provider_admin", async ({ rid, scope, providerId, body }) => {
 *   // ...
 *   return jsonOk(rid, { ok: true, data: {} });
 * });
 */
import "server-only";

import type { NextRequest } from "next/server";
import { hasProviderRole } from "@/lib/auth/provider";
import { jsonErr } from "@/lib/http/respond";
import { readJson, scopeOr401, type AuthedCtx, type ScopeLike } from "@/lib/http/routeGuard";
import type { ProviderRole } from "@/lib/providers/types";
import { supabaseServer } from "@/lib/supabase/server";

export class ProviderForbiddenError extends Error {
  readonly code = "FORBIDDEN" as const;
  constructor(message = "FORBIDDEN") {
    super(message);
    this.name = "ProviderForbiddenError";
  }
}

export class ProviderIdMissingError extends Error {
  readonly status = 400 as const;
  readonly code = "PROVIDER_ID_MISSING" as const;
  constructor(message = "Mangler provider_id") {
    super(message);
    this.name = "ProviderIdMissingError";
  }
}

export type ProviderHandlerCtx = {
  rid: string;
  scope: ScopeLike;
  providerId: string;
  req: NextRequest;
  query: URLSearchParams;
  body: Record<string, unknown>;
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function safeQuery(req: NextRequest): URLSearchParams {
  try {
    return new URL(req.url).searchParams;
  } catch {
    return new URLSearchParams();
  }
}

function pickDeniedResponse(a: { res?: Response; response?: Response; ctx?: AuthedCtx } | null | undefined): Response {
  if (a?.res) return a.res;
  if (a?.response) return a.response;
  const rid = safeStr(a?.ctx?.rid) || "rid_missing";
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHORIZED");
}

function extractProviderIdFromRecord(source: Record<string, unknown> | URLSearchParams): string | null {
  if (source instanceof URLSearchParams) {
    return safeStr(source.get("provider_id") || source.get("providerId")) || null;
  }
  return safeStr(source.provider_id ?? source.providerId) || null;
}

/**
 * Extract `provider_id` / `providerId` from query or path-style param maps.
 * Throws {@link ProviderIdMissingError} (400) when absent.
 *
 * @example
 * const providerId = mustProviderId({ provider_id: searchParams.get("provider_id") ?? undefined });
 */
export function mustProviderId(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
): string {
  let raw: string | undefined;
  if (params instanceof URLSearchParams) {
    raw = params.get("provider_id") ?? params.get("providerId") ?? undefined;
  } else {
    const v = params.provider_id ?? params.providerId;
    raw = Array.isArray(v) ? v[0] : v;
  }
  const id = safeStr(raw);
  if (!id) throw new ProviderIdMissingError();
  return id;
}

/**
 * Async gate for RSC / server actions — throws {@link ProviderForbiddenError} when denied.
 *
 * @example
 * await requireProviderRole(providerId, "provider_admin");
 */
export async function requireProviderRole(providerId: string, requiredRole: ProviderRole): Promise<void> {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user?.id) throw new ProviderForbiddenError("Not authenticated");

  const ok = await hasProviderRole(data.user.id, providerId, requiredRole);
  if (!ok) throw new ProviderForbiddenError();
}

/**
 * Higher-order provider guard for API routes.
 * - 401 without session (`scopeOr401`)
 * - 400 when `provider_id` missing (query/body)
 * - 403 when membership role is insufficient
 */
export function withProviderRole(
  requiredRole: ProviderRole,
  handler: (ctx: ProviderHandlerCtx) => Promise<Response> | Response,
  opts?: { action?: string },
) {
  const action = safeStr(opts?.action) || "withProviderRole";

  return async function wrapped(req: NextRequest): Promise<Response> {
    const auth = await scopeOr401(req);
    if (!auth.ok) return pickDeniedResponse(auth);

    const ctx = auth.ctx;
    const query = safeQuery(req);
    const m = safeStr(req.method).toUpperCase();
    const isWrite = m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
    const bodyRaw = isWrite ? ((await readJson(req)) ?? {}) : {};
    const body = bodyRaw && typeof bodyRaw === "object" ? (bodyRaw as Record<string, unknown>) : {};

    let providerId: string;
    try {
      providerId =
        extractProviderIdFromRecord(query) ??
        extractProviderIdFromRecord(body) ??
        mustProviderId(query);
    } catch {
      return jsonErr(ctx.rid, "Mangler provider_id.", 400, "PROVIDER_ID_MISSING");
    }

    const userId = safeStr(ctx.scope.userId);
    if (!userId) return jsonErr(ctx.rid, "Ikke innlogget.", 401, "UNAUTHORIZED");

    const allowed = await hasProviderRole(userId, providerId, requiredRole);
    if (!allowed) {
      return jsonErr(ctx.rid, "Ingen tilgang.", 403, "FORBIDDEN", { action, providerId, requiredRole });
    }

    try {
      return await handler({ rid: ctx.rid, scope: ctx.scope, providerId, req, query, body });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      return jsonErr(ctx.rid, safeStr(message) || "Unknown error", 500, { code: "UNHANDLED", detail: { at: action } });
    }
  };
}
