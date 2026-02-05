// app/api/superadmin/diagnostics/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { opsLog } from "@/lib/ops/log";

type CheckStatus = "OK" | "WARN" | "FAIL";
type SystemState = "NORMAL" | "DEGRADED";

type Check = { key: string; status: CheckStatus; message: string };
type RepairPlanItem = { key: string; title: string; safe: boolean };

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du mÃ¥ vÃ¦re innlogget.", 401, "UNAUTHENTICATED");
}

async function runChecks(): Promise<{
  checks: Check[];
  degradedReasons: string[];
  systemState: SystemState;
  repairPlan: RepairPlanItem[];
  canRepair: boolean;
}> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();
  const checks: Check[] = [];
  const degradedReasons: string[] = [];

  // Check: DB connectivity (simple count)
  try {
    const ping = await admin.from("companies").select("id", { count: "exact", head: true });
    if (ping.error) {
      checks.push({ key: "db.connect", status: "FAIL", message: "DB-tilkobling feilet." });
      degradedReasons.push("db.connect");
    } else {
      checks.push({ key: "db.connect", status: "OK", message: "DB-tilkobling OK." });
    }
  } catch {
    checks.push({ key: "db.connect", status: "FAIL", message: "DB-tilkobling feilet." });
    degradedReasons.push("db.connect");
  }

  // Check: required table access
  try {
    const res = await admin.from("profiles").select("id", { count: "exact", head: true });
    if (res.error) {
      checks.push({ key: "db.profiles", status: "FAIL", message: "Profiles-tabell ikke tilgjengelig." });
      degradedReasons.push("db.profiles");
    } else {
      checks.push({ key: "db.profiles", status: "OK", message: "Profiles-tabell OK." });
    }
  } catch {
    checks.push({ key: "db.profiles", status: "FAIL", message: "Profiles-tabell ikke tilgjengelig." });
    degradedReasons.push("db.profiles");
  }

  // Check: orders table access (light)
  try {
    const res = await admin.from("orders").select("id", { count: "exact", head: true });
    if (res.error) {
      checks.push({ key: "db.orders", status: "FAIL", message: "Orders-tabell ikke tilgjengelig." });
      degradedReasons.push("db.orders");
    } else {
      checks.push({ key: "db.orders", status: "OK", message: "Orders-tabell OK." });
    }
  } catch {
    checks.push({ key: "db.orders", status: "FAIL", message: "Orders-tabell ikke tilgjengelig." });
    degradedReasons.push("db.orders");
  }

  // Check: stats aggregate (safe counts)
  try {
    const [total, active] = await Promise.all([
      admin.from("companies").select("id", { count: "exact", head: true }),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]);
    if (total.error || active.error) {
      checks.push({ key: "stats.aggregate", status: "FAIL", message: "Kunne ikke beregne stats." });
      degradedReasons.push("stats_unavailable");
    } else {
      checks.push({ key: "stats.aggregate", status: "OK", message: "Stats-aggregering OK." });
    }
  } catch {
    checks.push({ key: "stats.aggregate", status: "FAIL", message: "Kunne ikke beregne stats." });
    degradedReasons.push("stats_unavailable");
  }

  const systemState: SystemState = degradedReasons.length > 0 ? "DEGRADED" : "NORMAL";
  const repairPlan: RepairPlanItem[] = [
    { key: "refresh_stats", title: "Rekalkuler stats (safe)", safe: true },
  ];
  const canRepair = true;

  return { checks, degradedReasons, systemState, repairPlan, canRepair };
}

export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.diagnostics.GET", ["superadmin"]);
  if (deny) return deny;

  try {
    const { checks, degradedReasons, systemState, repairPlan, canRepair } = await runChecks();
    return jsonOk(
      ctx.rid,
      {
        systemState,
        degradedReasons: Array.isArray(degradedReasons) ? degradedReasons : [],
        checks: Array.isArray(checks) ? checks : [],
        repairPlan: Array.isArray(repairPlan) ? repairPlan : [],
        canRepair: Boolean(canRepair),
        timestamp: new Date().toISOString(),
      },
      200
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e ?? "Ukjent feil");
    opsLog("superadmin.diagnostics.error", { rid: ctx.rid, message });
    return jsonErr(ctx.rid, "Kunne ikke kjÃ¸re diagnostics.", 500, {
      code: "SERVER_ERROR",
      detail: { message, diag: { checks: [] } },
    });
  }
}
