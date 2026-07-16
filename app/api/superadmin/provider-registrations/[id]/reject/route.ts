export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const rid = makeRid("prov_reg_reject");
  const { requireSuperadminApi } = await import("@/lib/superadmin/auth");
  const guard = await requireSuperadminApi();
  if (guard.ok === false) {
    return jsonErr(rid, guard.message, guard.status, guard.status === 401 ? "NOT_AUTHENTICATED" : "FORBIDDEN");
  }

  const params = "then" in ctx.params ? await ctx.params : ctx.params;
  const registrationId = safeStr(params.id);
  if (!isUuid(registrationId)) return jsonErr(rid, "Ugyldig ID.", 400, "BAD_ID");

  const body = await req.json().catch(() => null);
  const reason = safeStr(body?.reason).slice(0, 2000);

  const admin = supabaseAdmin();
  const { error } = await (admin as any).rpc("lp_provider_registration_reject", {
    p_registration_id: registrationId,
    p_reason: reason || null,
    p_actor_user_id: guard.userId,
  });

  if (error) {
    const raw = String(error.message ?? "").toUpperCase();
    if (raw.includes("REGISTRATION_NOT_FOUND")) return jsonErr(rid, "Søknaden finnes ikke.", 404, "NOT_FOUND");
    if (raw.includes("REGISTRATION_NOT_PENDING")) return jsonErr(rid, "Søknaden er allerede behandlet.", 409, "NOT_PENDING");
    return jsonErr(rid, "Kunne ikke avslå søknaden.", 500, "REJECT_FAILED");
  }

  try {
    const { auditLog } = await import("@/lib/audit/log");
    auditLog({
      action: "PROVIDER_REGISTRATION_REJECTED",
      userId: guard.userId,
      role: "superadmin",
      companyId: null,
      locationId: null,
      resource: "provider_registration",
      resourceId: registrationId,
      metadata: { rid },
      timestamp: Date.now(),
      rid,
    });
  } catch {
    // best-effort
  }

  return jsonOk(rid, { registration_id: registrationId, status: "REJECTED" }, 200);
}
