// app/api/provider/customers/[companyId]/remove/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { hasProviderRole } from "@/lib/auth/provider";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, readJson } from "@/lib/http/routeGuard";
import {
  getProviderCustomerRemovalEligibility,
  executeProviderCustomerRemoval,
} from "@/lib/server/provider/providerCustomerRemoval";
import { isProtectedPilotCompany } from "@/lib/server/superadmin/companyRemovalPolicy";

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

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const params = await Promise.resolve(ctx.params);
  const companyId = safeStr(params?.companyId);
  if (!isUuidLike(companyId)) return jsonErr("rid_missing", "Ugyldig kunde-id.", 400, "BAD_REQUEST");

  const auth = await requireProviderAdminForCustomer(req, companyId);
  if (!auth.ok) return auth.res;

  const payload = await getProviderCustomerRemovalEligibility(auth.admin, auth.providerId, companyId);
  if (payload.ok === false) {
    return jsonErr(auth.ctx.rid, payload.message, payload.code === "NOT_FOUND" ? 404 : 403, payload.code, {
      blockers: payload.blockers ?? [],
    });
  }

  const { company, eligibility } = payload;

  return jsonOk(auth.ctx.rid, {
    companyId,
    companyName: company.name,
    orgnr: company.orgnr,
    providerId: auth.providerId,
    protectedPilot: isProtectedPilotCompany(company.name),
    ...eligibility,
    archiveConfirmHint: company.orgnr ? `${company.orgnr} ARKIVER` : null,
    hardDeleteConfirmHint: eligibility.confirmationTargets[0] ?? (company.name || company.orgnr || null),
  });
}

type RemoveBody = {
  mode?: "archive" | "hard_delete";
  confirmation?: string;
  reason?: string | null;
};

function formatRemovalErrorMessage(message: string, blockers?: string[]): string {
  if (!blockers?.length) return message;
  return `${message} ${blockers.join(" ")}`;
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const params = await Promise.resolve(ctx.params);
  const companyId = safeStr(params?.companyId);
  if (!isUuidLike(companyId)) return jsonErr("rid_missing", "Ugyldig kunde-id.", 400, "BAD_REQUEST");

  const auth = await requireProviderAdminForCustomer(req, companyId);
  if (!auth.ok) return auth.res;

  const body = ((await readJson(req)) ?? {}) as RemoveBody;
  const mode = body.mode === "hard_delete" ? "hard_delete" : body.mode === "archive" ? "archive" : null;
  if (!mode) return jsonErr(auth.ctx.rid, "mode må være archive eller hard_delete.", 400, "VALIDATION");

  try {
    const result = await executeProviderCustomerRemoval(
      auth.admin,
      {
        rid: auth.ctx.rid,
        userId: auth.ctx.scope.userId ?? null,
        email: auth.ctx.scope.email ?? null,
      },
      {
        providerId: auth.providerId,
        companyId,
        mode,
        confirmation: safeStr(body.confirmation),
        reason: body.reason ?? null,
      }
    );

    if (result.ok === false) {
      const status =
        result.code === "NOT_FOUND" ? 404
        : result.code === "FORBIDDEN" || result.code === "OUT_OF_SCOPE" || result.code === "PROTECTED_SYSTEM" ? 403
        : result.code === "HARD_DELETE_BLOCKED" ? 409
        : result.code === "CONFIRM_MISMATCH" || result.code === "VALIDATION" || result.code === "BAD_REQUEST" ? 409
        : result.code === "ALREADY_ARCHIVED" ? 422
        : 500;

      return jsonErr(auth.ctx.rid, formatRemovalErrorMessage(result.message, result.blockers), status, result.code, {
        blockers: result.blockers ?? [],
        code: result.code,
      });
    }

    return jsonOk(auth.ctx.rid, { companyId: result.companyId, mode: result.mode, providerId: auth.providerId });
  } catch {
    return jsonErr(auth.ctx.rid, "Kunne ikke fullføre fjerning — serverfeil under utførelse.", 500, "EXECUTION_FAILED");
  }
}
