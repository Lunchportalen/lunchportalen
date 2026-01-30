// app/api/superadmin/companies/[companyId]/agreement/status/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/agreements/normalize";

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };
type Status = "ACTIVE" | "PAUSED" | "CLOSED";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function toDbCompanyStatus(s: Status) {
  return s.toLowerCase(); // active/paused/closed
}

function osloISODate() {
  // YYYY-MM-DD (Europe/Oslo)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function tryAuditMeta(admin: any, payload: any) {
  try {
    await admin.from("audit_meta_events").insert(payload);
    return true;
  } catch {
    return false;
  }
}

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(401, { rid }, "UNAUTHENTICATED", "Du må være innlogget.");
}

export async function POST(req: NextRequest, ctx: Ctx): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.agreement.status.POST", ["superadmin"]);
  if (deny) return deny;

  const params = await Promise.resolve(ctx.params as any);
  const companyId = safeStr(params?.companyId);
  if (!isUuid(companyId)) return jsonErr(400, a, "BAD_REQUEST", "Ugyldig companyId.");

  const body = (await readJson(req)) ?? {};
  const sRaw = safeStr(body?.status ?? "").toUpperCase();
  const next = sRaw as Status;

  if (next !== "ACTIVE" && next !== "PAUSED" && next !== "CLOSED") {
    return jsonErr(400, a, "BAD_REQUEST", "status må være ACTIVE/PAUSED/CLOSED.");
  }

  const admin = supabaseAdmin();

  try {
    // Finn "current" (foretrukket ACTIVE ellers nyeste) for audit + for å vite agreementId
    const { data: list, error: listErr } = await admin
      .from("company_agreements")
      .select(
        "id, company_id, status, plan_tier, price_per_cuvert_nok, delivery_days, binding_months, notice_months, start_date, end_date, notes, updated_at, created_at"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (listErr) return jsonErr(500, a, "DB_ERROR", "Kunne ikke lese avtaler.", listErr);

    const rows = (list ?? []) as any[];
    const current = rows.find((x) => String(x.status).toUpperCase() === "ACTIVE") ?? rows[0] ?? null;
    if (!current?.id) return jsonErr(404, a, "NOT_FOUND", "Fant ingen avtale for firmaet.");

    // Idempotent
    const prevStatus = String(current.status ?? "").toUpperCase();
    if (prevStatus === next) {
      return jsonOk(
        a,
        {
          ok: true,
          rid: a.rid,
          company_id: companyId,
          agreement_id: String(current.id),
          status: next,
          idempotent: true,
        },
        200
      );
    }

    // Hvis ACTIVE: pause andre ACTIVE først (invariant)
    let pausedOtherActiveIds: string[] = [];
    if (next === "ACTIVE") {
      const pause = await admin
        .from("company_agreements")
        .update({ status: "PAUSED", updated_at: new Date().toISOString(), updated_by: a.scope?.userId ?? null } as any)
        .eq("company_id", companyId)
        .eq("status", "ACTIVE")
        .neq("id", current.id)
        .select("id");

      if (pause.error) return jsonErr(500, a, "DB_ERROR", "Kunne ikke pause annen ACTIVE-avtale.", pause.error);
      pausedOtherActiveIds = (pause.data ?? []).map((x: any) => String(x.id));
    }

    // Oppdater valgt agreement
    const patch: any = {
      status: next,
      updated_at: new Date().toISOString(),
      updated_by: a.scope?.userId ?? null,
    };

    if (next === "CLOSED" && !current.end_date) patch.end_date = osloISODate();
    if (next === "ACTIVE") patch.end_date = null;

    const upd = await admin
      .from("company_agreements")
      .update(patch)
      .eq("id", current.id)
      .select("id, company_id, status, end_date, updated_at")
      .single();

    if (upd.error) return jsonErr(500, a, "DB_ERROR", "Kunne ikke oppdatere status.", upd.error);

    // Sync companies.status (lowercase)
    await admin
      .from("companies")
      .update({ status: toDbCompanyStatus(next), updated_at: new Date().toISOString() } as any)
      .eq("id", companyId);

    // Audit (best effort)
    const auditOk = await tryAuditMeta(admin, {
      actor_user_id: a.scope?.userId ?? null,
      actor_email: a.scope?.email ?? null,
      action: "agreement.status",
      purpose: null,
      entity_type: "company_agreement",
      entity_id: String(current.id),
      rid: a.rid,
      detail: {
        company_id: companyId,
        agreement_id: String(current.id),
        from: prevStatus,
        to: next,
        paused_other_active_ids: pausedOtherActiveIds,
        before: current,
        after: upd.data,
      },
      created_at: new Date().toISOString(),
    });

    return jsonOk(
      a,
      {
        ok: true,
        rid: a.rid,
        company_id: upd.data?.company_id ?? companyId,
        agreement_id: upd.data?.id ?? String(current.id),
        status: (upd.data?.status ?? next) as Status,
        end_date: upd.data?.end_date ?? null,
        paused_other_active_ids: pausedOtherActiveIds,
        audit_ok: auditOk,
      },
      200
    );
  } catch (e: any) {
    return jsonErr(500, a, "SERVER_ERROR", "Kunne ikke oppdatere agreement status.", {
      message: String(e?.message ?? e),
    });
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);
  return jsonErr(405, s.ctx, "METHOD_NOT_ALLOWED", "Bruk POST.");
}
export async function PUT(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);
  return jsonErr(405, s.ctx, "METHOD_NOT_ALLOWED", "Bruk POST.");
}
export async function DELETE(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);
  return jsonErr(405, s.ctx, "METHOD_NOT_ALLOWED", "Bruk POST.");
}
