// app/api/invites/lookup/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { rid as makeRid } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";

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

function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  const body = { ok: false, rid, error, message, detail: detail ?? undefined };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8" },
  });
}
function jsonOk(rid: string, body: any, status = 200) {
  return new Response(JSON.stringify({ ...body, rid }), {
    status,
    headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8" },
  });
}

export async function GET(req: NextRequest) {
  const rid = makeRid();

  try {
    const url = new URL(req.url);
    const code = safeStr(url.searchParams.get("code"));
    if (!code) return jsonErr(400, rid, "missing_code", "Mangler invitasjonskode.");

    const admin = supabaseAdmin();

    const { data: row, error } = await admin
      .from("company_invites")
      .select("code, company_id, revoked_at, companies:company_id ( id, name, status )")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      return jsonErr(500, rid, "db_error", "Kunne ikke slå opp invitasjon.", errDetail(error));
    }
    if (!row) return jsonErr(404, rid, "not_found", "Invitasjonslenken finnes ikke.");
    if ((row as any).revoked_at) return jsonErr(410, rid, "revoked", "Invitasjonslenken er ikke lenger aktiv.");

    const companyJoin = (row as any).companies;
    const companyObj = Array.isArray(companyJoin) ? companyJoin[0] : companyJoin;

    if (!companyObj?.id) return jsonErr(404, rid, "company_missing", "Fant ikke firmaet bak lenken.");

    // hard stop hvis firma ikke er ACTIVE
    const status = safeStr(companyObj.status).toLowerCase();
    if (status && status !== "active") {
      return jsonErr(403, rid, "company_inactive", "Firmaet er ikke aktivt, og kan ikke ta imot ansatte nå.", {
        status,
      });
    }

    return jsonOk(rid, {
      ok: true,
      company: { id: companyObj.id, name: companyObj.name ?? null, status: companyObj.status ?? null },
    });
  } catch (e: any) {
    return jsonErr(500, rid, "server_error", "Uventet feil ved oppslag av invitasjon.", errDetail(e));
  }
}
