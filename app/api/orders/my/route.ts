// app/api/orders/my/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";
import { cutoffStatusForDate, osloTodayISODate } from "@/lib/date/oslo";
import { requireRule } from "@/lib/agreement/requireRule";
import { lpOrderCancel, lpOrderSet } from "@/lib/orders/rpcWrite";

type CompanyLifecycle = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING" | "UNKNOWN";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normCompanyStatus(v: any): CompanyLifecycle {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  if (s === "PENDING") return "PENDING";
  return "UNKNOWN";
}

function weekdayKeyOslo(isoDate: string): "mon" | "tue" | "wed" | "thu" | "fri" | null {
  try {
    const d = new Date(`${isoDate}T12:00:00Z`);
    const wd = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", weekday: "short" }).format(d);
    const map: Record<string, "mon" | "tue" | "wed" | "thu" | "fri"> = {
      Mon: "mon",
      Tue: "tue",
      Wed: "wed",
      Thu: "thu",
      Fri: "fri",
    };
    return map[wd] ?? null;
  } catch {
    return null;
  }
}

function cutoffState(dateISO: string) {
  const status = cutoffStatusForDate(dateISO);
  return { status, time: "08:00", locked: status === "PAST" || status === "TODAY_LOCKED" };
}

async function companyStatusOrNull(admin: any, companyId: string) {
  const { data, error } = await admin.from("companies").select("id,status").eq("id", companyId).maybeSingle();
  if (error || !data?.id) return null;
  return normCompanyStatus((data as any).status);
}

async function getOrder(sb: any, companyId: string, locationId: string, userId: string, dateISO: string) {
  const { data } = await sb
    .from("orders")
    .select("id,status,date,created_at,updated_at,note,slot")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("location_id", locationId)
    .eq("date", dateISO)
    .maybeSingle();
  return data ?? null;
}

export async function GET(req: NextRequest) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;
  const denyRole = requireRoleOr403(a.ctx, "orders.my.read", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const userId = safeStr(scope.userId);
  const companyId = safeStr(scope.companyId);
  const locationId = safeStr(scope.locationId);
  const dateISO = osloTodayISODate();

  if (!userId || !companyId || !locationId) {
    return jsonErr(rid, "Mangler firmatilknytning (company/location).", 403, "MISSING_SCOPE");
  }

  const admin = supabaseAdmin();
  const companyStatus = await companyStatusOrNull(admin, companyId);
  if (!companyStatus) {
    return jsonErr(rid, "Kunne ikke hente firmastatus.", 500, "COMPANY_LOOKUP_FAILED");
  }

  const cutoff = cutoffState(dateISO);
  const dayKey = weekdayKeyOslo(dateISO);
  if (!dayKey) {
    return jsonErr(rid, "Ugyldig ukedag.", 400, { code: "INVALID_DAY", detail: { date: dateISO } });
  }

  let allowed = companyStatus === "ACTIVE" && !cutoff.locked;
  let reason: string | null = null;
  let tierToday: "BASIS" | "LUXUS" | null = null;

  if (allowed) {
    const ruleRes = await requireRule({ sb: admin as any, companyId, dayKey, slot: "lunch", rid });
    if (!ruleRes.ok) {
      const err = ruleRes as { message: string };
      allowed = false;
      reason = err.message;
    } else {
      tierToday = ruleRes.rule.tier;
    }
  } else {
    reason = companyStatus !== "ACTIVE" ? "Firma er ikke aktivt." : "Endringer er lÃ¥st etter 08:00.";
  }

  const sb = await supabaseServer();
  const myOrder = await getOrder(sb, companyId, locationId, userId, dateISO);

  return jsonOk(rid, {
      allowed,
      reason,
      cutoff,
      tierToday,
      myOrder,
    }, 200);
}

export async function POST(req: NextRequest) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;
  const denyRole = requireRoleOr403(a.ctx, "orders.my.write", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const userId = safeStr(scope.userId);
  const companyId = safeStr(scope.companyId);
  const locationId = safeStr(scope.locationId);
  const dateISO = osloTodayISODate();

  if (!userId || !companyId || !locationId) {
    return jsonErr(rid, "Mangler firmatilknytning (company/location).", 403, "MISSING_SCOPE");
  }

  const admin = supabaseAdmin();
  const companyStatus = await companyStatusOrNull(admin, companyId);
  if (companyStatus !== "ACTIVE") {
    return jsonErr(rid, "Firma er ikke aktivt.", 403, { code: "COMPANY_NOT_ACTIVE", detail: { status: companyStatus } });
  }

  const cutoff = cutoffState(dateISO);
  if (cutoff.locked) {
    return jsonErr(rid, "Endringer er lÃ¥st etter 08:00.", 409, { code: "CUTOFF_LOCKED", detail: { cutoff } });
  }

  const dayKey = weekdayKeyOslo(dateISO);
  if (!dayKey) return jsonErr(rid, "Ugyldig ukedag.", 400, { code: "INVALID_DAY", detail: { date: dateISO } });

  const ruleRes = await requireRule({ sb: admin as any, companyId, dayKey, slot: "lunch", rid });
  if (!ruleRes.ok) {
    const err = ruleRes as { message: string; status?: number; error?: string };
    return jsonErr(rid, err.message, err.status ?? 400, err.error);
  }

  const sb = await supabaseServer();

  const setRes = await lpOrderSet(sb as any, {
    p_date: dateISO,
    p_slot: "lunch",
    p_note: null,
  });

  if (!setRes.ok) {
    return jsonErr(rid, "Kunne ikke bestille lunsj.", 500, {
      code: setRes.code ?? "ORDER_RPC_FAILED",
      detail: { message: setRes.error?.message ?? null },
    });
  }

  const data = await getOrder(sb, companyId, locationId, userId, dateISO);

  return jsonOk(rid, {
      allowed: true,
      reason: null,
      cutoff,
      tierToday: ruleRes.rule.tier,
      myOrder: data,
    }, 200);
}

export async function DELETE(req: NextRequest) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;
  const denyRole = requireRoleOr403(a.ctx, "orders.my.cancel", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const userId = safeStr(scope.userId);
  const companyId = safeStr(scope.companyId);
  const locationId = safeStr(scope.locationId);
  const dateISO = osloTodayISODate();

  if (!userId || !companyId || !locationId) {
    return jsonErr(rid, "Mangler firmatilknytning (company/location).", 403, "MISSING_SCOPE");
  }

  const admin = supabaseAdmin();
  const companyStatus = await companyStatusOrNull(admin, companyId);
  if (companyStatus !== "ACTIVE") {
    return jsonErr(rid, "Firma er ikke aktivt.", 403, { code: "COMPANY_NOT_ACTIVE", detail: { status: companyStatus } });
  }

  const cutoff = cutoffState(dateISO);
  if (cutoff.locked) {
    return jsonErr(rid, "Endringer er lÃ¥st etter 08:00.", 409, { code: "CUTOFF_LOCKED", detail: { cutoff } });
  }

  const sb = await supabaseServer();
  const cancelRes = await lpOrderCancel(sb as any, { p_date: dateISO });
  if (!cancelRes.ok) {
    return jsonErr(rid, "Kunne ikke avbestille.", 500, {
      code: cancelRes.code ?? "ORDER_RPC_FAILED",
      detail: { message: cancelRes.error?.message ?? null },
    });
  }

  const data = await getOrder(sb, companyId, locationId, userId, dateISO);

  return jsonOk(rid, {
      allowed: true,
      reason: null,
      cutoff,
      tierToday: null,
      myOrder: data ?? null,
    }, 200);
}

