// app/api/admin/support/report/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normRole(v: unknown): "company_admin" | "superadmin" | null {
  const s = safeStr(v).toLowerCase();
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "superadmin") return "superadmin";
  return null;
}

function pickBodyString(body: any, keys: string[], max = 400) {
  for (const k of keys) {
    const v = safeStr(body?.[k]);
    if (v) return v.slice(0, max);
  }
  return "";
}

export async function POST(req: NextRequest) {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;

  const denyRole = requireRoleOr403(ctx, "admin.support.report", ["company_admin", "superadmin"]);
  if (denyRole) return denyRole;

  const role = normRole(ctx.scope.role);
  if (!role) return jsonErr(ctx.rid, "Ingen tilgang.", 403, "FORBIDDEN");

  if (role === "company_admin") {
    const denyScope = requireCompanyScopeOr403(ctx);
    if (denyScope) return denyScope;
  }

  const body = await req.json().catch(() => ({}));

  const reason = pickBodyString(body, ["reason"], 400);
  const path = pickBodyString(body, ["path"], 200);
  const desiredChange = pickBodyString(body, ["desiredChange", "desired_change"], 2000) || null;

  const scopedCompanyId = safeStr(ctx.scope.companyId) || null;
  const requestedCompanyId = pickBodyString(body, ["companyId", "company_id"], 80) || null;
  const companyId = role === "company_admin" ? scopedCompanyId : requestedCompanyId ?? scopedCompanyId;

  const locationId = pickBodyString(body, ["locationId", "location_id"], 80) || null;
  const agreementId = pickBodyString(body, ["agreementId", "agreement_id"], 80) || null;
  const status = pickBodyString(body, ["status"], 40) || null;
  const updatedAt = pickBodyString(body, ["updatedAt", "updated_at"], 60) || null;
  const metrics = body?.metrics ?? null;
  const extra = body?.extra ?? null;

  const admin = supabaseAdmin();

  let companyName: string | null = null;
  if (companyId) {
    const { data: companyRow, error: companyErr } = await admin
      .from("companies")
      .select("id,name")
      .eq("id", companyId)
      .maybeSingle();
    if (companyErr) return jsonErr(ctx.rid, "Kunne ikke hente firma.", 500, { code: "COMPANY_READ_FAILED", detail: companyErr });
    companyName = (companyRow as any)?.name ?? null;
  }

  const payload = {
    rid: ctx.rid,
    created_at: new Date().toISOString(),
    actor_user_id: ctx.scope.userId ?? null,
    actor_email: ctx.scope.email ?? null,
    actor_role: role,
    company_id: companyId,
    company_name: companyName,
    location_id: locationId,
    agreement_id: agreementId,
    reason,
    path,
    status,
    updated_at: updatedAt,
    desired_change: desiredChange,
    metrics,
    extra,
    user_agent: req.headers.get("user-agent"),
  };

  const { error: insertErr } = await admin.from("support_reports").insert(payload as any);

  if (insertErr) {
    const code = safeStr((insertErr as any)?.code);
    if (code === "42P01") {
      console.warn("[support.report] support_reports missing, stored=false", { rid: ctx.rid, companyId });
      return jsonOk(ctx.rid, { stored: false });
    }
    return jsonErr(ctx.rid, "Kunne ikke sende systemrapport.", 500, { code: "SUPPORT_REPORT_FAILED", detail: {
      code,
      message: safeStr((insertErr as any)?.message),
    } });
  }

  return jsonOk(ctx.rid, { stored: true });
}
