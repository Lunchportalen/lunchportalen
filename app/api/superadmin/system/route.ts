// app/api/superadmin/system/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import {
  getSystemSettings,
  type SystemSettings,
  type SystemToggles,
  type KillSwitch,
  type Retention,
} from "@/lib/system/settings";

function denyResponse(s: any): Response {
  if (s && typeof s === "object") {
    if ("response" in s && s.response instanceof Response) return s.response as Response;
    if ("res" in s && s.res instanceof Response) return s.res as Response;
  }
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(401, { rid }, "UNAUTHENTICATED", "Du må være innlogget.");
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

/* =========================================================
   Plan + root policy
========================================================= */
type PlanItem = {
  area: "TOGGLE" | "KILL" | "RETENTION";
  key: string;
  from: string;
  to: string;
  severity: "normal" | "warn" | "danger";
};

function yn(v: boolean) {
  return v ? "ON" : "OFF";
}

function buildPlan(prev: SystemSettings, next: { toggles: SystemToggles; killswitch: KillSwitch; retention: Retention }) {
  const plan: PlanItem[] = [];

  (Object.keys(prev.toggles) as (keyof SystemToggles)[]).forEach((k) => {
    const a = !!(prev.toggles as any)[k];
    const b = !!(next.toggles as any)[k];
    if (a === b) return;
    plan.push({
      area: "TOGGLE",
      key: String(k),
      from: yn(a),
      to: yn(b),
      severity: k === "strict_mode" ? "warn" : "normal",
    });
  });

  (Object.keys(prev.killswitch) as (keyof KillSwitch)[]).forEach((k) => {
    const a = !!(prev.killswitch as any)[k];
    const b = !!(next.killswitch as any)[k];
    if (a === b) return;
    plan.push({
      area: "KILL",
      key: String(k),
      from: yn(a),
      to: yn(b),
      severity: k === "orders" || k === "cancellations" ? "danger" : "warn",
    });
  });

  (Object.keys(prev.retention) as (keyof Retention)[]).forEach((k) => {
    const a = Number((prev.retention as any)[k]);
    const b = Number((next.retention as any)[k]);
    if (a === b) return;
    plan.push({
      area: "RETENTION",
      key: String(k),
      from: String(a),
      to: String(b),
      severity: "warn",
    });
  });

  const rank = (s: PlanItem["severity"]) => (s === "danger" ? 0 : s === "warn" ? 1 : 2);
  plan.sort((a, b) => rank(a.severity) - rank(b.severity) || a.area.localeCompare(b.area));
  return plan;
}

function rootPolicyForPlan(plan: PlanItem[]) {
  const reasons: string[] = [];
  const has = (area: PlanItem["area"], key: string) => plan.some((p) => p.area === area && p.key === key);

  if (plan.some((p) => p.area === "RETENTION")) reasons.push("RETENTION_CHANGE");
  if (has("KILL", "orders") || has("KILL", "cancellations")) reasons.push("KILL_ORDERS_OR_CANCELLATIONS");
  if (has("TOGGLE", "strict_mode")) reasons.push("STRICT_MODE_CHANGE");

  const required = reasons.length > 0;
  const severity: "warn" | "danger" = reasons.includes("KILL_ORDERS_OR_CANCELLATIONS") ? "danger" : "warn";
  return { required, severity, reasons };
}

async function getActiveRootSession(sb: any, actorUserId: string) {
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("break_glass_sessions")
    .select("id,purpose,note,started_at,expires_at,ended_at")
    .eq("actor_user_id", actorUserId)
    .is("ended_at", null)
    .gt("expires_at", nowIso)
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

async function auditMetaFailClosed(sb: any, row: any) {
  const { error } = await sb.from("audit_meta_events").insert(row);
  if (error) throw error;
}

async function ensureIdempotentApplied(sb: any, rid: string) {
  const { data, error } = await sb
    .from("audit_meta_events")
    .select("id")
    .eq("rid", rid)
    .eq("action", "SYSTEM_UPDATE_APPLIED")
    .eq("entity_type", "system_settings")
    .eq("entity_id", "1")
    .limit(1);

  if (error) throw error;
  return !(data && data.length > 0);
}

function shallowDiff(before: Record<string, any>, after: Record<string, any>) {
  const out: Record<string, { from: any; to: any }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    const a = (before as any)?.[k];
    const b = (after as any)?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = { from: a, to: b };
  }
  return out;
}

/* =========================================================
   GET
========================================================= */
export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;

  const deny = requireRoleOr403(ctx, "api.superadmin.system.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const settings = await getSystemSettings();
    return jsonOk(ctx, { ok: true, rid: ctx.rid, settings }, 200);
  } catch (e: any) {
    return jsonErr(500, ctx, "SERVER_ERROR", "Kunne ikke hente systeminnstillinger.", {
      message: String(e?.message ?? e),
    });
  }
}

/* =========================================================
   PUT
========================================================= */
export async function PUT(req: NextRequest): Promise<Response> {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;

  const deny = requireRoleOr403(ctx, "api.superadmin.system.PUT", ["superadmin"]);
  if (deny) return deny;

  const userId = ctx.scope?.userId ?? null;
  if (!userId) return jsonErr(401, ctx, "UNAUTHENTICATED", "Du må være innlogget.");

  try {
    const current = await getSystemSettings();
    const body = (await readJson(req)) ?? {};
    const next = normalizePatch(current, body);

    const plan = buildPlan(current, next);
    const policy = rootPolicyForPlan(plan);

    const sb = await supabaseServer();

    // Idempotency: én rid => én effekt
    const okToApply = await ensureIdempotentApplied(sb, ctx.rid);
    if (!okToApply) {
      return jsonOk(ctx, { ok: true, rid: ctx.rid, idempotent: true, settings: current }, 200);
    }

    // Root gate hvis nødvendig
    let root: any = null;
    if (policy.required) {
      root = await getActiveRootSession(sb, userId);
      if (!root) {
        return jsonErr(403, ctx, "ROOT_REQUIRED", "Denne endringen krever aktiv Root Mode (break-glass).", {
          reasons: policy.reasons,
          severity: policy.severity,
          plan,
        });
      }
    }

    // Audit REQUEST (fail-closed)
    await auditMetaFailClosed(sb, {
      actor_user_id: userId,
      actor_email: ctx.scope?.email ?? null,
      action: "SYSTEM_UPDATE_REQUEST",
      purpose: root?.purpose ?? null,
      entity_type: "system_settings",
      entity_id: "1",
      rid: ctx.rid,
      detail: {
        reasons: policy.reasons,
        severity: policy.severity,
        plan,
        requested: {
          toggles: next.toggles,
          killswitch: next.killswitch,
          retention: next.retention,
        },
      },
    });

    const { error } = await sb
      .from("system_settings")
      .update({
        toggles: next.toggles as any,
        killswitch: next.killswitch as any,
        retention: next.retention as any,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("id", 1);

    if (error) {
      await auditMetaFailClosed(sb, {
        actor_user_id: userId,
        actor_email: ctx.scope?.email ?? null,
        action: "SYSTEM_UPDATE_FAIL",
        purpose: root?.purpose ?? null,
        entity_type: "system_settings",
        entity_id: "1",
        rid: ctx.rid,
        detail: { error },
      });

      return jsonErr(500, ctx, "DB_ERROR", "Kunne ikke lagre systeminnstillinger.", error);
    }

    const settings = await getSystemSettings();

    // Audit APPLIED (fail-closed)
    await auditMetaFailClosed(sb, {
      actor_user_id: userId,
      actor_email: ctx.scope?.email ?? null,
      action: "SYSTEM_UPDATE_APPLIED",
      purpose: root?.purpose ?? null,
      entity_type: "system_settings",
      entity_id: "1",
      rid: ctx.rid,
      detail: {
        reasons: policy.reasons,
        severity: policy.severity,
        plan,
        diff: {
          toggles: shallowDiff(current.toggles as any, settings.toggles as any),
          killswitch: shallowDiff(current.killswitch as any, settings.killswitch as any),
          retention: shallowDiff(current.retention as any, settings.retention as any),
        },
        applied: {
          toggles: settings.toggles,
          killswitch: settings.killswitch,
          retention: settings.retention,
        },
      },
    });

    return jsonOk(ctx, { ok: true, rid: ctx.rid, settings }, 200);
  } catch (e: any) {
    return jsonErr(500, ctx, "SERVER_ERROR", "Kunne ikke lagre systeminnstillinger.", {
      message: String(e?.message ?? e),
    });
  }
}
