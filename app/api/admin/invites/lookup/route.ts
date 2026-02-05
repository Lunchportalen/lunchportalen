// app/api/invites/lookup/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function errDetail(e: any) {
  if (!e) return null;
  if (typeof e === "string") return e;
  if (e instanceof Error) return { name: e.name, message: e.message };
  try {
    return JSON.parse(JSON.stringify(e));
  } catch {
    return String(e);
  }
}

 

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = makeRid();

  try {
    const url = new URL(req.url);
    const code = safeStr(url.searchParams.get("code"));
    if (!code) return jsonErr(rid, "Mangler invitasjonskode.", 400, "missing_code");

    const admin = supabaseAdmin();

    const { data: row, error } = await admin
      .from("company_invites")
      .select("code, company_id, revoked_at, companies:company_id ( id, name, status )")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      return jsonErr(rid, "Kunne ikke slå opp invitasjon.", 500, { code: "db_error", detail: errDetail(error) });
    }
    if (!row) return jsonErr(rid, "Invitasjonslenken finnes ikke.", 404, "not_found");
    if ((row as any).revoked_at) return jsonErr(rid, "Invitasjonslenken er ikke lenger aktiv.", 410, "revoked");

    const companyJoin = (row as any).companies;
    const companyObj = Array.isArray(companyJoin) ? companyJoin[0] : companyJoin;

    if (!companyObj?.id) return jsonErr(rid, "Fant ikke firmaet bak lenken.", 404, "company_missing");

    // hard stop hvis firma ikke er ACTIVE
    const status = safeStr(companyObj.status).toLowerCase();
    if (status && status !== "active") {
      return jsonErr(rid, "Firmaet er ikke aktivt, og kan ikke ta imot ansatte nå.", 403, { code: "company_inactive", detail: {
        status,
      } });
    }

    return jsonOk(rid, {
      company: { id: companyObj.id, name: companyObj.name ?? null, status: companyObj.status ?? null },
    });
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil ved oppslag av invitasjon.", 500, { code: "server_error", detail: errDetail(e) });
  }
}
