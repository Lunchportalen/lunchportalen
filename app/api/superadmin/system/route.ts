// app/api/superadmin/system/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope } from "@/lib/auth/scope";
import {
  getSystemSettings,
  type SystemSettings,
  type SystemToggles,
  type KillSwitch,
  type Retention,
} from "@/lib/system/settings";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function rid() {
  return crypto.randomBytes(8).toString("hex");
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json(
    { ok: false, rid, error, message, detail: detail ?? undefined },
    { status, headers: noStore() }
  );
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

async function requireSuperadmin(req: NextRequest) {
  // ✅ FASIT: deres getScope krever req
  const scope = await getScope(req);
  if (!scope?.user_id) throw new Error("NOT_AUTHENTICATED");
  if (scope.role !== "superadmin") throw new Error("FORBIDDEN");
  return scope;
}

function pickBool(v: any, fallback: boolean) {
  return typeof v === "boolean" ? v : fallback;
}
function pickInt(v: any, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return Math.max(min, Math.min(max, i));
}

function normalizePatch(current: SystemSettings, patch: any) {
  const nextToggles: SystemToggles = {
    ...current.toggles,
    ...(patch?.toggles ?? {}),
  };

  const nextKill: KillSwitch = {
    orders: pickBool(patch?.killswitch?.orders, current.killswitch.orders),
    cancellations: pickBool(patch?.killswitch?.cancellations, current.killswitch.cancellations),
    emails: pickBool(patch?.killswitch?.emails, current.killswitch.emails),
    kitchen_feed: pickBool(patch?.killswitch?.kitchen_feed, current.killswitch.kitchen_feed),
  };

  const nextRetention: Retention = {
    orders_months: pickInt(patch?.retention?.orders_months, current.retention.orders_months, 1, 60),
    audit_years: pickInt(patch?.retention?.audit_years, current.retention.audit_years, 1, 15),
  };

  const normalizedToggles: SystemToggles = {
    enforce_cutoff: pickBool(nextToggles.enforce_cutoff, current.toggles.enforce_cutoff ?? true),
    require_active_agreement: pickBool(
      nextToggles.require_active_agreement,
      current.toggles.require_active_agreement ?? true
    ),
    employee_self_service: pickBool(
      nextToggles.employee_self_service,
      current.toggles.employee_self_service ?? true
    ),
    company_admin_can_order: pickBool(
      nextToggles.company_admin_can_order,
      current.toggles.company_admin_can_order ?? true
    ),
    strict_mode: pickBool(nextToggles.strict_mode, current.toggles.strict_mode ?? true),
    esg_engine: pickBool(nextToggles.esg_engine, current.toggles.esg_engine ?? false),
    email_backup: pickBool(nextToggles.email_backup, current.toggles.email_backup ?? true),
  };

  return { toggles: normalizedToggles, killswitch: nextKill, retention: nextRetention };
}

/**
 * ✅ Next.js route handlers kan ta (req: NextRequest)
 * - Vi bruker req for getScope(req)
 */
export async function GET(req: NextRequest) {
  const r = rid();
  try {
    await requireSuperadmin(req);
    const settings = await getSystemSettings();
    return jsonOk({ ok: true, rid: r, settings });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "NOT_AUTHENTICATED") return jsonErr(401, r, "UNAUTHENTICATED", "Du må være innlogget.");
    if (msg === "FORBIDDEN") return jsonErr(403, r, "FORBIDDEN", "Kun superadmin har tilgang.");
    return jsonErr(500, r, "SERVER_ERROR", "Kunne ikke hente systeminnstillinger.", { msg });
  }
}

export async function PUT(req: NextRequest) {
  const r = rid();
  try {
    const scope = await requireSuperadmin(req);

    const current = await getSystemSettings();
    const body = await req.json().catch(() => ({}));
    const next = normalizePatch(current, body);

    const sb = await supabaseServer();
    const { error } = await sb
      .from("system_settings")
      .update({
        toggles: next.toggles as any,
        killswitch: next.killswitch as any,
        retention: next.retention as any,
        updated_at: new Date().toISOString(),
        updated_by: scope.user_id,
      })
      .eq("id", 1);

    if (error) return jsonErr(500, r, "DB_ERROR", "Kunne ikke lagre systeminnstillinger.", error);

    const settings = await getSystemSettings();
    return jsonOk({ ok: true, rid: r, settings });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "NOT_AUTHENTICATED") return jsonErr(401, r, "UNAUTHENTICATED", "Du må være innlogget.");
    if (msg === "FORBIDDEN") return jsonErr(403, r, "FORBIDDEN", "Kun superadmin har tilgang.");
    return jsonErr(500, r, "SERVER_ERROR", "Kunne ikke lagre systeminnstillinger.", { msg });
  }
}
