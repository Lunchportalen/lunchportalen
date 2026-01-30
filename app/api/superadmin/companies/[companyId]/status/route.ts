// app/api/superadmin/companies/[companyId]/status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * ✅ DB-fasit:
 * - companies.status er ENESTE sannhetskilde (lowercase): pending|active|paused|closed
 * - audit_events brukes for sporbarhet (best effort)
 */

type CompanyStatus = "pending" | "active" | "paused" | "closed";
const ALLOWED = new Set<CompanyStatus>(["pending", "active", "paused", "closed"]);

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(401, { rid }, "UNAUTHENTICATED", "Du må være innlogget.");
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v ?? ""))
  );
}

function normStatus(v: any): CompanyStatus | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!ALLOWED.has(s as CompanyStatus)) return null;
  return s as CompanyStatus;
}

// ✅ Server-side overgangsregler (stramme men praktiske)
function canTransition(from: CompanyStatus, to: CompanyStatus) {
  if (from === to) return true;
  if (from === "pending") return to === "active" || to === "closed";
  if (from === "active") return to === "paused" || to === "closed";
  if (from === "paused") return to === "active" || to === "closed";
  if (from === "closed") return to === "active"; // “gjenåpne”
  return false;
}

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.company.status.POST", ["superadmin"]);
  if (deny) return deny;

  const params = await Promise.resolve(ctx.params as any);
  const companyId = String(params?.companyId ?? "").trim();
  if (!isUuid(companyId)) return jsonErr(400, a, "BAD_REQUEST", "Ugyldig companyId.");

  const body = (await readJson(req)) ?? {};
  const nextStatus = normStatus(body?.status);
  const reason = safeText(body?.reason);

  if (!nextStatus) {
    return jsonErr(400, a, "BAD_REQUEST", "Ugyldig status. Bruk: pending/active/paused/closed.");
  }

  const admin = supabaseAdmin();

  try {
    // 1) Les nåværende status
    const cur = await admin.from("companies").select("id,status,updated_at,name").eq("id", companyId).single();

    if (cur.error || !cur.data) return jsonErr(404, a, "NOT_FOUND", "Fant ikke firma.", cur.error);

    const fromStatus = normStatus(cur.data.status) ?? "pending";

    // 2) Valider overgang
    if (!canTransition(fromStatus, nextStatus)) {
      return jsonErr(409, a, "INVALID_TRANSITION", `Ugyldig overgang: ${fromStatus} → ${nextStatus}`);
    }

    // 3) Race-sikring (optimistic concurrency): oppdater kun hvis updated_at matcher
    const expectedUpdatedAt = cur.data.updated_at;

    const upd = await admin
      .from("companies")
      .update({ status: nextStatus } as any)
      .eq("id", companyId)
      .eq("updated_at", expectedUpdatedAt)
      .select("id,status,updated_at,name")
      .single();

    if (upd.error || !upd.data) {
      return jsonErr(409, a, "CONFLICT", "Status ble endret av noen andre. Oppdater siden og prøv igjen.", upd.error);
    }

    // 4) Audit (best effort)
    const summary = `Status ${fromStatus} → ${nextStatus}${reason ? ` (${reason})` : ""}`;
    let auditWarning: any = null;

    try {
      const auditIns = await admin.from("audit_events").insert({
        actor_user_id: a.scope?.userId ?? null,
        actor_email: a.scope?.email ?? null,
        actor_role: a.scope?.role ?? null,
        action: "COMPANY_STATUS_SET",
        entity_type: "company",
        entity_id: companyId,
        summary,
        detail: { from: fromStatus, to: nextStatus, reason, company_name: cur.data.name ?? null, rid: a.rid },
        rid: a.rid,
      } as any);

      if (auditIns?.error) auditWarning = { audit_error: auditIns.error };
    } catch (e: any) {
      auditWarning = { audit_error: String(e?.message ?? e) };
    }

    return jsonOk(
      a,
      {
        ok: true,
        rid: a.rid,
        company: {
          id: upd.data.id,
          name: upd.data.name,
          status: upd.data.status,
          updated_at: upd.data.updated_at,
        },
        changed: { from: fromStatus, to: nextStatus },
        ...(auditWarning ? { warning: auditWarning } : {}),
      },
      200
    );
  } catch (e: any) {
    return jsonErr(500, a, "SERVER_ERROR", "Uventet feil.", { message: String(e?.message ?? e) });
  }
}
