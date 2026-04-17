// lib/admin/fetchAgreementPageDataServer.ts
/** Delt server-fetch til GET /api/admin/agreement (én kilde for AgreementPageData). */
import "server-only";

import { headers } from "next/headers";

import type { AgreementPageData } from "@/lib/admin/agreement/types";

export type AgreementPageFetchResult =
  | { kind: "ok"; data: AgreementPageData; rid: string }
  | { kind: "error"; message: string; rid: string; errorCode?: string | null };

type HeaderLike = { get(name: string): string | null };

function makeRid(prefix = "admin_agreement") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getOriginFromHeaders(h: HeaderLike) {
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0]?.trim() || "http";
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]?.trim();
  return host ? `${proto}://${host}` : "";
}

/**
 * Henter AgreementPageData via GET /api/admin/agreement.
 * For **company_admin** ignorerer API alltid `companyId`-query og bruker kun `profiles.company_id` fra sesjon (se route).
 * Param er kun relevant for **superadmin**-kall der slik rute tillater valg av firma.
 */
export async function fetchAgreementPageDataForAdmin(companyId?: string | null): Promise<AgreementPageFetchResult> {
  const h = await headers();
  const rid = makeRid();
  const origin = getOriginFromHeaders(h as unknown as HeaderLike);
  const cookieHeader = h.get("cookie") ?? "";

  const companyParam = companyId ? `?companyId=${encodeURIComponent(companyId)}` : "";
  const fetchUrl = `${origin}/api/admin/agreement${companyParam}`;

  try {
    const res = await fetch(fetchUrl, {
      cache: "no-store",
      headers: {
        cookie: cookieHeader,
        "x-rid": rid,
      },
    });

    const json = await res.json().catch(() => null);
    const responseRid = String(json?.rid ?? rid);

    if (!json || json.ok !== true) {
      return {
        kind: "error",
        message: json?.message ?? "Kunne ikke hente avtalen. Prøv igjen.",
        rid: responseRid,
        errorCode: json?.error ?? "API_ERROR",
      };
    }

    return { kind: "ok", data: json.data as AgreementPageData, rid: responseRid };
  } catch {
    return { kind: "error", message: "Kunne ikke hente avtalen. Prøv igjen.", rid, errorCode: "FETCH_FAILED" };
  }
}
