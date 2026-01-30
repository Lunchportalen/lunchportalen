// app/api/superadmin/firms/[companyId]/status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

// UI/produktets fasit (uppercase)
const ALLOWED_UP = new Set(["PENDING", "ACTIVE", "PAUSED", "CLOSED"]);

// ✅ DB-format: companies.status er lowercase
function toDbStatus(up: string) {
  return up.toLowerCase(); // pending/active/paused/closed
}

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return (s?.response as Response) || (s?.res as Response) || jsonErr(401, { rid: "rid_missing" }, "UNAUTHENTICATED", "Du må være innlogget.");

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.firms.status.POST", ["superadmin"]);
  if (deny) return deny;

  const params = await ctx.params;
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(400, a, "BAD_REQUEST", "Ugyldig companyId.");

  const body = (await readJson(req)) ?? {};
  const raw = safeStr(body?.status ?? body?.statusUpper);
  const nextUp = raw.toUpperCase();

  if (!ALLOWED_UP.has(nextUp)) {
    return jsonErr(400, a, "BAD_REQUEST", "Ugyldig status.", {
      received: raw,
      normalized: nextUp,
      allowed: Array.from(ALLOWED_UP),
    });
  }

  const nextDb = toDbStatus(nextUp);

  try {
    const { data, error } = await supabaseAdmin()
      .from("companies")
      .update({ status: nextDb })
      .eq("id", companyId)
      .select("id,status,updated_at")
      .single();

    if (error) {
      return jsonErr(500, a, "DB_ERROR", "Kunne ikke oppdatere status.", {
        table: "companies",
        column: "status",
        sent: nextDb,
        message: (error as any).message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: (error as any).code,
      });
    }

    return jsonOk(a, { ok: true, rid: a.rid, company: data }, 200);
  } catch (e: any) {
    return jsonErr(500, a, "SERVER_ERROR", "Kunne ikke oppdatere status.", { message: String(e?.message ?? e) });
  }
}
