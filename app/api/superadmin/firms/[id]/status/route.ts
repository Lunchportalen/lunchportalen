// app/api/superadmin/firms/[id]/status/route.ts
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

const ALLOWED = new Set(["PENDING", "ACTIVE", "PAUSED", "CLOSED"]);

type Ctx = { params: { id: string } | Promise<{ id: string }> };

function normalizeIncomingStatus(body: any): { raw: string; next: string } {
  // Støtt begge payload-varianter: {status:"active"} / {status:"ACTIVE"} / {statusUpper:"ACTIVE"}
  const raw = String(body?.status ?? body?.statusUpper ?? "").trim();
  const next = raw.toUpperCase();
  return { raw, next };
}

function isMissingColumnError(e: any) {
  // Postgres: undefined_column = 42703
  return String(e?.code ?? "") === "42703" || String(e?.message ?? "").toLowerCase().includes("does not exist");
}

/* =========================
   Route
========================= */
export async function POST(req: NextRequest, ctx: Ctx) {
  const requestId = rid();

  // ✅ Next.js dynamic params kan være Promise
  const params = await ctx.params;
  const firmId = String(params?.id ?? "").trim();

  if (!isUuid(firmId)) {
    return jsonErr(400, requestId, "BAD_REQUEST", "Ugyldig id.");
  }

  // ✅ Auth
  const scope = await getScope(req).catch(() => null);
  if (!scope) return jsonErr(401, requestId, "UNAUTHORIZED", "Ikke innlogget.");
  if ((scope as any).role !== "superadmin") {
    return jsonErr(403, requestId, "FORBIDDEN", "Kun superadmin kan endre firmastatus.");
  }

  const body = await req.json().catch(() => null);
  const { raw, next } = normalizeIncomingStatus(body);

  if (!ALLOWED.has(next)) {
    return jsonErr(400, requestId, "BAD_REQUEST", "Ugyldig status.", {
      received: raw,
      normalized: next,
      allowed: Array.from(ALLOWED),
    });
  }

  // ✅ DB: vi tåler at kolonnen heter enten `status` eller `firm_status`
  // Først prøver vi `status`, deretter fallback til `firm_status` hvis kolonnen mangler.
  const admin = supabaseAdmin();

  // Attempt 1: status
  {
    const { data, error } = await admin
      .from("firms")
      .update({ status: next })
      .eq("id", firmId)
      .select("id,status,updated_at")
      .single();

    if (!error) {
      return jsonOk({ ok: true, rid: requestId, firm: data, column: "status" });
    }

    // Hvis det IKKE er "kolonne mangler", så er det en reell DB-feil vi må vise.
    if (!isMissingColumnError(error)) {
      return jsonErr(500, requestId, "DB_ERROR", "Kunne ikke oppdatere status.", {
        tried: "status",
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
      });
    }
  }

  // Attempt 2: firm_status (fallback)
  {
    const { data, error } = await admin
      .from("firms")
      .update({ firm_status: next })
      .eq("id", firmId)
      .select("id,firm_status,updated_at")
      .single();

    if (error) {
      return jsonErr(500, requestId, "DB_ERROR", "Kunne ikke oppdatere status.", {
        tried: "firm_status",
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
      });
    }

    return jsonOk({ ok: true, rid: requestId, firm: data, column: "firm_status" });
  }
}
