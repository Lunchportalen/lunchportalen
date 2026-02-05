// app/api/superadmin/companies/[companyId]/purge/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * ENTERPRISE FASIT:
 * - 100% RPC-only: public.purge_company(...) er eneste “source of truth”
 * - GET = always RPC dry-run (counts)
 * - POST/DELETE = RPC purge (or dryRun) + best-effort audit
 * - ACTIVE sperre håndteres av RPC, men vi mapper feilmeldingen til 409 ACTIVE_BLOCKED
 * - Ingen throw i route (alltid jsonErr)
 */

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";

type Severity = "info" | "warning" | "critical";
type RouteCtx = { params: { companyId: string } | Promise<{ companyId: string }> };

type PurgeBody = {
  confirm?: boolean;
  dryRun?: boolean;
  reason?: string;
};

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normEmail(v: any) {
  return safeStr(v).toLowerCase();
}
function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

async function getCompanyId(ctx: RouteCtx) {
  const p = await Promise.resolve(ctx.params as any);
  return safeStr(p?.companyId);
}

/**
 * Extra enterprise gate (fail-closed):
 * - profiles.disabled_at må være null
 * - profiles.role må være superadmin
 *
 * NB: maybeSingle() er ikke generisk hos dere -> ingen <T>
 */
async function assertSuperadminNotDisabled(admin: any, userId: string) {
  if (!userId) return { ok: false as const, code: "FORBIDDEN", message: "Mangler userId." };

  const { data, error } = await admin
    .from("profiles")
    .select("role,disabled_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { ok: false as const, code: "PROFILE_LOOKUP_FAILED", message: "Kunne ikke lese profil.", detail: error };

  const profile = (data ?? null) as { role: string | null; disabled_at: string | null } | null;

  if (profile?.disabled_at) return { ok: false as const, code: "FORBIDDEN", message: "Bruker er deaktivert." };
  if (profile?.role && String(profile.role) !== "superadmin") return { ok: false as const, code: "FORBIDDEN", message: "Kun superadmin har tilgang." };

  return { ok: true as const };
}

async function bestEffortAudit(input: {
  actor_user_id: string;
  actor_email: string | null;
  action: string;
  severity: Severity;
  entity_type: string;
  entity_id: string;
  summary: string;
  detail: any;
}) {
  // 1) prøv lib/audit/log
  try {
    const mod = await import("@/lib/audit/log").catch(() => null);
    const writeAudit = (mod as any)?.writeAudit;
    if (typeof writeAudit === "function") {
      await writeAudit({
        actor_user_id: input.actor_user_id,
        actor_role: "superadmin",
        action: input.action,
        severity: input.severity,
        company_id: input.entity_type === "company" ? input.entity_id : null,
        target_type: input.entity_type,
        target_id: input.entity_id,
        target_label: input.summary,
        before: input.detail?.before ?? null,
        after: input.detail?.after ?? null,
        meta: input.detail?.meta ?? input.detail ?? null,
      });
      return { ok: true as const, via: "lib/audit/log" as const };
    }
  } catch {
    // ignore
  }

  // 2) fallback audit_events insert
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin();
    const { error } = await admin.from("audit_events").insert({
      actor_user_id: input.actor_user_id,
      actor_email: input.actor_email,
      actor_role: "superadmin",
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      summary: input.summary,
      detail: input.detail ?? undefined,
    } as any);

    if (error) return { ok: false as const, via: "audit_events" as const, error };
    return { ok: true as const, via: "audit_events" as const };
  } catch (e: any) {
    return { ok: false as const, via: "audit_events" as const, error: e };
  }
}

function mapRpcError(rpcErr: any) {
  const msg = safeStr(rpcErr?.message ?? rpcErr);
  if (msg.includes("cannot purge active company")) {
    return { status: 409, error: "ACTIVE_BLOCKED", message: "Kan ikke purge ACTIVE firma. Sett firma til PAUSED eller CLOSED først.", detail: msg };
  }
  if (msg.includes("company not found")) {
    return { status: 404, error: "NOT_FOUND", message: "Fant ikke firma.", detail: msg };
  }
  if (msg.includes("reason must be at least")) {
    return { status: 400, error: "BAD_REQUEST", message: "reason må være minst 8 tegn.", detail: msg };
  }
  return { status: 409, error: "RPC_FAILED", message: "purge_company feilet.", detail: msg };
}

/* =========================================================
   GET: dry-run via RPC
========================================================= */
export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.purge.GET", ["superadmin"]);
  if (deny) return deny;

  const companyId = await getCompanyId(ctx);
  if (!isUuid(companyId)) return jsonErr(a.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  let admin: any;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(a.rid, "Mangler service role key.", 500, { code: "ADMIN_CLIENT_FAILED", detail: { message: String(e?.message ?? e) } });
  }

  const extra = await assertSuperadminNotDisabled(admin, a.scope?.userId ?? "");
  if (!extra.ok) return jsonErr(a.rid, extra.message, 403, { code: extra.code, detail: extra.detail });

  const { data: company, error: cErr } = await admin
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .eq("id", companyId)
    .maybeSingle();

  if (cErr) return jsonErr(a.rid, "Kunne ikke hente firma.", 500, { code: "COMPANY_LOOKUP_FAILED", detail: cErr });
  if (!company) return jsonErr(a.rid, "Fant ikke firma.", 404, "NOT_FOUND");

  const actorEmail = normEmail(a.scope?.email ?? "");

  const { data: rpc, error: rpcErr } = await admin.rpc("purge_company", {
    p_company_id: companyId,
    p_reason: "dry-run",
    p_actor_email: actorEmail,
    p_dry_run: true,
  });

  if (rpcErr) {
    const mapped = mapRpcError(rpcErr);
    return jsonErr(a.rid, mapped.message, mapped.status ?? 400, mapped.error);
  }

  return jsonOk(a.rid, { ok: true, rid: a.rid, dryRun: true, company, rpc }, 200);
}

/* =========================================================
   POST/DELETE: purge via RPC
========================================================= */
export async function POST(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const a = s.ctx;
  const deny = requireRoleOr403(a, "api.superadmin.companies.purge.POST", ["superadmin"]);
  if (deny) return deny;

  const companyId = await getCompanyId(ctx);
  if (!isUuid(companyId)) return jsonErr(a.rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  const body = ((await readJson(req)) ?? null) as PurgeBody | null;
  if (!body?.confirm) return jsonErr(a.rid, "Bekreft purge (confirm=true).", 400, "BAD_REQUEST");

  const dryRun = Boolean(body?.dryRun);
  const reasonRaw = safeStr(body?.reason);
  const reason = reasonRaw.slice(0, 220);

  if (!dryRun && reason.length < 8) {
    return jsonErr(a.rid, "reason må være minst 8 tegn.", 400, "BAD_REQUEST");
  }

  let admin: any;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(a.rid, "Mangler service role key.", 500, { code: "ADMIN_CLIENT_FAILED", detail: { message: String(e?.message ?? e) } });
  }

  const extra = await assertSuperadminNotDisabled(admin, a.scope?.userId ?? "");
  if (!extra.ok) return jsonErr(a.rid, extra.message, 403, { code: extra.code, detail: extra.detail });

  const { data: company, error: cErr } = await admin
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .eq("id", companyId)
    .maybeSingle();

  if (cErr) return jsonErr(a.rid, "Kunne ikke hente firma.", 500, { code: "COMPANY_LOOKUP_FAILED", detail: cErr });
  if (!company) return jsonErr(a.rid, "Fant ikke firma.", 404, "NOT_FOUND");

  const actorEmail = normEmail(a.scope?.email ?? "");

  const startAudit =
    dryRun
      ? null
      : await bestEffortAudit({
          actor_user_id: a.scope?.userId ?? "",
          actor_email: actorEmail || null,
          action: "COMPANY_PURGE_STARTED",
          severity: "critical",
          entity_type: "company",
          entity_id: companyId,
          summary: `PURGE started: ${(company as any)?.name ?? companyId}`,
          detail: { meta: { rid: a.rid, reason: reason || null } },
        });

  const { data: rpc, error: rpcErr } = await admin.rpc("purge_company", {
    p_company_id: companyId,
    p_reason: reason || (dryRun ? "dry-run" : "purge"),
    p_actor_email: actorEmail,
    p_dry_run: dryRun,
  });

  if (rpcErr) {
    const mapped = mapRpcError(rpcErr);

    if (!dryRun) {
      await bestEffortAudit({
        actor_user_id: a.scope?.userId ?? "",
        actor_email: actorEmail || null,
        action: "COMPANY_PURGE_FAILED",
        severity: "critical",
        entity_type: "company",
        entity_id: companyId,
        summary: `PURGE failed: ${(company as any)?.name ?? companyId}`,
        detail: { meta: { rid: a.rid, reason: reason || null, started_audit: startAudit, rpc: mapped.detail } },
      });
    }

    return jsonErr(a.rid, mapped.message, mapped.status ?? 400, mapped.error);
  }

  const completedAudit =
    dryRun
      ? null
      : await bestEffortAudit({
          actor_user_id: a.scope?.userId ?? "",
          actor_email: actorEmail || null,
          action: "COMPANY_PURGE_COMPLETED",
          severity: "critical",
          entity_type: "company",
          entity_id: companyId,
          summary: `PURGE completed: ${(company as any)?.name ?? companyId}`,
          detail: { before: { company }, after: null, meta: { rid: a.rid, reason: reason || null, rpc, started_audit: startAudit } },
        });

  return jsonOk(
    a,
    {
      ok: true,
      rid: a.rid,
      dryRun,
      company: {
        id: companyId,
        name: (company as any)?.name ?? null,
        orgnr: (company as any)?.orgnr ?? null,
        status: (company as any)?.status ?? null,
      },
      rpc,
      audit: { started: startAudit, completed: completedAudit },
    },
    200
  );
}

export async function DELETE(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  return POST(req, ctx);
}
