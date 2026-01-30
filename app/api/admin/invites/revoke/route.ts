// app/api/admin/invites/revoke/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { supabaseAdmin } from "@/lib/supabase/admin";

// ✅ Dag-10 helpers
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403, readJson } from "@/lib/http/routeGuard";
import { noStoreHeaders } from "@/lib/http/noStore";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function errDetail(e: any) {
  if (!e) return null;
  if (typeof e === "string") return e;
  if (e instanceof Error) return { name: e.name, message: e.message };
  try {
    return JSON.parse(JSON.stringify(e));
  } catch {
    return String(e);
  }
}

function jsonErr(ctx: { rid: string }, status: number, error: string, message: string, detail?: any) {
  const body = { ok: false, rid: ctx.rid, error, message, detail: detail ?? undefined };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8" },
  });
}
function jsonOk(ctx: { rid: string }, body: any, status = 200) {
  return new Response(JSON.stringify({ ...body, rid: ctx.rid }), {
    status,
    headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8" },
  });
}

function pickCodeFromReq(req: NextRequest) {
  const url = new URL(req.url);
  return safeStr(url.searchParams.get("code") ?? url.searchParams.get("invite"));
}

async function readBody(req: NextRequest): Promise<Record<string, any>> {
  // readJson hos dere skal være safe (aldri throw), men vi har fallback uansett
  try {
    const b = (await readJson(req)) as any;
    return b && typeof b === "object" ? b : {};
  } catch {
    try {
      const t = await req.text();
      if (!t) return {};
      const j = JSON.parse(t);
      return j && typeof j === "object" ? j : {};
    } catch {
      return {};
    }
  }
}

async function handleRevoke(ctx: any, code: string) {
  const role = safeStr(ctx?.scope?.role);
  const ctxCompanyId = safeStr(ctx?.scope?.companyId);

  // For company_admin: company scope må finnes
  if (role !== "superadmin") {
    const denyScope = requireCompanyScopeOr403(ctx);
    if (denyScope) return denyScope;
    if (!ctxCompanyId) return jsonErr(ctx, 403, "missing_company_scope", "Mangler company scope.");
  }

  const admin = supabaseAdmin();

  // Hent invite (for å validere company_id og status)
  const { data: row, error: rErr } = await admin
    .from("company_invites")
    .select("code, company_id, revoked_at, created_at")
    .eq("code", code)
    .maybeSingle();

  if (rErr) return jsonErr(ctx, 500, "db_error", "Kunne ikke slå opp invitasjon.", errDetail(rErr));
  if (!row) return jsonErr(ctx, 404, "not_found", "Invitasjonslenken finnes ikke.", { code });

  const inviteCompanyId = safeStr((row as any).company_id);

  // company_admin kan bare revoke egen company
  if (role !== "superadmin" && inviteCompanyId && ctxCompanyId && inviteCompanyId !== ctxCompanyId) {
    return jsonErr(ctx, 403, "forbidden", "Du kan ikke tilbakekalle invitasjoner for andre firma.", { code });
  }

  // Hvis allerede revoked: idempotent OK
  if ((row as any).revoked_at) {
    return jsonOk(ctx, {
      ok: true,
      code,
      company_id: inviteCompanyId || null,
      revoked_at: (row as any).revoked_at,
      already_revoked: true,
    });
  }

  // Revoke: sett revoked_at
  const now = new Date().toISOString();

  const { data: upd, error: uErr } = await admin
    .from("company_invites")
    .update({ revoked_at: now })
    .eq("code", code)
    .select("code, company_id, revoked_at")
    .maybeSingle();

  if (uErr) return jsonErr(ctx, 500, "db_error", "Kunne ikke tilbakekalle invitasjon.", errDetail(uErr));

  return jsonOk(ctx, {
    ok: true,
    code: safeStr((upd as any)?.code) || code,
    company_id: safeStr((upd as any)?.company_id) || inviteCompanyId || null,
    revoked_at: (upd as any)?.revoked_at ?? now,
    already_revoked: false,
  });
}

export async function POST(req: NextRequest) {
  // Auth scope (401)
  const s = await scopeOr401(req);
  if (s instanceof Response) return s;
  const ctx = s.ctx;

  // Role gate (403): superadmin OR company_admin (NY SIGNATUR)
  const denyRole = requireRoleOr403(ctx, "admin.invites.revoke", ["superadmin", "company_admin"]);
  if (denyRole) return denyRole;

  const body = await readBody(req);
  const code = safeStr(body.code ?? body.invite ?? pickCodeFromReq(req));

  if (!code) return jsonErr(ctx, 400, "missing_code", "Mangler invitasjonskode (code).");

  return handleRevoke(ctx, code);
}

export async function GET(req: NextRequest) {
  // Auth scope (401)
  const s = await scopeOr401(req);
  if (s instanceof Response) return s;
  const ctx = s.ctx;

  // Role gate (403)
  const denyRole = requireRoleOr403(ctx, "admin.invites.revoke", ["superadmin", "company_admin"]);
  if (denyRole) return denyRole;

  const code = pickCodeFromReq(req);
  if (!code) return jsonErr(ctx, 400, "missing_code", "Mangler invitasjonskode (code).");

  return handleRevoke(ctx, code);
}
