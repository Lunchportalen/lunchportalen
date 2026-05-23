export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import {
  requestTripletex,
  tripletexWhoAmI,
  TripletexClientError,
  TRIPLETEX_VAT_TYPE_PATH,
} from "@/lib/integrations/tripletex/client";
import { resolveTripletexProviderEnv } from "@/lib/integrations/tripletex/resolveTripletexProviderEnv";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid?: string } }): Response {
  if (s?.response) return s.response;
  if (s?.res) return s.res;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

type VatTypeRow = {
  id: unknown;
  name: unknown;
  number: unknown;
  percentage: unknown;
};

function extractVatValues(raw: unknown): VatTypeRow[] {
  const value = raw as Record<string, unknown> | null;
  const rows = Array.isArray(value?.values)
    ? value!.values
    : Array.isArray(raw)
      ? raw
      : [];
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: r.id ?? null,
      name: r.name ?? null,
      number: r.number ?? null,
      percentage: r.percentage ?? r.rate ?? null,
    };
  });
}

/** Temporary K6 P0 — superadmin-only Tripletex prod auth + vatType probe. Remove after VAT mapping apply. */
export async function GET(req: NextRequest): Promise<Response> {
  const s = await scopeOr401(req);
  if (!s.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.tripletex.prod_verify.GET", ["superadmin"]);
  if (deny) return deny;

  const rid = ctx.rid;
  const baseUrl = String(process.env.TRIPLETEX_BASE_URL ?? "").trim() || "https://tripletex.no/v2";
  const providerEnv = resolveTripletexProviderEnv();

  try {
    const whoAmI = await tripletexWhoAmI();
    const vatRes = await requestTripletex({
      method: "GET",
      path: TRIPLETEX_VAT_TYPE_PATH,
      query: { from: 0, count: 100 },
    });

    const vatTypes = extractVatValues(vatRes.value).map((v) => ({
      id: v.id,
      name: v.name,
      number: v.number,
      percentage: v.percentage,
    }));

    return jsonOk(rid, {
      baseUrl,
      providerEnv,
      whoAmI: {
        companyId: whoAmI.companyId,
      },
      vatTypes,
    });
  } catch (err: unknown) {
    const message =
      err instanceof TripletexClientError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";
    const code = err instanceof TripletexClientError ? err.code : "TRIPLETEX_VERIFY_FAILED";

    return jsonErr(rid, message, 500, {
      code,
      hint: "Sjekk TRIPLETEX_* env-vars på Vercel Production-scope (BASE_URL, CONSUMER_TOKEN, EMPLOYEE_TOKEN, COMPANY_ID).",
      baseUrl,
      providerEnv,
    });
  }
}
