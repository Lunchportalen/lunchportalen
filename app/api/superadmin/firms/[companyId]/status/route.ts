// app/api/superadmin/firms/[companyId]/status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getScope } from "@/lib/auth/scope";

/* =========================
   Response helpers
========================= */
function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

/* =========================
   Utils
========================= */
function rid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };

// UI/produktets fasit (uppercase)
const ALLOWED_UP = new Set(["PENDING", "ACTIVE", "PAUSED", "CLOSED"]);

// ✅ DB-format: companies_status_check bruker typisk lowercase
function toDbStatus(up: string) {
  // Hvis dere senere velger annet format, er det kun her dere endrer.
  return up.toLowerCase(); // pending/active/paused/closed
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const requestId = rid();

  // Next.js: await params
  const params = await ctx.params;
  const companyId = String(params?.companyId ?? "").trim();
  if (!isUuid(companyId)) return jsonErr(400, requestId, "BAD_REQUEST", "Ugyldig companyId.");

  // Auth
  const scope = await getScope(req).catch(() => null);
  if (!scope) return jsonErr(401, requestId, "UNAUTHORIZED", "Ikke innlogget.");
  if ((scope as any).role !== "superadmin") {
    return jsonErr(403, requestId, "FORBIDDEN", "Kun superadmin kan endre firmastatus.");
  }

  // Body
  const body = await req.json().catch(() => null);
  const raw = String(body?.status ?? body?.statusUpper ?? "").trim();
  const nextUp = raw.toUpperCase();

  if (!ALLOWED_UP.has(nextUp)) {
    return jsonErr(400, requestId, "BAD_REQUEST", "Ugyldig status.", {
      received: raw,
      normalized: nextUp,
      allowed: Array.from(ALLOWED_UP),
    });
  }

  const nextDb = toDbStatus(nextUp);

  // ✅ Tabellen som faktisk brukes hos deg: companies.status
  const { data, error } = await supabaseAdmin()
    .from("companies")
    .update({ status: nextDb })
    .eq("id", companyId)
    .select("id,status,updated_at")
    .single();

  if (error) {
    return jsonErr(500, requestId, "DB_ERROR", "Kunne ikke oppdatere status.", {
      tableTried: "companies",
      columnTried: "status",
      sent: nextDb,
      message: error.message,
      details: (error as any).details,
      hint: (error as any).hint,
      code: (error as any).code,
    });
  }

  return jsonOk({ ok: true, rid: requestId, company: data });
}
