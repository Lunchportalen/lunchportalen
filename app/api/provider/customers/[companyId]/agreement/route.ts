// app/api/provider/customers/[companyId]/agreement/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk } from "@/lib/http/respond";
import { readJson } from "@/lib/http/routeGuard";
import { authorizeProviderCustomerAdmin } from "@/lib/server/provider/providerCustomerRouteAuth";
import {
  executeProviderCustomerAgreementUpdate,
  loadProviderCustomerAgreement,
} from "@/lib/server/provider/providerCustomerAgreementService";
import type { ProviderAgreementPatchInput } from "@/lib/providers/providerCustomerAgreementTypes";

type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuidLike(v: unknown) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(safeStr(v));
}

function agreementErrorMessage(code: string, fallback: string): string {
  if (code === "PROVIDER_ROLE_MISSING") {
    return "Brukeren er ikke registrert som administrator for denne leverandøren.";
  }
  if (code === "PROVIDER_CONTEXT_MISSING") {
    return "Fant ikke leverandørtilknytning for innlogget bruker.";
  }
  if (code === "FORBIDDEN" || code === "OUT_OF_SCOPE") return "Du har ikke tilgang til denne kunden.";
  if (code === "SELF_CUSTOMER") return "Leverandøren kan ikke være kunde av seg selv.";
  if (code === "PROTECTED_SYSTEM") return "Systemorganisasjon kan ikke endres her.";
  if (code === "NO_ACTIVE_AGREEMENT") return "Firma har ingen aktiv avtale.";
  return fallback;
}

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const params = await Promise.resolve(ctx.params);
  const companyId = safeStr(params?.companyId);
  if (!isUuidLike(companyId)) return jsonErr("rid_missing", "Ugyldig kunde-id.", 400, "BAD_REQUEST");

  const auth = await authorizeProviderCustomerAdmin(req, companyId, "agreement");
  if (auth.ok === false) return auth.res;

  const result = await loadProviderCustomerAgreement(auth.admin, auth.providerId, companyId);
  if (result.ok === false) {
    return jsonErr(auth.rid, agreementErrorMessage(result.code, result.message), result.status, result.code);
  }

  return jsonOk(auth.rid, result.data, 200);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const params = await Promise.resolve(ctx.params);
  const companyId = safeStr(params?.companyId);
  if (!isUuidLike(companyId)) return jsonErr("rid_missing", "Ugyldig kunde-id.", 400, "BAD_REQUEST");

  const auth = await authorizeProviderCustomerAdmin(req, companyId, "agreement");
  if (auth.ok === false) return auth.res;

  const body = ((await readJson(req)) ?? {}) as ProviderAgreementPatchInput;

  try {
    const result = await executeProviderCustomerAgreementUpdate(auth.admin, {
      rid: auth.rid,
      userId: auth.userId,
      email: auth.email,
    }, {
      providerId: auth.providerId,
      companyId,
      patch: body,
    });

    if (result.ok === false) {
      return jsonErr(auth.rid, agreementErrorMessage(result.code, result.message), result.status, result.code);
    }

    return jsonOk(auth.rid, { agreement: result.data, message: "Avtalen er oppdatert." }, 200);
  } catch {
    return jsonErr(auth.rid, "Kunne ikke oppdatere avtale — serverfeil under utførelse.", 500, "EXECUTION_FAILED");
  }
}
