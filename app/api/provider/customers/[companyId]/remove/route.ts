// app/api/provider/customers/[companyId]/remove/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { readJson } from "@/lib/http/routeGuard";
import {
  getProviderCustomerRemovalEligibility,
  executeProviderCustomerRemoval,
} from "@/lib/server/provider/providerCustomerRemoval";
import { authorizeProviderCustomerAdmin } from "@/lib/server/provider/providerCustomerRouteAuth";
import { isProtectedPilotCompany } from "@/lib/server/superadmin/companyRemovalPolicy";

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuidLike(v: unknown) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(safeStr(v));
}

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const params = await Promise.resolve(ctx.params);
  const companyId = safeStr(params?.companyId);
  if (!isUuidLike(companyId)) return jsonErr("rid_missing", "Ugyldig kunde-id.", 400, "BAD_REQUEST");

  const auth = await authorizeProviderCustomerAdmin(req, companyId, "remove");
  if (auth.ok === false) return auth.res;

  const payload = await getProviderCustomerRemovalEligibility(auth.admin, auth.providerId, companyId);
  if (payload.ok === false) {
    return jsonErr(auth.rid, payload.message, payload.code === "NOT_FOUND" ? 404 : 403, payload.code, {
      blockers: payload.blockers ?? [],
    });
  }

  const { company, eligibility } = payload;

  return jsonOk(auth.rid, {
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

  const auth = await authorizeProviderCustomerAdmin(req, companyId, "remove");
  if (auth.ok === false) return auth.res;

  const body = ((await readJson(req)) ?? {}) as RemoveBody;
  const mode = body.mode === "hard_delete" ? "hard_delete" : body.mode === "archive" ? "archive" : null;
  if (!mode) return jsonErr(auth.rid, "mode må være archive eller hard_delete.", 400, "VALIDATION");

  try {
    const result = await executeProviderCustomerRemoval(
      auth.admin,
      {
        rid: auth.rid,
        userId: auth.userId,
        email: auth.email,
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
        : result.code === "FORBIDDEN" || result.code === "OUT_OF_SCOPE" || result.code === "PROTECTED_SYSTEM" || result.code === "SELF_CUSTOMER" ? 403
        : result.code === "HARD_DELETE_BLOCKED" ? 409
        : result.code === "CONFIRM_MISMATCH" || result.code === "VALIDATION" || result.code === "BAD_REQUEST" ? 409
        : result.code === "ALREADY_ARCHIVED" ? 422
        : 500;

      return jsonErr(auth.rid, formatRemovalErrorMessage(result.message, result.blockers), status, result.code, {
        blockers: result.blockers ?? [],
        code: result.code,
      });
    }

    return jsonOk(auth.rid, { companyId: result.companyId, mode: result.mode, providerId: auth.providerId });
  } catch {
    return jsonErr(auth.rid, "Kunne ikke fullføre fjerning — serverfeil under utførelse.", 500, "EXECUTION_FAILED");
  }
}
