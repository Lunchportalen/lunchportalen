// app/api/provider/customers/[companyId]/restore/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { hasProviderRole } from "@/lib/auth/provider";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, readJson } from "@/lib/http/routeGuard";
import { executeProviderCustomerRestore } from "@/lib/server/provider/providerCustomerRestore";

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuidLike(v: unknown) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(safeStr(v));
}

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid?: string } }): Response {
  if (s?.response) return s.response;
  if (s?.res) return s.res;
  return jsonErr(String(s?.ctx?.rid ?? "rid_missing"), "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

async function requireProviderAdminForCustomer(req: NextRequest, companyId: string) {
  const gate = await scopeOr401(req);
  if (!gate.ok) return { ok: false as const, res: denyResponse(gate) };

  const userId = safeStr(gate.ctx.scope.userId);
  if (!userId) return { ok: false as const, res: jsonErr(gate.ctx.rid, "Ikke innlogget.", 401, "UNAUTHORIZED") };

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();

  const { data, error } = await admin.from("companies").select("id,provider_id").eq("id", companyId).maybeSingle();
  if (error || !data?.id) {
    return { ok: false as const, res: jsonErr(gate.ctx.rid, "Fant ikke kunde.", 404, "NOT_FOUND") };
  }

  const providerId = safeStr((data as { provider_id?: string }).provider_id);
  if (!providerId) {
    return { ok: false as const, res: jsonErr(gate.ctx.rid, "Kunden er ikke koblet til leverandør.", 403, "FORBIDDEN") };
  }

  const allowed = await hasProviderRole(userId, providerId, "provider_admin");
  if (!allowed) {
    return { ok: false as const, res: jsonErr(gate.ctx.rid, "Ingen tilgang.", 403, "FORBIDDEN") };
  }

  return { ok: true as const, ctx: gate.ctx, providerId, admin };
}

type RestoreBody = {
  confirmation?: string;
  reason?: string | null;
};

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const params = await Promise.resolve(ctx.params);
  const companyId = safeStr(params?.companyId);
  if (!isUuidLike(companyId)) return jsonErr("rid_missing", "Ugyldig kunde-id.", 400, "BAD_REQUEST");

  const auth = await requireProviderAdminForCustomer(req, companyId);
  if (!auth.ok) return auth.res;

  const body = ((await readJson(req)) ?? {}) as RestoreBody;
  const confirmation = safeStr(body.confirmation);
  if (!confirmation) {
    return jsonErr(auth.ctx.rid, "Bekreftelse mangler.", 400, "VALIDATION");
  }

  try {
    const result = await executeProviderCustomerRestore(
      auth.admin,
      {
        rid: auth.ctx.rid,
        userId: auth.ctx.scope.userId ?? null,
        email: auth.ctx.scope.email ?? null,
      },
      {
        providerId: auth.providerId,
        companyId,
        confirmation,
        reason: body.reason ?? null,
      }
    );

    if (result.ok === false) {
      const status =
        result.code === "NOT_FOUND" ? 404
        : result.code === "FORBIDDEN" || result.code === "OUT_OF_SCOPE" || result.code === "PROTECTED_SYSTEM" || result.code === "SELF_CUSTOMER" ? 403
        : result.code === "CONFIRM_MISMATCH" || result.code === "ALREADY_ACTIVE" ? 409
        : 500;

      return jsonErr(auth.ctx.rid, result.message, status, result.code, {
        blockers: result.blockers ?? [],
        code: result.code,
      });
    }

    return jsonOk(auth.ctx.rid, {
      companyId: result.companyId,
      hasActiveAgreement: result.hasActiveAgreement,
      message: result.message,
    });
  } catch {
    return jsonErr(auth.ctx.rid, "Kunne ikke gjenopprette kunde — serverfeil under utførelse.", 500, "EXECUTION_FAILED");
  }
}
