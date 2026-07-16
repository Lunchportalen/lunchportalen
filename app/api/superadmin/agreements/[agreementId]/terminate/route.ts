// Fase 5: agreement state machine — ACTIVE/SUSPENDED → TERMINATED (superadmin, terminal).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: { agreementId: string } | Promise<{ agreementId: string }> };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const g = await scopeOr401(req);
  if (g.ok === false) return g.response;
  const deny = requireRoleOr403(g.ctx, "superadmin.agreements.terminate", ["superadmin"]);
  if (deny) return deny;
  const rid = g.ctx.rid;

  try {
    const params = await Promise.resolve(ctx.params as any);
    const agreementId = safeStr(params?.agreementId);
    if (!agreementId) return jsonErr(rid, "Ugyldig avtale.", 400, "BAD_INPUT");

    const body = await req.json().catch(() => null);
    const reason = safeStr(body?.reason).slice(0, 2000) || null;

    const admin = supabaseAdmin();
    const { data, error } = await (admin as any).rpc("lp_agreement_terminate", {
      p_agreement_id: agreementId,
      p_actor_user_id: safeStr(g.ctx.scope.userId) || null,
      p_reason: reason,
    });
    if (error) {
      const m = safeStr(error.message).toUpperCase();
      if (m.includes("AGREEMENT_NOT_FOUND")) return jsonErr(rid, "Fant ikke avtale.", 404, "AGREEMENT_NOT_FOUND");
      if (m.includes("AGREEMENT_NOT_TERMINABLE")) return jsonErr(rid, "Avtalen kan ikke termineres fra nåværende status.", 409, "AGREEMENT_NOT_TERMINABLE");
      return jsonErr(rid, "Kunne ikke terminere avtalen.", 500, "AGREEMENT_TERMINATE_FAILED");
    }
    return jsonOk(rid, { agreementId, status: safeStr((data as any)?.status) || "TERMINATED" }, 200);
  } catch {
    return jsonErr(rid, "Kunne ikke terminere avtalen.", 500, "AGREEMENT_TERMINATE_UNEXPECTED");
  }
}
