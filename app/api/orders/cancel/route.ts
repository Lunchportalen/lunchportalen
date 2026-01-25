// app/api/orders/cancel/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { enforceOrderCancel, auditEnforcementEvent } from "@/lib/enforce";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function jsonErr(status: number, body: any) {
  return NextResponse.json(body, { status, headers: noStore() });
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

async function readJson(req: NextRequest) {
  const t = await req.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return {};
  }
}

function isIsoDate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

function mkRid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function getErrCode(x: any) {
  // ✅ Safe: ingen TS-kræsj
  return String(x?.error ?? "FORBIDDEN");
}

export async function POST(req: NextRequest) {
  const rid = mkRid("orders_cancel");

  const sb = await supabaseServer();

  const body = await readJson(req);
  const isoDate = String(body?.date ?? "");

  if (!isIsoDate(isoDate)) {
    return jsonErr(400, {
      ok: false,
      rid,
      error: "INVALID_DATE",
      message: "Ugyldig dato",
      detail: { date: isoDate },
    });
  }

  // ✅ Midlertidig: compile-feilfri. Koble på riktig Sanity helper senere.
  const isClosedDate = async (_d: string) => false;

  const enf = await enforceOrderCancel({ isoDate, isClosedDate, req });

  if (!enf.ok) {
    // Best effort audit (skal aldri knekke ruta)
    try {
      await auditEnforcementEvent({
        ctx: { rid, role: "employee", company_id: null, user_id: null, email: null },
        action: "ENFORCEMENT_BLOCK",
        reason: getErrCode(enf) as any,
        endpoint: "POST /api/orders/cancel",
        extra: { date: isoDate, rid },
      });
    } catch {
      // ignore
    }

    // Returner enf, men legg på route-rid hvis du vil
    return jsonErr(403, { ...enf, rid });
  }

  const { ctx, company_id } = enf;

  if (!ctx.user_id) {
    return jsonErr(401, { ok: false, rid, error: "UNAUTHENTICATED", message: "Mangler user_id" });
  }

  // ✅ Viktig: enum i DB: "active" / "canceled" (lowercase)
  const { error } = await sb
    .from("orders")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("company_id", company_id)
    .eq("user_id", ctx.user_id)
    .eq("date", isoDate);

  if (error) {
    return jsonErr(500, { ok: false, rid, error: "DB_ERROR", message: "Kunne ikke avbestille", detail: error });
  }

  return jsonOk({ ok: true, rid, cancelled: true, date: isoDate });
}
