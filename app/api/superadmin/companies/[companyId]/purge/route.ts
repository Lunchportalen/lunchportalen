// app/api/superadmin/companies/[companyId]/purge/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ENTERPRISE FASIT (strammet inn):
 * - 100% RPC-only: public.purge_company(...) er eneste “source of truth”
 * - Hard superadmin email gate (FASIT) + disabled gate + role drift check (fail-closed)
 * - GET = always RPC dry-run (counts)
 * - POST = RPC purge (or dryRun) + best-effort audit
 * - ACTIVE sperre håndteres av RPC, men vi mapper feilmeldingen til 409 ACTIVE_BLOCKED
 * - Ingen legacy delete/count helpers i route (DB er motoren)
 */

type Severity = "info" | "warning" | "critical";

type RouteCtx = {
  params: { companyId: string } | Promise<{ companyId: string }>;
};

type PurgeBody = {
  confirm?: boolean;
  dryRun?: boolean;
  reason?: string;
};

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normEmail(v: any) {
  return safeStr(v).toLowerCase();
}
function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("MISSING_SUPABASE_URL");
  if (!key) throw new Error("MISSING_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getCompanyId(ctx: RouteCtx) {
  const { companyId } = await Promise.resolve(ctx.params);
  return safeStr(companyId);
}

/**
 * 🔒 Enterprise gate (fail-closed)
 */
async function requireSuperadmin(rid: string) {
  const sb = await supabaseServer();

  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;
  if (error || !user) {
    return { ok: false as const, res: jsonErr(401, rid, "AUTH_REQUIRED", "Ikke innlogget.") };
  }

  const email = normEmail(user.email);
  if (email !== "superadmin@lunchportalen.no") {
    return { ok: false as const, res: jsonErr(403, rid, "FORBIDDEN", "Kun superadmin har tilgang.") };
  }

  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("role,disabled_at")
    .eq("user_id", user.id)
    .maybeSingle<{ role: string | null; disabled_at: string | null }>();

  if (pErr) {
    return { ok: false as const, res: jsonErr(500, rid, "PROFILE_LOOKUP_FAILED", "Kunne ikke lese profil.", pErr.message) };
  }
  if (profile?.disabled_at) {
    return { ok: false as const, res: jsonErr(403, rid, "FORBIDDEN", "Bruker er deaktivert.") };
  }
  if (profile?.role && String(profile.role) !== "superadmin") {
    return { ok: false as const, res: jsonErr(403, rid, "FORBIDDEN", "Kun superadmin har tilgang.") };
  }

  return { ok: true as const, user };
}

/**
 * Audit best-effort:
 * - prøver "@/lib/audit/log".writeAudit
 * - fallback: insert i public.audit_events (hvis mulig)
 * - må aldri stoppe purge
 */
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
  } catch {}

  try {
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
    });
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
   GET: always returns RPC dry-run (counts)
   /api/superadmin/companies/:id/purge?dryRun=1
========================================================= */

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const rid = `purge_get_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const companyId = await getCompanyId(ctx);
  if (!isUuid(companyId)) return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig companyId.");

  const guard = await requireSuperadmin(rid);
  if (!guard.ok) return guard.res;

  let admin: any;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(500, rid, "ADMIN_CLIENT_FAILED", "Mangler service role key.", e?.message ?? String(e));
  }

  const { data: company, error: cErr } = await admin
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .eq("id", companyId)
    .maybeSingle();

  if (cErr) return jsonErr(500, rid, "COMPANY_LOOKUP_FAILED", "Kunne ikke hente firma.", cErr.message);
  if (!company) return jsonErr(404, rid, "NOT_FOUND", "Fant ikke firma.");

  const actorEmail = normEmail(guard.user.email);

  const { data: rpc, error: rpcErr } = await admin.rpc("purge_company", {
    p_company_id: companyId,
    p_reason: "dry-run",
    p_actor_email: actorEmail,
    p_dry_run: true,
  });

  if (rpcErr) {
    const mapped = mapRpcError(rpcErr);
    return jsonErr(mapped.status, rid, mapped.error, mapped.message, { companyId, rpc: mapped.detail });
  }

  return jsonOk({
    ok: true,
    rid,
    dryRun: true,
    company,
    rpc,
  });
}

/* =========================================================
   POST: purge via RPC
   Body: { confirm: true, dryRun?: boolean, reason?: string }
========================================================= */

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const rid = `purge_post_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const companyId = await getCompanyId(ctx);
  if (!isUuid(companyId)) return jsonErr(400, rid, "BAD_REQUEST", "Ugyldig companyId.");

  const guard = await requireSuperadmin(rid);
  if (!guard.ok) return guard.res;

  const body = (await req.json().catch(() => null)) as PurgeBody | null;
  if (!body?.confirm) return jsonErr(400, rid, "BAD_REQUEST", "Bekreft purge (confirm=true).");

  const dryRun = Boolean(body?.dryRun);
  const reasonRaw = safeStr(body?.reason);
  const reason = reasonRaw.slice(0, 220);

  if (!dryRun && reason.length < 8) {
    return jsonErr(400, rid, "BAD_REQUEST", "reason må være minst 8 tegn.");
  }

  let admin: any;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonErr(500, rid, "ADMIN_CLIENT_FAILED", "Mangler service role key.", e?.message ?? String(e));
  }

  const { data: company, error: cErr } = await admin
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .eq("id", companyId)
    .maybeSingle();

  if (cErr) return jsonErr(500, rid, "COMPANY_LOOKUP_FAILED", "Kunne ikke hente firma.", cErr.message);
  if (!company) return jsonErr(404, rid, "NOT_FOUND", "Fant ikke firma.");

  const actorEmail = normEmail(guard.user.email);

  const startAudit =
    dryRun
      ? null
      : await bestEffortAudit({
          actor_user_id: guard.user.id,
          actor_email: actorEmail || null,
          action: "COMPANY_PURGE_STARTED",
          severity: "critical",
          entity_type: "company",
          entity_id: companyId,
          summary: `PURGE started: ${(company as any)?.name ?? companyId}`,
          detail: { meta: { rid, reason: reason || null } },
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
        actor_user_id: guard.user.id,
        actor_email: actorEmail || null,
        action: "COMPANY_PURGE_FAILED",
        severity: "critical",
        entity_type: "company",
        entity_id: companyId,
        summary: `PURGE failed: ${(company as any)?.name ?? companyId}`,
        detail: { meta: { rid, reason: reason || null, started_audit: startAudit, rpc: mapped.detail } },
      });
    }

    return jsonErr(mapped.status, rid, mapped.error, mapped.message, { companyId, rpc: mapped.detail });
  }

  const completedAudit =
    dryRun
      ? null
      : await bestEffortAudit({
          actor_user_id: guard.user.id,
          actor_email: actorEmail || null,
          action: "COMPANY_PURGE_COMPLETED",
          severity: "critical",
          entity_type: "company",
          entity_id: companyId,
          summary: `PURGE completed: ${(company as any)?.name ?? companyId}`,
          detail: { before: { company }, after: null, meta: { rid, reason: reason || null, rpc, started_audit: startAudit } },
        });

  return jsonOk({
    ok: true,
    rid,
    dryRun,
    company: { id: companyId, name: (company as any)?.name ?? null, orgnr: (company as any)?.orgnr ?? null, status: (company as any)?.status ?? null },
    rpc,
    audit: { started: startAudit, completed: completedAudit },
  });
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return POST(req, ctx);
}
