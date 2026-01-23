export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = String(url.searchParams.get("code") ?? "").trim();
    if (!code) return jsonError(400, "missing_code", "Mangler invitasjonskode.");

    const admin = supabaseAdmin();

    const { data: row, error } = await admin
      .from("company_invites")
      .select("code, company_id, revoked_at, companies:company_id ( id, name, status )")
      .eq("code", code)
      .maybeSingle();

    if (error) return jsonError(500, "db_error", "Kunne ikke slå opp invitasjon.", error);
    if (!row) return jsonError(404, "not_found", "Invitasjonslenken finnes ikke.");
    if (row.revoked_at) return jsonError(410, "revoked", "Invitasjonslenken er ikke lenger aktiv.");

    const company = (row as any).companies;
    if (!company?.id) return jsonError(404, "company_missing", "Fant ikke firmaet bak lenken.");

    // valgfritt: stans registrering hvis firma er paused/closed
    const status = String(company.status ?? "").toLowerCase();
    if (status && status !== "active") {
      return jsonError(403, "company_inactive", "Firmaet er ikke aktivt, og kan ikke ta imot ansatte nå.", { status });
    }

    return NextResponse.json({
      ok: true,
      company: { id: company.id, name: company.name, status: company.status },
    });
  } catch (e: any) {
    return jsonError(500, "server_error", "Uventet feil ved oppslag av invitasjon.", String(e?.message ?? e));
  }
}
