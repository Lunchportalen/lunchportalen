// app/api/superadmin/companies/[companyId]/status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getScope, requireSuperadmin } from "@/lib/auth/scope";

/**
 * ✅ DB-fasit:
 * - companies.status er ENESTE sannhetskilde
 * - lagres som lowercase: 'pending'|'active'|'paused'|'closed'
 * - UI kan bruke uppercase, men må mappe inn/ut
 * - audit_events brukes for sporbarhet (hvem/hva/når/fra→til)
 */

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
function rid() {
  return crypto.randomBytes(8).toString("hex");
}
function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v ?? ""));
}

const ALLOWED = new Set(["pending", "active", "paused", "closed"] as const);
type CompanyStatus = "pending" | "active" | "paused" | "closed";

function normStatus(v: any): CompanyStatus | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!ALLOWED.has(s as any)) return null;
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

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const requestId = rid();

  try {
    const params = await Promise.resolve(ctx.params);
    const companyId = String(params?.companyId ?? "");
    if (!isUuid(companyId)) return jsonErr(400, requestId, "bad_request", "Ugyldig companyId.");

    // ✅ Auth + guard (FASIT i deres scope.ts)
    let scope: Awaited<ReturnType<typeof getScope>>;
    try {
      scope = await getScope(req);
      requireSuperadmin(scope);
    } catch (e: any) {
      const status = e?.status ?? 403;
      const code = e?.code ?? "FORBIDDEN";
      return jsonErr(status, requestId, code, e?.message ?? "Ingen tilgang.");
    }

    const body = await req.json().catch(() => ({}));
    const nextStatus = normStatus(body?.status);
    const reason = safeText(body?.reason);

    if (!nextStatus) {
      return jsonErr(400, requestId, "bad_request", "Ugyldig status. Bruk: pending/active/paused/closed.");
    }

    const admin = supabaseAdmin();

    // 1) Les nåværende status (EN kolonne)
    const cur = await admin.from("companies").select("id,status,updated_at,name").eq("id", companyId).single();

    if (cur.error || !cur.data) return jsonErr(404, requestId, "not_found", "Fant ikke firma.", cur.error);

    const fromStatus = normStatus(cur.data.status) ?? "pending";

    // 2) Valider overgang
    if (!canTransition(fromStatus, nextStatus)) {
      return jsonErr(409, requestId, "invalid_transition", `Ugyldig overgang: ${fromStatus} → ${nextStatus}`);
    }

    // 3) Race-sikring (optimistic concurrency): oppdater kun hvis updated_at matcher
    const expectedUpdatedAt = cur.data.updated_at;

    const upd = await admin
      .from("companies")
      .update({ status: nextStatus })
      .eq("id", companyId)
      .eq("updated_at", expectedUpdatedAt)
      .select("id,status,updated_at,name")
      .single();

    if (upd.error || !upd.data) {
      return jsonErr(
        409,
        requestId,
        "conflict",
        "Status ble endret av noen andre. Oppdater siden og prøv igjen.",
        upd.error
      );
    }

    // 4) Audit (best effort)
    const summary = `Status ${fromStatus} → ${nextStatus}${reason ? ` (${reason})` : ""}`;
    const auditIns = await admin.from("audit_events").insert({
      actor_user_id: scope.user_id ?? null,
      actor_email: scope.email ?? null,
      actor_role: scope.role ?? null,
      action: "COMPANY_STATUS_SET",
      entity_type: "company",
      entity_id: companyId,
      summary,
      detail: { from: fromStatus, to: nextStatus, reason, company_name: cur.data.name ?? null, rid: requestId },
    });

    // Audit-feil skal ikke stoppe status-endring, men vi returnerer warning i responsen
    const auditWarning = auditIns?.error ? { audit_error: auditIns.error } : undefined;

    return jsonOk({
      ok: true,
      rid: requestId,
      company: {
        id: upd.data.id,
        name: upd.data.name,
        status: upd.data.status,
        updated_at: upd.data.updated_at,
      },
      changed: { from: fromStatus, to: nextStatus },
      ...(auditWarning ? { warning: auditWarning } : {}),
    });
  } catch (e: any) {
    return jsonErr(500, requestId, "server_error", "Uventet feil.", String(e?.message ?? e));
  }
}
