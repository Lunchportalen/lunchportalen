// app/api/superadmin/companies/[companyId]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED";
type Severity = "info" | "warning" | "critical";

type RouteCtx = {
  // Next.js 15: params kan være Promise
  params: { companyId: string } | Promise<{ companyId: string }>;
};

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function normalizeStatus(x: any): CompanyStatus | null {
  const s = String(x ?? "").trim();
  if (!s) return null;
  const up = s.toUpperCase();
  if (up === "ACTIVE" || up === "PAUSED" || up === "CLOSED") return up as CompanyStatus;
  return null;
}

function severityFor(status: CompanyStatus): Severity {
  if (status === "CLOSED") return "critical";
  if (status === "PAUSED") return "warning";
  return "info";
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("MISSING_SUPABASE_URL");
  if (!key) throw new Error("MISSING_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireSuperadmin() {
  const supabase = await supabaseServer();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  if (!user || userErr) return { ok: false as const, res: jsonError(401, "AUTH_REQUIRED", "Ikke innlogget.") };

  const { data: profile, error: profErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr) {
    return {
      ok: false as const,
      res: jsonError(500, "PROFILE_LOOKUP_FAILED", "Kunne ikke lese profil.", profErr.message),
    };
  }

  if (!profile || profile.role !== "superadmin") {
    return { ok: false as const, res: jsonError(403, "FORBIDDEN", "Kun superadmin har tilgang.") };
  }

  return { ok: true as const, user };
}

async function getCompanyId(ctx: RouteCtx) {
  const { companyId } = await Promise.resolve(ctx.params);
  return companyId;
}

/**
 * GET: hent firma
 */
export async function GET(_req: Request, ctx: RouteCtx) {
  const companyId = await getCompanyId(ctx);
  if (!isUuid(companyId)) return jsonError(400, "BAD_REQUEST", "Ugyldig companyId.");

  const guard = await requireSuperadmin();
  if (!guard.ok) return guard.res;

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonError(500, "ADMIN_CLIENT_FAILED", "Mangler service role key.", e?.message ?? String(e));
  }

  const { data, error } = await admin
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .eq("id", companyId)
    .maybeSingle();

  if (error) return jsonError(500, "COMPANY_LOOKUP_FAILED", "Kunne ikke hente firma.", error.message);
  if (!data) return jsonError(404, "NOT_FOUND", "Fant ikke firma.");

  return NextResponse.json({ ok: true, company: data }, { status: 200 });
}

/**
 * PATCH: endre status
 * Body: { status: "ACTIVE"|"PAUSED"|"CLOSED", reason?: string }
 */
export async function PATCH(req: Request, ctx: RouteCtx) {
  const companyId = await getCompanyId(ctx);
  if (!isUuid(companyId)) return jsonError(400, "BAD_REQUEST", "Ugyldig companyId.");

  const guard = await requireSuperadmin();
  if (!guard.ok) return guard.res;

  const body = (await req.json().catch(() => null)) as { status?: any; reason?: string } | null;
  const nextStatus = normalizeStatus(body?.status);
  const reason = String(body?.reason ?? "").trim().slice(0, 220);

  if (!nextStatus) return jsonError(400, "BAD_REQUEST", "Ugyldig status.");

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonError(500, "ADMIN_CLIENT_FAILED", "Mangler service role key.", e?.message ?? String(e));
  }

  // fetch existing (for audit + idempotency)
  const { data: existing, error: exErr } = await admin
    .from("companies")
    .select("id,name,orgnr,status,updated_at,created_at")
    .eq("id", companyId)
    .maybeSingle();

  if (exErr) return jsonError(500, "COMPANY_LOOKUP_FAILED", "Kunne ikke hente firma.", exErr.message);
  if (!existing) return jsonError(404, "NOT_FOUND", "Fant ikke firma.");

  const prevStatus = normalizeStatus((existing as any).status) ?? "ACTIVE";
  if (prevStatus === nextStatus) {
    return NextResponse.json(
      { ok: true, company: existing, meta: { prevStatus, newStatus: nextStatus, note: "No change" } },
      { status: 200 }
    );
  }

  const nowISO = new Date().toISOString();

  const { data: updated, error: upErr } = await admin
    .from("companies")
    .update({ status: nextStatus, updated_at: nowISO })
    .eq("id", companyId)
    .select("id,name,orgnr,status,created_at,updated_at")
    .single();

  // ✅ Viktig: gi korrekt status + full detail hvis DB/policy/trigger stopper oss
  if (upErr || !updated) {
    console.error("COMPANY_STATUS_UPDATE_FAILED", {
      companyId,
      actor_user_id: guard.user.id,
      nextStatus,
      code: (upErr as any)?.code,
      message: upErr?.message,
      details: (upErr as any)?.details,
      hint: (upErr as any)?.hint,
      serviceRolePresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });

    const msg = upErr?.message ?? "Not allowed: status can only be changed by superadmin";
    return jsonError(403, "FORBIDDEN", msg, {
      code: (upErr as any)?.code,
      details: (upErr as any)?.details,
      hint: (upErr as any)?.hint,
    });
  }

  // audit (fail-quiet)
  try {
    const mod = await import("@/lib/audit/log").catch(() => null);
    const writeAudit = (mod as any)?.writeAudit;
    if (typeof writeAudit === "function") {
      await writeAudit({
        actor_user_id: guard.user.id,
        actor_role: "superadmin",
        action: "company.status_changed",
        severity: severityFor(nextStatus),
        company_id: companyId,
        target_type: "company",
        target_id: companyId,
        target_label: (updated as any)?.name ?? null,
        before: { status: prevStatus },
        after: { status: nextStatus },
        meta: { reason: reason || null, orgnr: (updated as any)?.orgnr ?? null },
      });
    }
  } catch {}

  return NextResponse.json({ ok: true, company: updated, meta: { prevStatus, newStatus: nextStatus } }, { status: 200 });
}

/**
 * DELETE: hard delete (kun companies-raden)
 * Body: { confirm: true, reason?: string }
 */
export async function DELETE(req: Request, ctx: RouteCtx) {
  const companyId = await getCompanyId(ctx);
  if (!isUuid(companyId)) return jsonError(400, "BAD_REQUEST", "Ugyldig companyId.");

  const guard = await requireSuperadmin();
  if (!guard.ok) return guard.res;

  const body = (await req.json().catch(() => null)) as { confirm?: boolean; reason?: string } | null;
  if (!body?.confirm) return jsonError(400, "BAD_REQUEST", "Bekreft sletting (confirm=true).");

  const reason = String(body?.reason ?? "").trim().slice(0, 220);

  let admin;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonError(500, "ADMIN_CLIENT_FAILED", "Mangler service role key.", e?.message ?? String(e));
  }

  const { data: existing, error: exErr } = await admin
    .from("companies")
    .select("id,name,orgnr,status")
    .eq("id", companyId)
    .maybeSingle();

  if (exErr) return jsonError(500, "COMPANY_LOOKUP_FAILED", "Kunne ikke hente firma.", exErr.message);
  if (!existing) return jsonError(404, "NOT_FOUND", "Fant ikke firma.");

  const del = await admin.from("companies").delete().eq("id", companyId);
  if (del.error) {
    console.error("COMPANY_DELETE_FAILED", {
      companyId,
      actor_user_id: guard.user.id,
      code: (del.error as any)?.code,
      message: del.error.message,
      details: (del.error as any)?.details,
      hint: (del.error as any)?.hint,
      serviceRolePresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });

    return jsonError(409, "DELETE_BLOCKED", "Kan ikke slette firma (har avhengigheter).", {
      code: (del.error as any)?.code,
      details: (del.error as any)?.details,
      hint: (del.error as any)?.hint,
    });
  }

  // audit (fail-quiet)
  try {
    const mod = await import("@/lib/audit/log").catch(() => null);
    const writeAudit = (mod as any)?.writeAudit;
    if (typeof writeAudit === "function") {
      await writeAudit({
        actor_user_id: guard.user.id,
        actor_role: "superadmin",
        action: "company.deleted",
        severity: "critical",
        company_id: companyId,
        target_type: "company",
        target_id: companyId,
        target_label: (existing as any)?.name ?? null,
        before: { company: existing },
        after: null,
        meta: { reason: reason || null, orgnr: (existing as any)?.orgnr ?? null },
      });
    }
  } catch {}

  return NextResponse.json({ ok: true, deleted: { id: companyId } }, { status: 200 });
}
