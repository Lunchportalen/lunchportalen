// app/api/provider/customers/[companyId]/restore/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { readJson } from "@/lib/http/routeGuard";
import { authorizeProviderCustomerAdmin } from "@/lib/server/provider/providerCustomerRouteAuth";
import { executeProviderCustomerRestore } from "@/lib/server/provider/providerCustomerRestore";

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuidLike(v: unknown) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(safeStr(v));
}

function restoreErrorMessage(code: string, fallback: string): string {
  if (code === "PROVIDER_ROLE_MISSING") {
    return "Brukeren er ikke registrert som administrator for denne leverandøren.";
  }
  if (code === "PROVIDER_CONTEXT_MISSING") {
    return "Fant ikke leverandørtilknytning for innlogget bruker.";
  }
  if (code === "FORBIDDEN") return "Du har ikke tilgang til å gjenopprette denne kunden.";
  if (code === "OUT_OF_SCOPE") return "Kunden tilhører ikke denne leverandøren.";
  if (code === "SELF_CUSTOMER") return "Leverandøren kan ikke være kunde av seg selv.";
  if (code === "PROTECTED_SYSTEM") return "Systemorganisasjon kan ikke gjenopprettes her.";
  if (code === "ALREADY_ACTIVE" || code === "NOT_DELETED") return "Kunden er allerede aktiv.";
  return fallback;
}

type RestoreBody = {
  confirmation?: string;
  reason?: string | null;
};

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const params = await Promise.resolve(ctx.params);
  const companyId = safeStr(params?.companyId);
  if (!isUuidLike(companyId)) return jsonErr("rid_missing", "Ugyldig kunde-id.", 400, "BAD_REQUEST");

  const auth = await authorizeProviderCustomerAdmin(req, companyId, "restore");
  if (auth.ok === false) return auth.res;

  const body = ((await readJson(req)) ?? {}) as RestoreBody;
  const confirmation = safeStr(body.confirmation);
  if (!confirmation) {
    return jsonErr(auth.rid, "Bekreftelse mangler.", 400, "VALIDATION");
  }

  try {
    const result = await executeProviderCustomerRestore(
      auth.admin,
      {
        rid: auth.rid,
        userId: auth.userId,
        email: auth.email,
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
        : result.code === "CONFIRM_MISMATCH" || result.code === "ALREADY_ACTIVE" || result.code === "NOT_DELETED" ? 409
        : 500;

      return jsonErr(auth.rid, restoreErrorMessage(result.code, result.message), status, result.code, {
        blockers: result.blockers ?? [],
        code: result.code,
      });
    }

    return jsonOk(auth.rid, {
      companyId: result.companyId,
      hasActiveAgreement: result.hasActiveAgreement,
      message: result.message,
    });
  } catch {
    return jsonErr(auth.rid, "Kunne ikke gjenopprette kunde — serverfeil under utførelse.", 500, "EXECUTION_FAILED");
  }
}
