// app/api/provider/packing-list/route.ts
//
// FASE 7 — provider-eid pakkeliste (JSON + CSV for utskrift/offline).
// Tenant isolation: kalleren må ha provider-medlemskap (viewer+); data hentes
// KUN for callerens egen provider (aldri klient-styrt provider_id).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { osloTodayISODate } from "@/lib/date/oslo";
import { loadProviderPackingList, packingListToCsv } from "@/lib/providers/packingList";

function isIsoDate(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export async function GET(req: NextRequest) {
  const rid = makeRid("packing_list");

  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHENTICATED");

  const ctx = await getProviderAdminContext(auth.user.id);
  const provider = ctx.primaryProvider;
  if (!provider) return jsonErr(rid, "Ingen leverandørtilgang.", 403, "PROVIDER_MEMBERSHIP_REQUIRED");

  const canView = await hasProviderRole(auth.user.id, provider.id, "provider_viewer");
  if (!canView) return jsonErr(rid, "Ingen leverandørtilgang.", 403, "PROVIDER_ROLE_REQUIRED");

  const url = new URL(req.url);
  const date = String(url.searchParams.get("date") ?? "").trim() || osloTodayISODate();
  if (!isIsoDate(date)) return jsonErr(rid, "Dato må være ÅÅÅÅ-MM-DD.", 400, "BAD_DATE");
  const format = String(url.searchParams.get("format") ?? "json").trim().toLowerCase();

  try {
    const list = await loadProviderPackingList(provider.id, date);

    if (format === "csv") {
      return new Response(packingListToCsv(list), {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="pakkeliste-${date}.csv"`,
          "cache-control": "no-store",
          "x-rid": rid,
        },
      });
    }

    return jsonOk(rid, { packingList: list }, 200);
  } catch {
    return jsonErr(rid, "Kunne ikke bygge pakkelisten.", 500, "PACKING_LIST_FAILED");
  }
}
