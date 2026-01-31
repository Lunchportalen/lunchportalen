// app/api/superadmin/companies/pending-count/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(401, { rid }, "UNAUTHENTICATED", "Du må være innlogget.");
}

export async function GET(req: NextRequest): Promise<Response> {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.companies.pending-count.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const admin = supabaseAdmin();

    const { count, error } = await admin
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    if (error) return jsonErr(500, ctx, "DB_ERROR", "Kunne ikke hente pending-count.", error);

    return jsonOk(ctx, { ok: true, rid: ctx.rid, pending: Number(count ?? 0) }, 200);
  } catch (e: any) {
    return jsonErr(500, ctx, "SERVER_ERROR", "Kunne ikke hente pending-count.", {
      message: String(e?.message ?? e),
    });
  }
}

