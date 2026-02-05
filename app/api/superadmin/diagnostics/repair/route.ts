// app/api/superadmin/diagnostics/repair/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { opsLog } from "@/lib/ops/log";

type RepairResult = { key: string; status: "OK" | "FAIL"; message: string };
type SystemState = "NORMAL" | "DEGRADED";

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

async function runDiagnosticsState(): Promise<{ systemState: SystemState; degradedReasons: string[] }> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();
  const reasons: string[] = [];

  try {
    const ping = await admin.from("companies").select("id", { count: "exact", head: true });
    if (ping.error) reasons.push("db.connect");
  } catch {
    reasons.push("db.connect");
  }

  try {
    const res = await admin.from("profiles").select("id", { count: "exact", head: true });
    if (res.error) reasons.push("db.profiles");
  } catch {
    reasons.push("db.profiles");
  }

  try {
    const [total, active] = await Promise.all([
      admin.from("companies").select("id", { count: "exact", head: true }),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "active"),
    ]);
    if (total.error || active.error) reasons.push("stats_unavailable");
  } catch {
    reasons.push("stats_unavailable");
  }

  return { systemState: reasons.length ? "DEGRADED" : "NORMAL", degradedReasons: reasons };
}

async function refreshStatsSafe(): Promise<RepairResult> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();
  try {
    const [total, active, pending, paused, closed] = await Promise.all([
      admin.from("companies").select("id", { count: "exact", head: true }),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "active"),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "paused"),
      admin.from("companies").select("id", { count: "exact", head: true }).eq("status", "closed"),
    ]);

    if (total.error || active.error || pending.error || paused.error || closed.error) {
      return { key: "refresh_stats", status: "FAIL", message: "Kunne ikke rekalkulere stats." };
    }

    return { key: "refresh_stats", status: "OK", message: "Stats rekalkulert (safe)." };
  } catch {
    return { key: "refresh_stats", status: "FAIL", message: "Kunne ikke rekalkulere stats." };
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.diagnostics.repair.POST", ["superadmin"]);
  if (deny) return deny;

  const body = await req.json().catch(() => ({}));
  const plan = Array.isArray(body?.plan) ? body.plan.map((x: any) => String(x)) : null;

  const allowed = new Set(["refresh_stats"]);
  const toRun = plan && plan.length ? plan.filter((x) => allowed.has(x)) : ["refresh_stats"];

  if (!toRun.length) {
    return jsonErr(ctx.rid, "Ugyldig repair-plan.", 400, { code: "BAD_REQUEST", detail: { plan: body?.plan ?? null } });
  }

  const results: RepairResult[] = [];
  for (const key of toRun) {
    if (key === "refresh_stats") {
      results.push(await refreshStatsSafe());
    }
  }

  opsLog("superadmin.diagnostics.repair", { rid: ctx.rid, ran: results });

  const stateAfter = await runDiagnosticsState();

  return jsonOk(ctx.rid, {
      ok: true,
      rid: ctx.rid,
      data: {
        ran: results,
        systemStateAfter: stateAfter.systemState,
        degradedReasonsAfter: stateAfter.degradedReasons,
        timestamp: new Date().toISOString(),
      },
    }, 200);
}

