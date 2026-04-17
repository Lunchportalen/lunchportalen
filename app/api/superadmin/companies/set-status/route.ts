// app/api/superadmin/companies/set-status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { supabaseServer } from "@/lib/supabase/server";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import { logOpsEventBestEffort } from "@/lib/ops/logOpsEvent";
import {
  applyCompanyLifecycleStatus,
  normalizeCompanyLifecycleStatus,
} from "@/lib/server/superadmin/companyLifecycleStatusApply";

/**
 * ✅ FASIT
 * - companies.status er ENESTE sannhetskilde (enum): PENDING|ACTIVE|PAUSED|CLOSED
 * - payload aksepterer både companyId og company_id (kompat)
 * - status aksepterer både lower og UPPER (kompat), lagres som enum-label
 * - Superadmin-only (scope + rolle + DB-profil)
 * - Idempotent + audit (best-effort)
 */

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest) {
  try {
    const gate = await scopeOr401(req);
    if (gate.ok === false) return gate.res;

    const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
    if (deny) return deny;

    const uid = safeStr(gate.ctx.scope.userId);
    if (!uid || !(await isSuperadminProfile(uid))) {
      return jsonErr(gate.ctx.rid, "Ingen tilgang.", 403, {
        code: "FORBIDDEN",
        detail: { reason: "superadmin_required" },
      });
    }

    const body = await req.json().catch(() => null);

    const company_id = safeStr(body?.companyId ?? body?.company_id);
    const statusRaw = body?.status == null ? null : safeStr(body?.status);
    const next = normalizeCompanyLifecycleStatus(statusRaw);

    if (!company_id) return jsonErr(gate.ctx.rid, "companyId mangler.", 400, { code: "VALIDATION" });
    if (!next) return jsonErr(gate.ctx.rid, "Ugyldig status.", 400, { code: "VALIDATION", detail: { status: statusRaw } });

    const sb = await supabaseServer();
    const rid = gate.ctx.rid;

    const applied = await applyCompanyLifecycleStatus(sb, rid, company_id, next);
    if (applied.ok === false) return applied.response;

    if (applied.already) {
      return jsonOk(rid, { companyId: company_id, status: next, already: true });
    }

    await logOpsEventBestEffort(sb, {
      rid,
      actor_user_id: uid,
      actor_email: gate.ctx.scope.email ?? null,
      actor_role: "superadmin",
      action: "COMPANY_STATUS_CHANGED",
      entity_type: "company",
      entity_id: company_id,
      summary: `Company status changed: ${applied.companyName || company_id}`,
      detail: { from: applied.prev, to: applied.next, via: "companies.set-status" },
    });

    return jsonOk(rid, { companyId: company_id, status: next });
  } catch (e: any) {
    const rid = makeRid();
    return jsonErr(rid, "Uventet feil.", 500, {
      code: "SET_STATUS_CRASH",
      detail: { message: safeStr(e?.message ?? e) },
    });
  }
}
